import logging
import threading
from datetime import timedelta

from django.core.management import call_command
from django.utils import timezone

from briefing.models import MarketBriefing
from forecast.models import PriceForecast
from market_data.models import RawMarketData

logger = logging.getLogger(__name__)

_refresh_lock = threading.Lock()


def _has_today_market_data() -> bool:
    today = timezone.localdate()
    return RawMarketData.objects.filter(
        symbol__in=["WTI", "BRENT", "USDKRW", "DOMESTIC_GASOLINE_AVG"],
        observed_at__date=today,
    ).exists()


def _has_today_forecasts() -> bool:
    today = timezone.localdate()
    required = {
        (today + timedelta(days=horizon), horizon)
        for horizon in [1, 3, 7]
    }
    existing = set(
        PriceForecast.objects.filter(
            model_name="baseline_v1",
            horizon_days__in=[1, 3, 7],
            target_date__in=[target_date for target_date, _ in required],
        ).values_list("target_date", "horizon_days")
    )
    return required.issubset(existing)


def _has_today_briefing() -> bool:
    return MarketBriefing.objects.filter(based_on_date=timezone.localdate()).exists()


def _run_command(name: str) -> None:
    try:
        call_command(name)
    except Exception as exc:
        logger.exception("Automatic %s refresh failed: %s", name, exc)


def ensure_market_data_fresh() -> None:
    if _has_today_market_data():
        return

    if not _refresh_lock.acquire(blocking=False):
        return

    try:
        if not _has_today_market_data():
            _run_command("collect_market_data")
    finally:
        _refresh_lock.release()


def ensure_forecasts_fresh() -> None:
    if _has_today_forecasts():
        return

    if not _refresh_lock.acquire(blocking=False):
        return

    try:
        if not _has_today_market_data():
            _run_command("collect_market_data")
        if not _has_today_forecasts():
            _run_command("generate_forecast")
    finally:
        _refresh_lock.release()


def ensure_briefing_fresh() -> None:
    if _has_today_briefing():
        return

    if not _refresh_lock.acquire(blocking=False):
        return

    try:
        if not _has_today_market_data():
            _run_command("collect_market_data")
        if not _has_today_forecasts():
            _run_command("generate_forecast")
        if not _has_today_briefing():
            _run_command("generate_briefing")
    finally:
        _refresh_lock.release()
