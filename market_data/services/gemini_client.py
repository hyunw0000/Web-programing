import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"


def get_api_key() -> str:
    return os.getenv("GEMINI_API_KEY", "").strip()


def get_model_name() -> str:
    return os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL).strip() or DEFAULT_GEMINI_MODEL


def is_configured() -> bool:
    return bool(get_api_key())


def _get_model():
    import google.generativeai as genai

    genai.configure(api_key=get_api_key())
    return genai.GenerativeModel(get_model_name())


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    cleaned = (text or "").strip()
    if not cleaned:
        return None

    try:
        payload = json.loads(cleaned)
        if isinstance(payload, dict):
            return payload
    except json.JSONDecodeError:
        pass

    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
    if fenced:
        try:
            payload = json.loads(fenced.group(1).strip())
            if isinstance(payload, dict):
                return payload
        except json.JSONDecodeError:
            pass

    brace = re.search(r"\{[\s\S]*\}", cleaned)
    if brace:
        try:
            payload = json.loads(brace.group(0))
            if isinstance(payload, dict):
                return payload
        except json.JSONDecodeError:
            pass

    return None


def _normalize_sentiment(value: Any) -> str:
    normalized = str(value or "neutral").strip().lower()
    if normalized in {"bullish", "bearish", "neutral"}:
        return normalized
    if normalized in {"상승", "긍정", "positive", "up"}:
        return "bullish"
    if normalized in {"하락", "부정", "negative", "down"}:
        return "bearish"
    return "neutral"


def _clamp_score(value: float, minimum: float = -3.0, maximum: float = 3.0) -> float:
    return max(minimum, min(maximum, value))


def score_news_items(news_items: List[dict]) -> Optional[float]:
    if not is_configured() or not news_items:
        return None

    headlines = []
    for index, item in enumerate(news_items[:20], start=1):
        title = re.sub(r"<[^>]+>", "", item.get("title", ""))
        description = re.sub(r"<[^>]+>", "", item.get("description", ""))
        headlines.append(f"{index}. {title} | {description}")

    prompt = (
        "You analyze Korean oil-market news for gas station purchase decisions.\n"
        "Score each headline from -3 to +3:\n"
        "- positive score: factors that may raise domestic gasoline prices\n"
        "- negative score: factors that may lower domestic gasoline prices\n"
        "- 0: neutral or unclear\n\n"
        "Headlines:\n"
        + "\n".join(headlines)
        + "\n\nReturn JSON only with this shape:\n"
        '{"scores":[number,...],"average":number}\n'
        "The average must be the mean of scores."
    )

    try:
        response = _get_model().generate_content(prompt)
        payload = _extract_json(getattr(response, "text", "") or "")
        if not payload:
            return None

        if payload.get("average") is not None:
            return round(_clamp_score(float(payload["average"])), 4)

        scores = payload.get("scores") or []
        numeric_scores = [_clamp_score(float(score)) for score in scores if score is not None]
        if not numeric_scores:
            return None
        return round(sum(numeric_scores) / len(numeric_scores), 4)
    except Exception as exc:
        logger.warning("Gemini news sentiment failed: %s", exc)
        return None


def generate_briefing(context: Dict[str, Any]) -> Optional[Dict[str, str]]:
    if not is_configured():
        return None

    prompt = (
        "You are an AI energy market analyst writing a daily briefing for Korean gas station owners.\n"
        "Use the structured data below and write in natural Korean.\n"
        "Keep the summary concise (3-5 sentences) and actionable.\n\n"
        f"Date: {context.get('date')}\n"
        f"WTI (USD/barrel): {context.get('wti')}\n"
        f"USD/KRW: {context.get('usdkrw')}\n"
        f"Domestic gasoline avg (KRW/L): {context.get('domestic')}\n"
        f"Tomorrow forecast (KRW/L): {context.get('predicted_tomorrow')}\n"
        f"Forecast range (KRW/L): {context.get('forecast_range')}\n"
        f"News sentiment score (-3 to +3): {context.get('news_sentiment_score')}\n"
        f"News sentiment label: {context.get('news_sentiment_label')}\n\n"
        "Return JSON only with this shape:\n"
        '{"title":"...", "summary":"...", "sentiment":"bullish|bearish|neutral"}'
    )

    try:
        response = _get_model().generate_content(prompt)
        payload = _extract_json(getattr(response, "text", "") or "")
        if not payload:
            return None

        title = str(payload.get("title", "")).strip()
        summary = str(payload.get("summary", "")).strip()
        if not title or not summary:
            return None

        return {
            "title": title[:200],
            "summary": summary,
            "sentiment": _normalize_sentiment(payload.get("sentiment")),
        }
    except Exception as exc:
        logger.warning("Gemini briefing generation failed: %s", exc)
        return None
