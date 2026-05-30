from datetime import timedelta
from decimal import Decimal
from typing import Optional

from django.utils import timezone

from briefing.models import MarketBriefing
from forecast.models import PriceForecast
from market_data.models import RawMarketData
from market_data.services.gemini_client import generate_briefing as generate_briefing_with_gemini
from market_data.services.gemini_client import is_configured


def _latest_value(symbol: str) -> Optional[Decimal]:
    row = RawMarketData.objects.filter(symbol=symbol).order_by("-observed_at").first()
    return row.value if row else None


def _get_sentiment(score: float) -> str:
    if score >= 0.3:
        return "bullish"
    if score <= -0.3:
        return "bearish"
    return "neutral"


def _build_rule_based_briefing(
    today,
    sentiment: str,
    sentiment_score: float,
    wti: Optional[Decimal],
    usdkrw: Optional[Decimal],
    domestic: Optional[Decimal],
    tomorrow_fc,
) -> dict:
    summary_parts = []
    if sentiment == "bullish":
        summary_parts.append("뉴스 기반 수급 심리는 상승 요인이 우세합니다.")
    elif sentiment == "bearish":
        summary_parts.append("뉴스 기반 수급 심리는 하락 요인이 우세합니다.")
    else:
        summary_parts.append("뉴스 기반 수급 심리는 중립 구간입니다.")

    if wti is not None and usdkrw is not None:
        summary_parts.append(
            f"WTI {float(wti):.2f}$, 환율 {float(usdkrw):.2f}원으로 원가 변동성이 존재합니다."
        )

    if domestic is not None:
        summary_parts.append(f"국내 평균 휘발유 기준가는 {float(domestic):.2f}원/L 수준입니다.")

    if tomorrow_fc:
        summary_parts.append(
            "내일 예측가는 "
            f"{float(tomorrow_fc.predicted_price):.2f}원/L "
            f"(범위 {float(tomorrow_fc.lower_bound):.2f}~{float(tomorrow_fc.upper_bound):.2f})입니다."
        )

    return {
        "title": f"{today} 유가 시장 브리핑",
        "summary": " ".join(summary_parts),
        "sentiment": sentiment,
        "score": round(sentiment_score, 4),
        "source": "rule_based",
    }


def generate_market_briefing() -> bool:
    today = timezone.localdate()
    tomorrow = today + timedelta(days=1)

    sentiment_raw = _latest_value("NEWS_SENTIMENT_SCORE")
    sentiment_score = float(sentiment_raw) if sentiment_raw is not None else 0.0
    sentiment = _get_sentiment(sentiment_score)

    wti = _latest_value("WTI")
    usdkrw = _latest_value("USDKRW")
    domestic = _latest_value("DOMESTIC_GASOLINE_AVG")

    tomorrow_fc = (
        PriceForecast.objects.filter(target_date=tomorrow, horizon_days=1)
        .order_by("-created_at")
        .first()
    )

    if not any([wti, usdkrw, domestic, tomorrow_fc]):
        return False

    forecast_range = None
    predicted_tomorrow = None
    if tomorrow_fc:
        predicted_tomorrow = float(tomorrow_fc.predicted_price)
        forecast_range = (
            f"{float(tomorrow_fc.lower_bound):.2f}~{float(tomorrow_fc.upper_bound):.2f}"
        )

    briefing_payload = None
    if is_configured():
        briefing_payload = generate_briefing_with_gemini(
            {
                "date": str(today),
                "wti": float(wti) if wti is not None else None,
                "usdkrw": float(usdkrw) if usdkrw is not None else None,
                "domestic": float(domestic) if domestic is not None else None,
                "predicted_tomorrow": predicted_tomorrow,
                "forecast_range": forecast_range,
                "news_sentiment_score": sentiment_score,
                "news_sentiment_label": sentiment,
            }
        )

    if not briefing_payload:
        briefing_payload = _build_rule_based_briefing(
            today=today,
            sentiment=sentiment,
            sentiment_score=sentiment_score,
            wti=wti,
            usdkrw=usdkrw,
            domestic=domestic,
            tomorrow_fc=tomorrow_fc,
        )

    MarketBriefing.objects.create(
        title=briefing_payload["title"],
        summary=briefing_payload["summary"],
        sentiment=briefing_payload.get("sentiment", sentiment),
        score=briefing_payload.get("score", round(sentiment_score, 4)),
        based_on_date=today,
    )
    return True
