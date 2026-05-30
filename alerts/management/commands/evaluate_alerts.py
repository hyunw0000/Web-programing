from django.core.management.base import BaseCommand

from alerts.services import evaluate_alert_rules


class Command(BaseCommand):
    help = "Evaluate alert rules and store triggered history."

    def handle(self, *args, **options):
        triggered = evaluate_alert_rules()
        self.stdout.write(self.style.SUCCESS(f"Triggered alerts: {triggered}"))
