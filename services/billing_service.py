from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import json
import re
import secrets
from pathlib import Path
from threading import RLock
from typing import Any
from urllib.parse import urlencode

from services.auth_service import auth_service
from services.config import DATA_DIR, config
from services.log_service import LOG_TYPE_AUDIT, log_service


ORDER_FILE = DATA_DIR / "payment_orders.json"
DEFAULT_GATEWAY_URL = "https://pay.gggua.com"
DEFAULT_PAYMENT_TYPE = "alipay"
PAYMENT_TYPE_ALIASES = {
    "aliapi": "alipay",
    "alipay": "alipay",
    "wxapi": "wxpay",
    "wechat": "wxpay",
    "weixin": "wxpay",
    "wxpay": "wxpay",
    "qqapi": "qqpay",
    "qqpay": "qqpay",
}
DEFAULT_PLANS = [
    {"id": "starter-100", "label": "100 点", "quota": 100, "price": "9.90", "enabled": True},
    {"id": "standard-500", "label": "500 点", "quota": 500, "price": "39.90", "enabled": True},
    {"id": "pro-1500", "label": "1500 点", "quota": 1500, "price": "99.90", "enabled": True},
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _clean(value: object) -> str:
    return str(value or "").strip()


def _money(value: object, default: str = "0.00") -> str:
    try:
        amount = Decimal(str(value or default)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        amount = Decimal(default).quantize(Decimal("0.01"))
    if amount < 0:
        amount = Decimal(default).quantize(Decimal("0.01"))
    return f"{amount:.2f}"


def _money_equal(left: object, right: object) -> bool:
    try:
        return Decimal(str(left)).quantize(Decimal("0.01")) == Decimal(str(right)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return False


def _quota(value: object, *fallback_sources: object) -> int:
    try:
        amount = int(value or 0)
    except (TypeError, ValueError):
        amount = 0
    if amount > 0:
        return amount
    for source in fallback_sources:
        match = re.search(r"(\d+)", str(source or ""))
        if match:
            return max(1, int(match.group(1)))
    return 1


def _payment_type(value: object) -> str:
    text = _clean(value).lower()
    return PAYMENT_TYPE_ALIASES.get(text, DEFAULT_PAYMENT_TYPE)


def _strict_payment_type(value: object) -> str:
    text = _clean(value).lower()
    if not text:
        return ""
    payment_type = PAYMENT_TYPE_ALIASES.get(text)
    if payment_type not in {"alipay", "wxpay"}:
        raise ValueError("unsupported payment type")
    return payment_type


def _is_local_callback_url(value: object) -> bool:
    text = _clean(value).lower()
    return any(host in text for host in ("127.0.0.1", "localhost", "::1"))


class BillingService:
    def __init__(self, path: Path = ORDER_FILE):
        self.path = path
        self.lock = RLock()
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def _load_orders(self) -> list[dict[str, Any]]:
        if not self.path.exists():
            return []
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            return []
        return data if isinstance(data, list) else []

    def _save_orders(self, orders: list[dict[str, Any]]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(orders, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def _raw_config(self) -> dict[str, Any]:
        raw = config._effective_data().get("billing")  # type: ignore[attr-defined]
        data = deepcopy(raw) if isinstance(raw, dict) else {}
        settings = data.get("settings") if isinstance(data.get("settings"), dict) else {}
        data["settings"] = {
            "enabled": bool(settings.get("enabled")),
            "gateway_url": _clean(settings.get("gateway_url")) or DEFAULT_GATEWAY_URL,
            "pid": _clean(settings.get("pid")),
            "key": _clean(settings.get("key")),
            "payment_type": _payment_type(settings.get("payment_type")),
            "notify_url": _clean(settings.get("notify_url")),
            "return_url": _clean(settings.get("return_url")),
            "frontend_url": _clean(settings.get("frontend_url")).rstrip("/"),
            "support_url": _clean(settings.get("support_url")),
        }
        data["plans"] = self._normalize_plans(data.get("plans"))
        return data

    def _normalize_plans(self, value: object) -> list[dict[str, Any]]:
        items = value if isinstance(value, list) else DEFAULT_PLANS
        normalized: list[dict[str, Any]] = []
        for index, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            plan_id = _clean(item.get("id")) or f"plan-{index + 1}"
            quota = _quota(item.get("quota") or item.get("amount"), item.get("label"), item.get("id"))
            normalized.append(
                {
                    "id": plan_id,
                    "label": _clean(item.get("label")) or f"{quota} 点",
                    "quota": quota,
                    "price": _money(item.get("price"), "1.00"),
                    "enabled": item.get("enabled") is not False,
                    "sort_order": int(item.get("sort_order") or index),
                }
            )
        return normalized or deepcopy(DEFAULT_PLANS)

    @staticmethod
    def public_config(data: dict[str, Any]) -> dict[str, Any]:
        settings = dict(data.get("settings") or {})
        key = _clean(settings.pop("key", ""))
        settings["key_set"] = bool(key)
        return {"settings": settings, "plans": data.get("plans") or []}

    def admin_config(self) -> dict[str, Any]:
        return self.public_config(self._raw_config())

    def _callback_base(self, request: Any | None = None) -> str:
        if config.base_url:
            return config.base_url
        if request is None:
            return ""
        return f"{request.url.scheme}://{request.headers.get('host', request.url.netloc)}"

    def _frontend_base(self, settings: dict[str, Any], request: Any | None = None) -> str:
        configured = _clean(settings.get("frontend_url")).rstrip("/")
        if configured:
            return configured
        return self._callback_base(request)

    def _payment_disabled_reason(self, settings: dict[str, Any], request: Any | None = None) -> str:
        if not settings.get("enabled"):
            return "管理员尚未开启在线充值"
        if not settings.get("pid") or not settings.get("key"):
            return "管理员尚未填写易支付商户 ID 或密钥"
        base = self._callback_base(request)
        frontend_base = self._frontend_base(settings, request)
        notify_url = _clean(settings.get("notify_url")) or (f"{base}/api/payment/easypay/notify" if base else "")
        return_url = _clean(settings.get("return_url")) or (f"{frontend_base}/profile" if frontend_base else "")
        if not notify_url or not return_url:
            return "管理员尚未配置支付回调地址"
        if _is_local_callback_url(notify_url) or _is_local_callback_url(return_url):
            return "支付回调地址必须是公网地址，请在管理端设置 notify_url 和 return_url"
        return ""

    def user_config(self, request: Any | None = None) -> dict[str, Any]:
        raw = self._raw_config()
        data = self.public_config(raw)
        public_settings = data.get("settings", {})
        raw_settings = raw.get("settings", {})
        disabled_reason = self._payment_disabled_reason(raw_settings, request)
        enabled = not disabled_reason
        return {
            "settings": {
                "enabled": enabled,
                "support_url": public_settings.get("support_url") or "",
                "disabled_reason": disabled_reason,
            },
            "plans": [plan for plan in data.get("plans", []) if plan.get("enabled")],
        }

    def update_admin_config(self, payload: dict[str, Any]) -> dict[str, Any]:
        current = self._raw_config()
        settings_payload = payload.get("settings") if isinstance(payload.get("settings"), dict) else {}
        next_settings = dict(current["settings"])
        for key in ("enabled", "gateway_url", "pid", "payment_type", "notify_url", "return_url", "frontend_url", "support_url"):
            if key in settings_payload:
                next_settings[key] = settings_payload.get(key)
        if _clean(settings_payload.get("key")):
            next_settings["key"] = _clean(settings_payload.get("key"))
        next_settings["enabled"] = bool(next_settings.get("enabled"))
        plans = self._normalize_plans(payload.get("plans") if "plans" in payload else current.get("plans"))
        config.update({"billing": {"settings": next_settings, "plans": plans}})
        return self.admin_config()

    def sign(self, params: dict[str, Any], key: str) -> str:
        pairs = []
        for name, value in params.items():
            text = _clean(value)
            if name in {"sign", "sign_type"} or text == "":
                continue
            pairs.append((name, text))
        source = "&".join(f"{name}={value}" for name, value in sorted(pairs, key=lambda item: item[0]))
        return hashlib.md5(f"{source}{key}".encode("utf-8")).hexdigest()

    def verify_sign(self, params: dict[str, Any]) -> bool:
        key = _clean(self._raw_config().get("settings", {}).get("key"))
        provided = _clean(params.get("sign")).lower()
        return bool(key and provided and provided == self.sign(params, key))

    def _plan_by_id(self, plan_id: str) -> dict[str, Any] | None:
        for plan in self._raw_config().get("plans", []):
            if plan.get("id") == plan_id and plan.get("enabled"):
                return plan
        return None

    def create_order(self, user: dict[str, Any], plan_id: str, *, request, payment_type: str = "") -> dict[str, Any]:
        billing = self._raw_config()
        settings = billing.get("settings", {})
        if not (settings.get("enabled") and settings.get("pid") and settings.get("key")):
            raise ValueError("payment is not configured")
        plan = self._plan_by_id(plan_id)
        if plan is None:
            raise ValueError("payment plan is unavailable")

        order_no = f"YAI{datetime.now().strftime('%Y%m%d%H%M%S')}{secrets.token_hex(4).upper()}"
        host_base = self._callback_base(request)
        frontend_base = self._frontend_base(settings, request)
        notify_url = _clean(settings.get("notify_url")) or f"{host_base}/api/payment/easypay/notify"
        return_url = _clean(settings.get("return_url")) or f"{frontend_base}/profile"
        if _is_local_callback_url(notify_url) or _is_local_callback_url(return_url):
            raise ValueError("支付回调地址必须是公网地址，请在管理端设置 notify_url 和 return_url")
        selected_payment_type = _strict_payment_type(payment_type) or _payment_type(settings.get("payment_type"))
        params = {
            "pid": settings["pid"],
            "type": selected_payment_type,
            "out_trade_no": order_no,
            "notify_url": notify_url,
            "return_url": return_url,
            "name": f"颜值AI {plan['label']}",
            "money": plan["price"],
            "sitename": "YanAI",
            "param": str(user.get("id") or ""),
            "sign_type": "MD5",
        }
        params["sign"] = self.sign(params, _clean(settings.get("key")))
        gateway = _clean(settings.get("gateway_url")) or DEFAULT_GATEWAY_URL
        pay_url = f"{gateway.rstrip('/')}/submit.php?{urlencode(params)}"

        order = {
            "id": order_no,
            "order_no": order_no,
            "trade_no": "",
            "user_id": str(user.get("id") or ""),
            "user_email": str(user.get("email") or ""),
            "plan_id": plan["id"],
            "plan_label": plan["label"],
            "payment_type": params["type"],
            "quota": int(plan["quota"]),
            "money": plan["price"],
            "status": "pending",
            "pay_url": pay_url,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        with self.lock:
            orders = self._load_orders()
            orders.insert(0, order)
            self._save_orders(orders)
        return order

    def list_orders(self, *, user_id: str = "", limit: int = 80) -> list[dict[str, Any]]:
        with self.lock:
            orders = self._load_orders()
        if user_id:
            orders = [item for item in orders if _clean(item.get("user_id")) == user_id]
        return orders[: max(1, min(200, limit))]

    def mark_paid_from_notify(self, params: dict[str, Any]) -> dict[str, Any]:
        if not self.verify_sign(params):
            raise ValueError("invalid payment signature")
        if _clean(params.get("trade_status")) != "TRADE_SUCCESS":
            raise ValueError("payment is not successful")
        order_no = _clean(params.get("out_trade_no"))
        if not order_no:
            raise ValueError("missing order number")

        with self.lock:
            orders = self._load_orders()
            index = next((idx for idx, item in enumerate(orders) if _clean(item.get("order_no")) == order_no), -1)
            if index < 0:
                raise ValueError("payment order not found")
            order = dict(orders[index])
            if not _money_equal(params.get("money"), order.get("money")):
                raise ValueError("payment amount mismatch")
            if order.get("status") == "paid":
                return order
            user = auth_service.adjust_user_quota(_clean(order.get("user_id")), int(order.get("quota") or 0), "add")
            if user is None:
                raise ValueError("payment user not found")
            order.update(
                {
                    "status": "paid",
                    "trade_no": _clean(params.get("trade_no")) or order.get("trade_no"),
                    "paid_at": _now_iso(),
                    "updated_at": _now_iso(),
                    "notify_payload": params,
                }
            )
            orders[index] = order
            self._save_orders(orders)
        log_service.add(
            LOG_TYPE_AUDIT,
            "payment order credited",
            {
                "order_no": order_no,
                "user_id": order.get("user_id"),
                "user_email": order.get("user_email"),
                "quota": order.get("quota"),
                "money": order.get("money"),
            },
        )
        return order


billing_service = BillingService()
