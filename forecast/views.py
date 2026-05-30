from datetime import timedelta
from decimal import Decimal

from django.db.models import Q
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from market_data.models import RawMarketData
from market_data.services.freshness import ensure_forecasts_fresh

from .models import PriceForecast
from .services.purchase_score import calculate_purchase_score


def _latest_news_sentiment_score():
    row = (
        RawMarketData.objects.filter(symbol="NEWS_SENTIMENT_SCORE")
        .order_by("-observed_at")
        .first()
    )
    return row.value if row else None


def _clamp(value, min_value, max_value):
    return max(min_value, min(max_value, value))


def _news_adjustment_rate(sentiment_score, horizon_days):
    if sentiment_score is None:
        return Decimal("0")

    clamped_score = _clamp(Decimal(str(sentiment_score)), Decimal("-3"), Decimal("3"))
    horizon_weight = Decimal(str(min(horizon_days, 7))) / Decimal("7")
    max_adjustment_rate = Decimal("0.015")
    return (clamped_score / Decimal("3")) * max_adjustment_rate * horizon_weight


def _with_news_adjusted_forecast(row, sentiment_score):
    baseline_price = row.predicted_price
    adjustment_rate = _news_adjustment_rate(sentiment_score, row.horizon_days)
    adjustment = (baseline_price * adjustment_rate).quantize(Decimal("0.0001"))
    adjusted_price = (baseline_price + adjustment).quantize(Decimal("0.0001"))

    return {
        "target_date": row.target_date,
        "horizon_days": row.horizon_days,
        "model_name": row.model_name,
        "predicted_price": row.predicted_price,
        "lower_bound": row.lower_bound,
        "upper_bound": row.upper_bound,
        "baseline_predicted_price": row.predicted_price,
        "news_adjusted_predicted_price": adjusted_price,
        "news_adjustment": adjustment,
        "news_adjustment_rate": round(float(adjustment_rate), 6),
    }


class ForecastView(APIView):
    def get(self, request):
        ensure_forecasts_fresh()

        horizon_param = request.query_params.get("horizon", "7d")
        try:
            horizon_days = int(horizon_param.lower().replace("d", ""))
        except ValueError:
            horizon_days = 7

        requested_horizons = [1, 3, 7]
        included_horizons = [day for day in requested_horizons if day <= horizon_days]
        if not included_horizons:
            included_horizons = [horizon_days]

        today = timezone.localdate()
        forecast_filter = Q()
        for day in included_horizons:
            forecast_filter |= Q(horizon_days=day, target_date=today + timedelta(days=day))

        rows = list(
            PriceForecast.objects.filter(forecast_filter)
            .order_by("horizon_days", "target_date")
        )
        news_sentiment_score = _latest_news_sentiment_score()
        predictions = [
            _with_news_adjusted_forecast(row, news_sentiment_score)
            for row in rows
        ]

        return Response(
            {
                "horizon": f"{horizon_days}d",
                "included_horizons": included_horizons,
                "news_sentiment_score": (
                    float(news_sentiment_score) if news_sentiment_score is not None else None
                ),
                "news_adjustment_method": (
                    "baseline_v1 price adjusted by latest NEWS_SENTIMENT_SCORE; "
                    "impact is capped at +/-1.5% for D+7 and scaled by horizon."
                ),
                "predictions": predictions,
                "message": "저장된 예측 결과 기반 응답입니다.",
            }
        )


class PurchaseScoreView(APIView):
    def get(self, request):
        ensure_forecasts_fresh()
        return Response(calculate_purchase_score())
