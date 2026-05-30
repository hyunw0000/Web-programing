from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from forecast.models import PriceForecast
from market_data.models import RawMarketData

from .models import AlertHistory, AlertRule


def evaluate_alert_rules() -> int:
    current_row = (
        RawMarketData.objects.filter(symbol="DOMESTIC_GASOLINE_AVG")
        .order_by("-observed_at")
        .first()
    )
    if not current_row:
        return 0

    tomorrow = timezone.localdate() + timedelta(days=1)
    fc = (
        PriceForecast.objects.filter(target_date=tomorrow, horizon_days=1)
        .order_by("-created_at")
        .first()
    )
    if not fc:
        return 0

    current_price = current_row.value
    predicted_price = fc.predicted_price
    diff = predicted_price - current_price
    triggered = 0

    for rule in AlertRule.objects.filter(enabled=True):
        threshold = Decimal(str(rule.threshold))
        hit = (rule.rule_type == "rise" and diff >= threshold) or (
            rule.rule_type == "drop" and diff <= (-threshold)
        )
        if not hit:
            continue
        AlertHistory.objects.create(
            rule=rule,
            current_price=current_price,
            predicted_price=predicted_price,
            message=f"[{rule.name}] 알림 조건 충족: 현재 {current_price}, 예측 {predicted_price}",
        )
        triggered += 1

    return triggered
