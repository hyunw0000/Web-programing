from datetime import timedelta
from datetime import datetime
from decimal import Decimal

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from market_data.models import RawMarketData

from .models import PriceForecast
from .services.evaluation import build_forecast_pairs, calculate_metrics


class ForecastGenerationTest(TestCase):
    def setUp(self):
        now = timezone.now()
        RawMarketData.objects.create(
            source="opinet",
            symbol="DOMESTIC_GASOLINE_AVG",
            observed_at=now - timedelta(days=1),
            value=Decimal("1690.0"),
            unit="KRW/L",
            metadata={},
        )
        RawMarketData.objects.create(
            source="opinet",
            symbol="DOMESTIC_GASOLINE_AVG",
            observed_at=now,
            value=Decimal("1700.0"),
            unit="KRW/L",
            metadata={},
        )

    def test_generate_forecast_command(self):
        call_command("generate_forecast")
        self.assertEqual(
            PriceForecast.objects.filter(model_name="baseline_v1").count(),
            3,
        )


class ForecastApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        PriceForecast.objects.create(
            target_date=timezone.localdate() + timedelta(days=1),
            horizon_days=1,
            model_name="baseline_v1",
            predicted_price=Decimal("1704.1000"),
            lower_bound=Decimal("1685.0000"),
            upper_bound=Decimal("1720.0000"),
        )
        PriceForecast.objects.create(
            target_date=timezone.localdate() + timedelta(days=3),
            horizon_days=3,
            model_name="baseline_v1",
            predicted_price=Decimal("1708.1000"),
            lower_bound=Decimal("1688.0000"),
            upper_bound=Decimal("1726.0000"),
        )
        PriceForecast.objects.create(
            target_date=timezone.localdate() + timedelta(days=7),
            horizon_days=7,
            model_name="baseline_v1",
            predicted_price=Decimal("1712.1000"),
            lower_bound=Decimal("1690.0000"),
            upper_bound=Decimal("1730.0000"),
        )

    def test_forecast_api_returns_rows(self):
        RawMarketData.objects.create(
            source="news",
            symbol="NEWS_SENTIMENT_SCORE",
            observed_at=timezone.now(),
            value=Decimal("1.5000"),
            unit="score",
            metadata={},
        )
        response = self.client.get("/api/v1/forecast?horizon=7d")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["included_horizons"], [1, 3, 7])
        self.assertEqual(len(response.data["predictions"]), 3)
        self.assertEqual(response.data["news_sentiment_score"], 1.5)
        self.assertIn("news_adjustment_method", response.data)

        d7_prediction = response.data["predictions"][-1]
        self.assertIn("baseline_predicted_price", d7_prediction)
        self.assertIn("news_adjusted_predicted_price", d7_prediction)
        self.assertGreater(
            Decimal(str(d7_prediction["news_adjusted_predicted_price"])),
            Decimal(str(d7_prediction["baseline_predicted_price"])),
        )

    def test_forecast_api_can_filter_single_day(self):
        response = self.client.get("/api/v1/forecast?horizon=1d")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["included_horizons"], [1])
        self.assertEqual(len(response.data["predictions"]), 1)

    def test_purchase_score_api_returns_payload(self):
        RawMarketData.objects.create(
            source="opinet",
            symbol="DOMESTIC_GASOLINE_AVG",
            observed_at=timezone.now(),
            value=Decimal("1700.0000"),
            unit="KRW/L",
            metadata={},
        )
        PriceForecast.objects.create(
            target_date=timezone.localdate() + timedelta(days=1),
            horizon_days=1,
            model_name="baseline_v1",
            predicted_price=Decimal("1710.0000"),
            lower_bound=Decimal("1690.0000"),
            upper_bound=Decimal("1730.0000"),
        )
        PriceForecast.objects.create(
            target_date=timezone.localdate() + timedelta(days=3),
            horizon_days=3,
            model_name="baseline_v1",
            predicted_price=Decimal("1720.0000"),
            lower_bound=Decimal("1700.0000"),
            upper_bound=Decimal("1740.0000"),
        )
        response = self.client.get("/api/v1/purchase-score")
        self.assertEqual(response.status_code, 200)
        self.assertIn("score", response.data)
        self.assertIn("action", response.data)


class ForecastEvaluationTest(TestCase):
    def setUp(self):
        base_date = timezone.localdate() - timedelta(days=1)
        PriceForecast.objects.create(
            target_date=base_date,
            horizon_days=1,
            model_name="baseline_v1",
            predicted_price=Decimal("1700.0000"),
            lower_bound=Decimal("1680.0000"),
            upper_bound=Decimal("1720.0000"),
        )
        RawMarketData.objects.create(
            source="opinet",
            symbol="DOMESTIC_GASOLINE_AVG",
            observed_at=timezone.make_aware(datetime.combine(base_date, datetime.min.time())),
            value=Decimal("1690.0000"),
            unit="KRW/L",
            metadata={},
        )

    def test_evaluation_metrics_computed(self):
        pairs = build_forecast_pairs(horizon_days=1)
        metrics = calculate_metrics(pairs)
        self.assertEqual(metrics["count"], 1)
        self.assertGreater(metrics["mae"], 0)
