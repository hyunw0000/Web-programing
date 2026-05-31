from django.core.management.base import BaseCommand

from market_data.services.collectors import (
    collect_opinet_points,
    collect_yfinance_points,
    save_points,
)


class Command(BaseCommand):
    help = "Collect market data from yfinance and Opinet."

    def handle(self, *args, **options):
        points = []
        points.extend(collect_yfinance_points())
        points.extend(collect_opinet_points())

        if not points:
            self.stdout.write(
                self.style.WARNING("No market points collected. Check network/provider status.")
            )
            return

        saved = save_points(points)
        self.stdout.write(self.style.SUCCESS(f"Saved {saved} market data points from all sources."))
