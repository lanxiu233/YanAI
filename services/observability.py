from __future__ import annotations

import contextlib
import contextvars
import re
import uuid
from collections.abc import Iterator
from typing import Any

_REQUEST_ID = contextvars.ContextVar("request_id", default="")
_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


def new_request_id() -> str:
    return uuid.uuid4().hex


def normalize_request_id(value: object) -> str:
    text = str(value or "").strip()
    if text and _REQUEST_ID_RE.match(text):
        return text
    return new_request_id()


def get_current_request_id(default: str = "") -> str:
    return _REQUEST_ID.get() or default


def set_current_request_id(request_id: object) -> contextvars.Token[str]:
    return _REQUEST_ID.set(normalize_request_id(request_id))


def reset_current_request_id(token: contextvars.Token[str]) -> None:
    _REQUEST_ID.reset(token)


@contextlib.contextmanager
def request_id_context(request_id: object) -> Iterator[str]:
    token = set_current_request_id(request_id)
    try:
        yield get_current_request_id()
    finally:
        reset_current_request_id(token)


def request_id_from_request(request: Any) -> str:
    state_request_id = str(getattr(getattr(request, "state", None), "request_id", "") or "").strip()
    if state_request_id:
        return state_request_id
    header_request_id = ""
    try:
        header_request_id = str(request.headers.get("x-request-id") or "").strip()
    except Exception:
        header_request_id = ""
    current = get_current_request_id()
    return normalize_request_id(header_request_id or current)
