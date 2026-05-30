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

        # B027(휘발유)를 대시보드 핵심 지표로 우선 저장.
        symbol = "DOMESTIC_GASOLINE_AVG" if product_code == "B027" else "OPINET_" + product_code
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


def _news_sentiment_score(title: str, description: str) -> int:
    text = (title + " " + description).lower()
    positive_words = ["감산", "긴장", "불안", "제재", "공급 차질", "급등", "상승"]
    negative_words = ["증산", "안정", "완화", "휴전", "공급 확대", "급락", "하락"]

    score = 0
    for word in positive_words:
        if word in text:
            score += 1
    for word in negative_words:
        if word in text:
            score -= 1
    return score


def collect_naver_news_sentiment_point() -> List[MarketPoint]:
    client_id = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")
    if not client_id or not client_secret:
        return []

    headers = {
        "X-Naver-Client-Id": client_id,
        "X-Naver-Client-Secret": client_secret,
    }
    params = {
        "query": "유가 OR 석유 OR 중동 정세",
        "display": 20,
        "sort": "date",
    }

    try:
        response = requests.get(
            "https://openapi.naver.com/v1/search/news.json",
            headers=headers,
            params=params,
            timeout=10,
        )
        response.raise_for_status()
        payload = response.json()
    except Exception:
        return []

    items = payload.get("items", [])
    if not items:
        return []

    now_utc = datetime.now(timezone.utc)
    metadata = {"news_count": len(items)}

    if is_configured():
        gemini_score = score_news_items(items)
        if gemini_score is not None:
            metadata["sentiment_method"] = "gemini"
            return [
                MarketPoint(
                    source="news",
                    symbol="NEWS_SENTIMENT_SCORE",
                    value=Decimal(str(gemini_score)),
                    unit="score",
                    observed_at=now_utc,
                    metadata=metadata,
                )
            ]

    scores = []
    for item in items:
        scores.append(_news_sentiment_score(item.get("title", ""), item.get("description", "")))

    avg_score = Decimal(str(round(sum(scores) / len(scores), 4)))
    metadata["sentiment_method"] = "keyword_fallback"
    return [
        MarketPoint(
            source="news",
            symbol="NEWS_SENTIMENT_SCORE",
            value=avg_score,
            unit="score",
            observed_at=now_utc,
            metadata=metadata,
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
