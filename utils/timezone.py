from __future__ import annotations

from datetime import datetime, timedelta, timezone


CHINA_TIMEZONE = timezone(timedelta(hours=8), "Asia/Shanghai")
DISPLAY_TIME_FORMAT = "%Y-%m-%d %H:%M:%S"


def china_now_text() -> str:
    return datetime.now(CHINA_TIMEZONE).strftime(DISPLAY_TIME_FORMAT)


def china_timestamp_text(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, tz=CHINA_TIMEZONE).strftime(DISPLAY_TIME_FORMAT)
