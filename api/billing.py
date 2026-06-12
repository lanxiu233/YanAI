from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, ConfigDict, Field

from api.support import require_admin, require_identity
from services.billing_service import billing_service


class PaymentOrderRequest(BaseModel):
    plan_id: str = Field(default="")
    payment_type: Literal["", "alipay", "wxpay"] = Field(default="")


class BillingSettingsRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    settings: dict[str, Any] = Field(default_factory=dict)
    plans: list[dict[str, Any]] = Field(default_factory=list)


def _public_order(item: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in item.items() if key not in {"notify_payload"}}


def create_router() -> APIRouter:
    router = APIRouter()

    @router.get("/api/billing/plans")
    async def get_billing_plans(request: Request, authorization: str | None = Header(default=None)):
        identity = require_identity(authorization)
        if identity.get("role") != "user":
            raise HTTPException(status_code=403, detail={"error": "user permission required"})
        return billing_service.user_config(request=request)

    @router.get("/api/billing/orders")
    async def list_my_payment_orders(authorization: str | None = Header(default=None)):
        identity = require_identity(authorization)
        if identity.get("role") != "user":
            raise HTTPException(status_code=403, detail={"error": "user permission required"})
        return {
            "items": [
                _public_order(item)
                for item in billing_service.list_orders(user_id=str(identity.get("id") or ""), limit=50)
            ]
        }

    @router.post("/api/billing/orders")
    async def create_payment_order(
        body: PaymentOrderRequest,
        request: Request,
        authorization: str | None = Header(default=None),
    ):
        identity = require_identity(authorization)
        if identity.get("role") != "user":
            raise HTTPException(status_code=403, detail={"error": "user permission required"})
        try:
            order = billing_service.create_order(
                identity,
                body.plan_id,
                request=request,
                payment_type=body.payment_type,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
        except Exception as exc:
            raise HTTPException(status_code=502, detail={"error": str(exc)}) from exc
        return {"order": _public_order(order), "pay_url": order.get("pay_url")}

    @router.get("/api/admin/billing")
    async def get_admin_billing(authorization: str | None = Header(default=None)):
        require_admin(authorization)
        return {
            **billing_service.admin_config(),
            "orders": [_public_order(item) for item in billing_service.list_orders(limit=100)],
        }

    @router.post("/api/admin/billing")
    async def update_admin_billing(body: BillingSettingsRequest, authorization: str | None = Header(default=None)):
        require_admin(authorization)
        try:
            billing = billing_service.update_admin_config(body.model_dump(mode="python"))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
        return {
            **billing,
            "orders": [_public_order(item) for item in billing_service.list_orders(limit=100)],
        }

    @router.api_route("/api/payment/easypay/notify", methods=["GET", "POST"])
    async def easypay_notify(request: Request):
        payload = dict(request.query_params)
        if request.method == "POST":
            form = await request.form()
            payload.update({key: str(value) for key, value in form.items()})
        try:
            billing_service.mark_paid_from_notify(payload)
        except ValueError:
            return PlainTextResponse("fail")
        return PlainTextResponse("success")

    return router
