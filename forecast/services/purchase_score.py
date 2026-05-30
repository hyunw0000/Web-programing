from datetime import timedelta
from decimal import Decimal
from typing import Dict, Optional

from django.utils import timezone

from forecast.models import PriceForecast
from market_data.models import RawMarketData


def _latest_domestic_price() -> Optional[Decimal]:
    row = (
        RawMarketData.objects.filter(symbol="DOMESTIC_GASOLINE_AVG")
        .order_by("-observed_at")
        .first()
    )
    return row.value if row else None


def calculate_purchase_score() -> Dict:
    current_price = _latest_domestic_price()
    if current_price is None:
        return {
            "score": None,
            "action": "insufficient_data",
            "reason": "국내 평균 휘발유 데이터가 없습니다.",
            "current_price": None,
            "predicted_tomorrow": None,
            "predicted_3d": None,
        }

    tomorrow_date = timezone.localdate() + timedelta(days=1)
    d3_date = timezone.localdate() + timedelta(days=3)

    tomorrow_fc = (
        PriceForecast.objects.filter(target_date=tomorrow_date, horizon_days=1)
        .order_by("-created_at")
        .first()
    )
    d3_fc = (
        PriceForecast.objects.filter(target_date=d3_date, horizon_days=3)
        .order_by("-created_at")
        .first()
    )

    predicted_tomorrow = tomorrow_fc.predicted_price if tomorrow_fc else current_price
    predicted_3d = d3_fc.predicted_price if d3_fc else predicted_tomorrow

    diff_tomorrow = predicted_tomorrow - current_price
    diff_3d = predicted_3d - current_price
    weighted_diff = (diff_tomorrow * Decimal("0.6")) + (diff_3d * Decimal("0.4"))

    raw_score = 50 + (weighted_diff * Decimal("2.5"))
    score = max(0, min(100, int(round(float(raw_score)))))

    if score >= 70:
        action = "buy_today"
        reason = "단기 상승 가능성이 높아 오늘 선구매가 유리합니다."
    elif score <= 40:
        action = "wait"
        reason = "단기 하락 가능성이 있어 관망 전략이 유리합니다."
    else:
        action = "split_buy"
        reason = "방향성이 혼조라 분할 매수가 안전합니다."

    return {
        "score": score,
        "action": action,
        "reason": reason,
        "current_price": float(current_price),
        "predicted_tomorrow": float(predicted_tomorrow),
        "predicted_3d": float(predicted_3d),
    }
