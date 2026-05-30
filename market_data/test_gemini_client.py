from unittest.mock import MagicMock, patch

from django.test import TestCase

from market_data.services.gemini_client import (
    generate_briefing,
    is_configured,
    score_news_items,
)


class GeminiClientTest(TestCase):
    def test_is_not_configured_without_api_key(self):
        with patch.dict("os.environ", {"GEMINI_API_KEY": ""}, clear=False):
            self.assertFalse(is_configured())

    def test_is_configured_with_api_key(self):
        with patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}, clear=False):
            self.assertTrue(is_configured())

    @patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}, clear=False)
    @patch("market_data.services.gemini_client._get_model")
    def test_score_news_items_parses_gemini_json(self, mock_get_model):
        mock_response = MagicMock()
        mock_response.text = '{"scores":[2,-1,1],"average":0.6667}'
        mock_get_model.return_value.generate_content.return_value = mock_response

        score = score_news_items([{"title": "유가 상승", "description": "중동 긴장"}])
        self.assertEqual(score, 0.6667)

    @patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}, clear=False)
    @patch("market_data.services.gemini_client._get_model")
    def test_generate_briefing_parses_gemini_json(self, mock_get_model):
        mock_response = MagicMock()
        mock_response.text = (
            '{"title":"2026-05-25 유가 브리핑",'
            '"summary":"내일 단가 상승 가능성이 있습니다.",'
            '"sentiment":"bullish"}'
        )
        mock_get_model.return_value.generate_content.return_value = mock_response

        result = generate_briefing(
            {
                "date": "2026-05-25",
                "wti": 80.0,
                "usdkrw": 1380.0,
                "domestic": 1700.0,
                "predicted_tomorrow": 1710.0,
                "forecast_range": "1690.0~1730.0",
                "news_sentiment_score": 0.8,
                "news_sentiment_label": "bullish",
            }
        )

        self.assertIsNotNone(result)
        self.assertEqual(result["sentiment"], "bullish")
        self.assertIn("브리핑", result["title"])
