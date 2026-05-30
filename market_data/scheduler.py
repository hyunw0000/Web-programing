import logging
import os
from datetime import datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from django.core.management import call_command

logger = logging.getLogger(__name__)

_scheduler = None


def _collect_job():
    try:
        call_command("collect_market_data")
        call_command("generate_forecast")
        call_command("generate_briefing")
        call_command("evaluate_forecast")
        call_command("evaluate_alerts")
    except Exception as exc:
        logger.exception("Scheduled market data collection failed: %s", exc)


def start_scheduler():
    global _scheduler
    if _scheduler is not None:
        return

    interval_minutes = int(os.getenv("COLLECT_INTERVAL_MINUTES", "60"))
    scheduler = BackgroundScheduler(timezone="Asia/Seoul")
    scheduler.add_job(
        _collect_job,
        trigger="interval",
        minutes=interval_minutes,
        id="collect_market_data_job",
        max_instances=1,
        next_run_time=datetime.now(ZoneInfo("Asia/Seoul")),
        replace_existing=True,
    )
    scheduler.start()
    _scheduler = scheduler
    logger.info("Market data scheduler started: every %s minutes", interval_minutes)
