from unittest.mock import MagicMock, patch

from django.test import TestCase

from market_data.services.gemini_client import (
    chat_with_data,
    generate_briefing,
    is_configured,
    score_news_items,
)


class GeminiClientTest(TestCase):
    @patch("market_data.services.gemini_client._load_runtime_env")
    def test_is_not_configured_without_api_key(self, mock_load_runtime_env):
        with patch.dict("os.environ", {"GEMINI_API_KEY": ""}, clear=False):
            self.assertFalse(is_configured())

    @patch("market_data.services.gemini_client._load_runtime_env")
    def test_is_configured_with_api_key(self, mock_load_runtime_env):
        with patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}, clear=False):
            self.assertTrue(is_configured())

    @patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}, clear=False)
    @patch("market_data.services.gemini_client._load_runtime_env")
    @patch("market_data.services.gemini_client._get_model")
    def test_score_news_items_parses_gemini_json(self, mock_get_model, mock_load_runtime_env):
        mock_response = MagicMock()
        mock_response.text = '{"scores":[2,-1,1],"average":0.6667}'
        mock_get_model.return_value.generate_content.return_value = mock_response

        score = score_news_items([{"title": "유가 상승", "description": "중동 긴장"}])
        self.assertEqual(score, 0.6667)

    @patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}, clear=False)
    @patch("market_data.services.gemini_client._load_runtime_env")
    @patch("market_data.services.gemini_client._get_model")
    def test_generate_briefing_parses_gemini_json(self, mock_get_model, mock_load_runtime_env):
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

    @patch.dict(
        "os.environ",
        {
            "GEMINI_API_KEY": "",
            "OPENAI_API_KEY": "openai-test-key",
            "OPENAI_MODEL": "test-openai-model",
        },
        clear=False,
    )
    @patch("market_data.services.gemini_client._load_runtime_env")
    @patch("market_data.services.gemini_client.requests.post")
    def test_chat_uses_openai_when_gemini_is_not_configured(
        self, mock_post, mock_load_runtime_env
    ):
        mock_response = MagicMock()
        mock_response.json.return_value = {"output_text": "OpenAI fallback 응답"}
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        result = chat_with_data("오늘 사야 해?", {"wti": 80, "domestic": 1700})

        self.assertEqual(result, "OpenAI fallback 응답")
        mock_post.assert_called_once()
        self.assertEqual(mock_post.call_args.kwargs["json"]["model"], "test-openai-model")

    @patch.dict(
        "os.environ",
        {
            "GEMINI_API_KEY": "gemini-test-key",
            "OPENAI_API_KEY": "openai-test-key",
        },
        clear=False,
    )
    @patch("market_data.services.gemini_client._load_runtime_env")
    @patch("market_data.services.gemini_client.requests.post")
    @patch("market_data.services.gemini_client._get_model")
    def test_chat_falls_back_to_openai_when_gemini_fails(
        self, mock_get_model, mock_post, mock_load_runtime_env
    ):
        mock_get_model.return_value.generate_content.side_effect = RuntimeError("gemini down")
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "output": [
                {
                    "content": [
                        {"type": "output_text", "text": "Gemini 실패 후 OpenAI 응답"}
                    ]
                }
            ]
        }
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        result = chat_with_data("전망 알려줘", {"wti": 80, "domestic": 1700})

        self.assertEqual(result, "Gemini 실패 후 OpenAI 응답")
        mock_post.assert_called_once()
