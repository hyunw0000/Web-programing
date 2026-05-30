from django.core.management.base import BaseCommand

from forecast.services.generator import generate_baseline_forecasts


class Command(BaseCommand):
    help = "Generate baseline forecasts for D+1, D+3, D+7."

    def handle(self, *args, **options):
        created = generate_baseline_forecasts([1, 3, 7])
        if created == 0:
            self.stdout.write(
                self.style.WARNING("No forecasts generated. Need market data first.")
            )
            return
        self.stdout.write(self.style.SUCCESS(f"Generated/updated {created} forecasts."))
