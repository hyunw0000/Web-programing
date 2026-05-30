from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import RawMarketData
from .services.collectors import _news_sentiment_score


class RealtimeDashboardViewTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_returns_latest_values(self):
        now = timezone.now()
        RawMarketData.objects.create(
            source="yfinance",
            symbol="WTI",
            observed_at=now - timedelta(hours=1),
            value=Decimal("70.1111"),
            unit="USD/barrel",
            metadata={},
        )
        RawMarketData.objects.create(
            source="yfinance",
            symbol="WTI",
            observed_at=now,
            value=Decimal("71.2222"),
            unit="USD/barrel",
            metadata={},
        )

        response = self.client.get("/api/v1/dashboard/realtime")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["wti_usd"], 71.2222)


class NewsSentimentScoreTest(TestCase):
    def test_positive_news_score(self):
        score = _news_sentiment_score(
            title="중동 긴장 고조로 국제유가 상승",
            description="감산 가능성이 커지며 공급 차질 우려 확대",
        )
        self.assertGreater(score, 0)

    def test_negative_news_score(self):
        score = _news_sentiment_score(
            title="산유국 증산 합의로 유가 하락",
            description="공급 확대와 지정학 리스크 완화",
        )
        self.assertLess(score, 0)
