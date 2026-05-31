import os
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

import requests
import yfinance as yf

from market_data.models import RawMarketData
from market_data.services.gemini_client import is_configured, score_news_items


@dataclass
class MarketPoint:
    source: str
    symbol: str
    value: Decimal
    unit: str
    observed_at: datetime
    metadata: dict


def _fetch_close_price(symbol: str) -> Optional[Decimal]:
    try:
        ticker = yf.Ticker(symbol)
        history = ticker.history(period="1d", interval="1m")
        if history.empty:
            history = ticker.history(period="5d")
            if history.empty:
                return None
        return Decimal(str(history["Close"].iloc[-1]))
    except Exception:
        return None


def collect_yfinance_points() -> List[MarketPoint]:
    now_utc = datetime.now(timezone.utc)
    mapping = [
        ("CL=F", "WTI", "USD/barrel"),
        ("BZ=F", "BRENT", "USD/barrel"),
        ("USDKRW=X", "USDKRW", "KRW/USD"),
    ]

    points: List[MarketPoint] = []
    for yf_symbol, symbol, unit in mapping:
        value = _fetch_close_price(yf_symbol)
        if value is None:
            continue
        points.append(
            MarketPoint(
                source="yfinance",
                symbol=symbol,
                value=value,
                unit=unit,
                observed_at=now_utc,
                metadata={"provider_symbol": yf_symbol},
            )
        )
    return points


def collect_opinet_points() -> List[MarketPoint]:
    api_key = os.getenv("OPINET_API_KEY")
    if not api_key:
        return []

    # Opinet average price API endpoint.
    url = "https://www.opinet.co.kr/api/avgAllPrice.do"
    params = {
        "out": "json",
        "code": api_key,
    }
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        payload = response.json()
    except Exception:
        return []

    prices = payload.get("RESULT", {}).get("OIL", [])
    if not prices:
        return []

    now_utc = datetime.now(timezone.utc)
    points: List[MarketPoint] = []
    for item in prices:
        product_code = item.get("PRODCD")
        avg_price = item.get("PRICE")
        if not product_code or avg_price in (None, ""):
            continue

        # 제품별 심볼 매핑
        if product_code == "B027":
            symbol = "DOMESTIC_GASOLINE_AVG"
        else:
            symbol = "OPINET_" + product_code
        try:
            value = Decimal(str(avg_price))
        except Exception:
            continue

        points.append(
            MarketPoint(
                source="opinet",
                symbol=symbol,
                value=value,
                unit="KRW/L",
                observed_at=now_utc,
                metadata={"product_code": product_code, "raw_item": item},
            )
        )
    return points


def collect_alphavantage_news_sentiment() -> List[MarketPoint]:
    api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
    if not api_key:
        return []

    url = "https://www.alphavantage.co/query"
    params = {
        "function": "NEWS_SENTIMENT",
        "topics": "energy",
        "limit": 20,
        "apikey": api_key,
    }

    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        payload = response.json()
    except Exception:
        return []

    feed = payload.get("feed", [])
    if not feed:
        return []

    scores = []
    news_items = []
    for article in feed:
        score = article.get("overall_sentiment_score")
        if score is not None:
            scores.append(float(score))
            news_items.append({
                "title": article.get("title"),
                "summary": article.get("summary"),
                "sentiment_score": score,
                "url": article.get("url")
            })

    if not scores:
        return []

    avg_score = sum(scores) / len(scores)
    mapped_score = Decimal(str(round(avg_score * 3.0, 4)))

    now_utc = datetime.now(timezone.utc)
    return [
        MarketPoint(
            source="alphavantage",
            symbol="NEWS_SENTIMENT_SCORE",
            value=mapped_score,
            unit="score",
            observed_at=now_utc,
            metadata={
                "article_count": len(feed),
                "raw_avg_score": round(avg_score, 4),
                "news_items": news_items, # Gemini 분석용 데이터
                "method": "alphavantage_news_sentiment"
            },
        )
    ]


def save_points(points: List[MarketPoint]) -> int:
    created_count = 0
    for point in points:
        RawMarketData.objects.create(
            source=point.source,
            symbol=point.symbol,
            observed_at=point.observed_at,
            value=point.value,
            unit=point.unit,
            metadata=point.metadata,
        )
        created_count += 1
    return created_count
