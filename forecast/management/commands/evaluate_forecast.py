from django.core.management.base import BaseCommand

from forecast.services.evaluation import build_forecast_pairs, calculate_metrics


class Command(BaseCommand):
    help = "Evaluate forecast performance with MAE, RMSE, and MAPE."

    def add_arguments(self, parser):
        parser.add_argument(
            "--horizon",
            type=int,
            default=None,
            help="Optional horizon filter in days (e.g. 1, 3, 7).",
        )

    def handle(self, *args, **options):
        horizon = options.get("horizon")
        pairs = build_forecast_pairs(horizon_days=horizon)
        metrics = calculate_metrics(pairs)

        if metrics["count"] == 0:
            self.stdout.write(
                self.style.WARNING("No comparable forecast/actual pairs found for evaluation.")
            )
            return

        scope = f"D+{horizon}" if horizon else "ALL"
        self.stdout.write(self.style.SUCCESS(f"[{scope}] Forecast evaluation complete"))
        self.stdout.write(f"count: {metrics['count']}")
        self.stdout.write(f"MAE: {metrics['mae']}")
        self.stdout.write(f"RMSE: {metrics['rmse']}")
        self.stdout.write(f"MAPE(%): {metrics['mape']}")
