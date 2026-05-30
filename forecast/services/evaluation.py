from math import sqrt
from typing import Dict, List, Optional

from forecast.models import PriceForecast
from market_data.models import RawMarketData


def _actual_price_for_date(target_date) -> Optional[float]:
    row = (
        RawMarketData.objects.filter(symbol="DOMESTIC_GASOLINE_AVG", observed_at__date=target_date)
        .order_by("-observed_at")
        .first()
    )
    return float(row.value) if row else None


def build_forecast_pairs(horizon_days: Optional[int] = None) -> List[Dict[str, float]]:
    queryset = PriceForecast.objects.all().order_by("target_date")
    if horizon_days is not None:
        queryset = queryset.filter(horizon_days=horizon_days)

    pairs: List[Dict[str, float]] = []
    for fc in queryset:
        actual = _actual_price_for_date(fc.target_date)
        if actual is None:
            continue
        predicted = float(fc.predicted_price)
        error = predicted - actual
        pairs.append(
            {
                "predicted": predicted,
                "actual": actual,
                "error": error,
                "abs_error": abs(error),
                "squared_error": error * error,
                "ape": (abs(error) / actual) * 100 if actual != 0 else 0.0,
            }
        )
    return pairs


def calculate_metrics(pairs: List[Dict[str, float]]) -> Dict[str, float]:
    if not pairs:
        return {
            "count": 0,
            "mae": 0.0,
            "rmse": 0.0,
            "mape": 0.0,
        }

    count = len(pairs)
    mae = sum(item["abs_error"] for item in pairs) / count
    rmse = sqrt(sum(item["squared_error"] for item in pairs) / count)
    mape = sum(item["ape"] for item in pairs) / count
    return {
        "count": count,
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "mape": round(mape, 4),
    }
