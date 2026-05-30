from rest_framework.response import Response
from rest_framework.views import APIView

from .models import RawMarketData
from .services.freshness import ensure_market_data_fresh


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
