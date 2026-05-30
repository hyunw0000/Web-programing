from rest_framework.response import Response
from rest_framework.views import APIView

from market_data.services.freshness import ensure_briefing_fresh

from .models import MarketBriefing


class LatestBriefingView(APIView):
    def get(self, request):
        ensure_briefing_fresh()

        latest = MarketBriefing.objects.order_by("-created_at").first()
        if not latest:
            return Response(
                {
                    "title": "시장 브리핑 준비 중",
                    "summary": (
                        "시장 데이터 수집 후 브리핑을 생성합니다. "
                        "GEMINI_API_KEY를 설정하면 AI 브리핑이 자동 생성됩니다."
                    ),
                    "sentiment": "neutral",
                    "score": None,
                }
            )

        return Response(
            {
                "title": latest.title,
                "summary": latest.summary,
                "sentiment": latest.sentiment,
                "score": latest.score,
                "based_on_date": latest.based_on_date,
                "created_at": latest.created_at,
            }
        )
