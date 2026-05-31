import os
import requests
from datetime import datetime, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from market_data.models import RawMarketData
from django.utils import timezone

class Command(BaseCommand):
    help = "Collect historical gasoline data for the past 30 days."

    def handle(self, *args, **options):
        api_key = os.getenv("OPINET_API_KEY")
        if not api_key:
            self.stdout.write(self.style.ERROR("API Key not found"))
            return

        for i in range(1, 31): # 최근 30일
            target_date = (datetime.now() - timedelta(days=i)).strftime("%Y%m%d")
            url = "https://www.opinet.co.kr/api/avgAllPrice.do"
            params = {"out": "json", "code": api_key, "date": target_date}
            
            try:
                response = requests.get(url, params=params, timeout=10)
                payload = response.json()
                prices = payload.get("RESULT", {}).get("OIL", [])
                
                for item in prices:
                    if item.get("PRODCD") == "B027": # 휘발유 코드
                        price_str = item.get("PRICE")
                        if price_str:
                            price = Decimal(str(price_str))
                            # update_or_create를 사용하여 동일 날짜 데이터가 있으면 갱신, 없으면 생성
                            RawMarketData.objects.update_or_create(
                                symbol="DOMESTIC_GASOLINE_AVG",
                                observed_at=datetime.strptime(target_date, "%Y%m%d").replace(tzinfo=timezone.utc),
                                defaults={"value": price, "unit": "KRW/L", "source": "opinet"}
                            )
                self.stdout.write(self.style.SUCCESS(f"Collected data for {target_date}"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Failed {target_date}: {e}"))
