from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from forecast.models import PriceForecast
from market_data.models import RawMarketData

from .models import AlertHistory, AlertRule


class AlertApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_create_and_list_rule(self):
        res = self.client.post(
            "/api/v1/alerts/rules",
            {"name": "상승 10원", "rule_type": "rise", "threshold": "10.00", "enabled": True},
            format="json",
        )
        self.assertEqual(res.status_code, 201)

        list_res = self.client.get("/api/v1/alerts/rules")
        self.assertEqual(list_res.status_code, 200)
        self.assertEqual(len(list_res.data), 1)

    def test_evaluate_alerts_creates_history(self):
        AlertRule.objects.create(name="상승 10원", rule_type="rise", threshold=Decimal("10.00"))
        RawMarketData.objects.create(
            source="opinet",
            symbol="DOMESTIC_GASOLINE_AVG",
            observed_at=timezone.now(),
            value=Decimal("1700.00"),
            unit="KRW/L",
            metadata={},
        )
        PriceForecast.objects.create(
            target_date=timezone.localdate() + timedelta(days=1),
            horizon_days=1,
            model_name="baseline_v1",
            predicted_price=Decimal("1715.00"),
            lower_bound=Decimal("1700.00"),
            upper_bound=Decimal("1730.00"),
        )
        res = self.client.post("/api/v1/alerts/evaluate")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(AlertHistory.objects.count(), 1)


class EndToEndFlowTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_full_decision_flow(self):
        now = timezone.now()
        RawMarketData.objects.create(
            source="opinet",
            symbol="DOMESTIC_GASOLINE_AVG",
            observed_at=now - timedelta(days=1),
            value=Decimal("1690.00"),
            unit="KRW/L",
            metadata={},
        )
        RawMarketData.objects.create(
            source="opinet",
            symbol="DOMESTIC_GASOLINE_AVG",
            observed_at=now,
            value=Decimal("1700.00"),
            unit="KRW/L",
            metadata={},
        )
        RawMarketData.objects.create(
            source="news",
            symbol="NEWS_SENTIMENT_SCORE",
            observed_at=now,
            value=Decimal("0.70"),
            unit="score",
            metadata={},
        )

        self.client.post(
            "/api/v1/alerts/rules",
            {"name": "상승 10원", "rule_type": "rise", "threshold": "10.00", "enabled": True},
            format="json",
        )

        # 1) 예측 생성
        self.client.post("/api/v1/alerts/evaluate")
        from django.core.management import call_command

        call_command("generate_forecast")
        call_command("generate_briefing")
        call_command("evaluate_alerts")

        # 2) 대시보드 핵심 API 검증
        realtime_res = self.client.get("/api/v1/dashboard/realtime")
        forecast_res = self.client.get("/api/v1/forecast?horizon=1d")
        score_res = self.client.get("/api/v1/purchase-score")
        briefing_res = self.client.get("/api/v1/briefings/latest")
        history_res = self.client.get("/api/v1/alerts/history")

        self.assertEqual(realtime_res.status_code, 200)
        self.assertEqual(forecast_res.status_code, 200)
        self.assertEqual(score_res.status_code, 200)
        self.assertEqual(briefing_res.status_code, 200)
        self.assertEqual(history_res.status_code, 200)

        self.assertGreaterEqual(len(forecast_res.data.get("predictions", [])), 1)
        self.assertIn("score", score_res.data)
        self.assertIn("sentiment", briefing_res.data)
