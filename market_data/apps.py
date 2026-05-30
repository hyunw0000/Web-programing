import os

from django.apps import AppConfig


class MarketDataConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "market_data"

    def ready(self):
        # Django dev server auto-reloader starts app twice.
        if os.environ.get("RUN_MAIN") != "true":
            return

        from .scheduler import start_scheduler

        start_scheduler()
