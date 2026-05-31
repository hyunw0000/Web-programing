from django.core.management import call_command
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import RawMarketData
from .services.freshness import ensure_market_data_fresh
from .services import gemini_client


class ChatView(APIView):
    def post(self, request):
        user_message = request.data.get("message")
        if not user_message:
            return Response({"error": "메시지를 입력해주세요."}, status=400)

        wti = RawMarketData.objects.filter(symbol="WTI").order_by("-observed_at").first()
        domestic = RawMarketData.objects.filter(symbol="DOMESTIC_GASOLINE_AVG").order_by("-observed_at").first()
        
        context = {
            "wti": float(wti.value) if wti else "unknown",
            "domestic": float(domestic.value) if domestic else "unknown",
            "sentiment": "neutral",
        }

        ai_response = gemini_client.chat_with_data(user_message, context)
        return Response({"response": ai_response})


class RealtimeDashboardView(APIView):
    def get(self, request):
        ensure_market_data_fresh()

        latest_by_symbol = {}
        for symbol in ["WTI", "BRENT", "USDKRW", "DOMESTIC_GASOLINE_AVG"]:
            latest = RawMarketData.objects.filter(symbol=symbol).order_by("-observed_at").first()
            latest_by_symbol[symbol] = float(latest.value) if latest else None

        return Response(
            {
                "wti_usd": latest_by_symbol["WTI"],
                "brent_usd": latest_by_symbol["BRENT"],
                "usd_krw": latest_by_symbol["USDKRW"],
                "domestic_avg_gasoline_krw": latest_by_symbol["DOMESTIC_GASOLINE_AVG"],
                "message": "저장된 최신 시장 데이터 기반 응답입니다.",
            }
        )


class DashboardRefreshView(APIView):
    def post(self, request):
        steps = [
            ("collect_market_data", "market_data"),
            ("generate_forecast", "forecast"),
            ("generate_briefing", "briefing"),
        ]
        results = {}

        for command_name, result_key in steps:
            try:
                call_command(command_name)
                results[result_key] = "ok"
            except Exception as exc:
                results[result_key] = "failed"
                return Response(
                    {
                        "message": "최신 데이터 갱신에 실패했습니다.",
                        "failed_step": result_key,
                        "error": str(exc),
                        "results": results,
                    },
                    status=500,
                )

        return Response(
            {
                "message": "최신 데이터 갱신이 완료되었습니다.",
                "results": results,
            }
        )
