"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard, LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { BillingPlan, PaymentOrder } from "@/lib/api";

type PaymentType = "alipay" | "wxpay";

const PAYMENT_METHODS: Array<{ value: PaymentType; label: string; helper: string }> = [
  { value: "alipay", label: "支付宝", helper: "跳转支付宝收银台" },
  { value: "wxpay", label: "微信支付", helper: "跳转微信支付收银台" },
];

type RechargeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: BillingPlan[];
  orders: PaymentOrder[];
  paymentEnabled: boolean;
  supportUrl: string;
  paymentDisabledReason: string;
  payingPlanId: string;
  onCreatePayment: (plan: BillingPlan, paymentType: PaymentType) => void;
};

export function RechargeDialog({
  open,
  onOpenChange,
  plans,
  orders,
  paymentEnabled,
  supportUrl,
  paymentDisabledReason,
  payingPlanId,
  onCreatePayment,
}: RechargeDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);
  const [selectedPaymentType, setSelectedPaymentType] = useState<PaymentType>("alipay");

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setSelectedPlan(null);
      setSelectedPaymentType("alipay");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] w-[min(94vw,720px)] max-w-none overflow-hidden rounded-lg p-0">
        <DialogHeader className="border-b border-stone-200 px-5 pt-5 pb-4 sm:px-6">
          <DialogTitle className="text-xl font-semibold text-stone-950">额度充值</DialogTitle>
          <DialogDescription className="text-stone-500">
            套餐由平台统一配置。支付成功后会自动入账；兑换码仍在个人中心单独兑换。
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(92vh-106px)] space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          {!paymentEnabled ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              {paymentDisabledReason || "易支付接口尚未配置完成，暂时不能在线充值。"}
              {supportUrl ? (
                <a className="ml-2 font-medium underline" href={supportUrl} target="_blank" rel="noreferrer">
                  联系支持
                </a>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            {plans.map((plan) => {
              const pending = payingPlanId === plan.id;
              const selected = selectedPlan?.id === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  disabled={!paymentEnabled || pending}
                  onClick={() => setSelectedPlan(plan)}
                  className={[
                    "min-h-[142px] rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-55",
                    selected ? "border-rose-300 bg-rose-50 shadow-[0_14px_34px_rgba(244,63,94,0.12)]" : "border-stone-200 bg-white hover:border-rose-200 hover:bg-rose-50",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium text-stone-600">{plan.label}</div>
                    {selected ? <Badge variant="default" className="rounded-md bg-rose-500 text-white">已选</Badge> : null}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-stone-950">¥{plan.price}</div>
                  <div className="mt-3 text-xs text-stone-500">到账 {plan.quota} 点额度</div>
                  <div className={selected ? "mt-4 inline-flex h-9 items-center rounded-lg bg-rose-500 px-3 text-sm font-medium text-white" : "mt-4 inline-flex h-9 items-center rounded-lg bg-stone-950 px-3 text-sm font-medium text-white"}>
                    {pending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <CreditCard className="mr-2 size-4" />}
                    {selected ? "确认套餐" : "选择套餐"}
                  </div>
                </button>
              );
            })}
            {plans.length === 0 ? (
              <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-4 py-8 text-center text-sm text-stone-500 sm:col-span-3">
                暂无可购买套餐，请联系支持。
              </div>
            ) : null}
          </div>
          {selectedPlan ? (
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <div className="flex flex-col gap-2 border-b border-stone-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-stone-950">结算确认</div>
                  <div className="mt-1 text-sm text-stone-500">
                    {selectedPlan.label}，到账 {selectedPlan.quota} 点额度
                  </div>
                </div>
                <div className="text-2xl font-semibold text-stone-950">¥{selectedPlan.price}</div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {PAYMENT_METHODS.map((method) => {
                  const active = selectedPaymentType === method.value;
                  return (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setSelectedPaymentType(method.value)}
                      className={[
                        "flex min-h-16 items-center gap-3 rounded-lg border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200",
                        active ? "border-rose-300 bg-rose-50" : "border-stone-200 bg-white hover:border-stone-300",
                      ].join(" ")}
                    >
                      <span className={active ? "flex size-9 items-center justify-center rounded-lg bg-rose-500 text-sm font-semibold text-white" : "flex size-9 items-center justify-center rounded-lg bg-stone-100 text-sm font-semibold text-stone-600"}>
                        {method.value === "alipay" ? "支" : "微"}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-stone-900">{method.label}</span>
                        <span className="mt-0.5 block text-xs text-stone-500">{method.helper}</span>
                      </span>
                      {active ? <CheckCircle2 className="ml-auto size-4 shrink-0 text-rose-500" /> : null}
                    </button>
                  );
                })}
              </div>
              <Button
                className="mt-4 h-11 w-full rounded-xl bg-rose-500 text-white hover:bg-rose-600"
                onClick={() => onCreatePayment(selectedPlan, selectedPaymentType)}
                disabled={!paymentEnabled || payingPlanId === selectedPlan.id}
              >
                {payingPlanId === selectedPlan.id ? <LoaderCircle className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                确认支付并跳转
              </Button>
            </div>
          ) : null}
          {orders.length > 0 ? (
            <div className="rounded-lg border border-stone-200 bg-stone-50">
              <div className="border-b border-stone-200 px-4 py-3 text-sm font-medium text-stone-700">最近订单</div>
              <div className="divide-y divide-stone-200">
                {orders.slice(0, 4).map((order) => (
                  <div key={order.order_no} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-stone-800">{order.plan_label} · ¥{order.money}</div>
                      <div className="text-xs text-stone-500">{order.order_no}</div>
                    </div>
                    <Badge variant={order.status === "paid" ? "success" : "warning"}>{order.status === "paid" ? "已入账" : "待支付"}</Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
