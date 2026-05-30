from datetime import timedelta
from decimal import Decimal
from math import sqrt
from typing import List, Optional

from django.utils import timezone

from forecast.models import PriceForecast
from market_data.models import RawMarketData


def _latest_base_price() -> Optional[Decimal]:
    domestic = (
        RawMarketData.objects.filter(symbol="DOMESTIC_GASOLINE_AVG")
        .order_by("-observed_at")
        .first()
    )
    if domestic:
        return domestic.value

    # Fallback: WTI(USD/barrel) * 환율 / 158.987(L per barrel)
    wti = RawMarketData.objects.filter(symbol="WTI").order_by("-observed_at").first()
    usdkrw = RawMarketData.objects.filter(symbol="USDKRW").order_by("-observed_at").first()
    if not wti or not usdkrw:
        return None

    return (wti.value * usdkrw.value) / Decimal("158.987")


def _recent_trend_per_day(limit: int = 7) -> Decimal:
    rows = list(
        RawMarketData.objects.filter(symbol="DOMESTIC_GASOLINE_AVG")
        .order_by("-observed_at")
        .values_list("value", flat=True)[:limit]
    )
    if len(rows) < 2:
        return Decimal("0")
    newest = Decimal(str(rows[0]))
    oldest = Decimal(str(rows[-1]))
    return (newest - oldest) / Decimal(str(max(len(rows) - 1, 1)))


def generate_baseline_forecasts(horizons: List[int]) -> int:
    base_price = _latest_base_price()
    if base_price is None:
        return 0

    trend = _recent_trend_per_day(limit=7)
    today = timezone.localdate()
    updated_count = 0

    for horizon in horizons:
        target_date = today + timedelta(days=horizon)
        predicted = base_price + (trend * Decimal(str(horizon)))
        band_ratio = Decimal("0.015") * Decimal(str(sqrt(horizon)))
        lower = predicted * (Decimal("1") - band_ratio)
        upper = predicted * (Decimal("1") + band_ratio)

        PriceForecast.objects.update_or_create(
            target_date=target_date,
            horizon_days=horizon,
            model_name="baseline_v1",
            defaults={
                "predicted_price": predicted.quantize(Decimal("0.0001")),
                "lower_bound": lower.quantize(Decimal("0.0001")),
                "upper_bound": upper.quantize(Decimal("0.0001")),
            },
        )
        updated_count += 1
    return updated_count
