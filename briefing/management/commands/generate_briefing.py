from django.core.management.base import BaseCommand

from briefing.services.generator import generate_market_briefing


class Command(BaseCommand):
    help = "Generate AI-style market briefing from collected data and forecasts."

    def handle(self, *args, **options):
        created = generate_market_briefing()
        if not created:
            self.stdout.write(
                self.style.WARNING("No briefing generated. Need market data or forecasts first.")
            )
            return
        self.stdout.write(self.style.SUCCESS("Market briefing generated successfully."))
