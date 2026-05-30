from unittest.mock import patch

from datetime import timedelta
from decimal import Decimal

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from forecast.models import PriceForecast
from market_data.models import RawMarketData

from .models import MarketBriefing


class BriefingGenerationTest(TestCase):
    def setUp(self):
        now = timezone.now()
        RawMarketData.objects.create(
            source="news",
            symbol="NEWS_SENTIMENT_SCORE",
            observed_at=now,
            value=Decimal("0.8"),
            unit="score",
            metadata={},
        )
        RawMarketData.objects.create(
            source="yfinance",
            symbol="WTI",
            observed_at=now,
            value=Decimal("80.0"),
            unit="USD/barrel",
            metadata={},
        )
        RawMarketData.objects.create(
            source="yfinance",
            symbol="USDKRW",
            observed_at=now,
            value=Decimal("1380.0"),
            unit="KRW/USD",
            metadata={},
        )
        PriceForecast.objects.create(
            target_date=timezone.localdate() + timedelta(days=1),
            horizon_days=1,
            model_name="baseline_v1",
            predicted_price=Decimal("1710.0"),
            lower_bound=Decimal("1690.0"),
            upper_bound=Decimal("1730.0"),
        )

    def test_generate_briefing_command(self):
        call_command("generate_briefing")
        latest = MarketBriefing.objects.order_by("-created_at").first()
        self.assertIsNotNone(latest)
        self.assertEqual(latest.sentiment, "bullish")

    @patch("briefing.services.generator.generate_briefing_with_gemini")
    def test_generate_briefing_uses_gemini_when_available(self, mock_gemini):
        mock_gemini.return_value = {
            "title": "Gemini 브리핑",
            "summary": "Gemini가 생성한 요약입니다.",
            "sentiment": "bullish",
        }
        with patch("briefing.services.generator.is_configured", return_value=True):
            call_command("generate_briefing")

        latest = MarketBriefing.objects.order_by("-created_at").first()
        self.assertEqual(latest.title, "Gemini 브리핑")
        self.assertEqual(latest.summary, "Gemini가 생성한 요약입니다.")
        mock_gemini.assert_called_once()


class BriefingApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        MarketBriefing.objects.create(
            title="테스트 브리핑",
            summary="요약",
            sentiment="neutral",
            score=0.0,
            based_on_date=timezone.localdate(),
        )

    def test_latest_briefing_api(self):
        response = self.client.get("/api/v1/briefings/latest")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "테스트 브리핑")
