"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  fetchAdminBilling,
  updateAdminBilling,
  type BillingPlan,
  type BillingSettings,
  type PaymentOrder,
} from "@/lib/api";

const emptySettings: BillingSettings = {
  enabled: false,
  gateway_url: "https://pay.gggua.com",
  pid: "",
  key: "",
  key_set: false,
  payment_type: "alipay",
  notify_url: "",
  return_url: "",
  frontend_url: "",
  support_url: "",
};

function newPlan(): BillingPlan {
  const id = `plan-${Date.now()}`;
  return { id, label: "新套餐", quota: 100, price: "9.90", enabled: true, sort_order: 0 };
}

export function PaymentSettingsCard() {
  const [settings, setSettings] = useState<BillingSettings>(emptySettings);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAdminBilling();
      setSettings({ ...emptySettings, ...data.settings, key: "" });
      setPlans(data.plans || []);
      setOrders(data.orders || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载支付设置失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const patchSettings = (updates: Partial<BillingSettings>) => {
    setSettings((current) => ({ ...current, ...updates }));
  };

  const patchPlan = (index: number, updates: Partial<BillingPlan>) => {
    setPlans((current) => current.map((plan, idx) => (idx === index ? { ...plan, ...updates } : plan)));
  };

  const publicUrlChecks = [
    {
      label: "商户参数",
      ok: Boolean(settings.pid && (settings.key || settings.key_set)),
      text: "PID 和 KEY 已配置",
      missing: "需要填写 PID 和 KEY",
    },
    {
      label: "通知地址",
      ok: Boolean(settings.notify_url),
      text: "已指定易支付异步通知地址",
      missing: "建议填写后端公网 notify_url",
    },
    {
      label: "返回地址",
      ok: Boolean(settings.return_url || settings.frontend_url),
      text: "已指定用户付款后返回地址",
      missing: "建议填写前端站点地址或 return_url",
    },
  ];

  const save = async () => {
    setIsSaving(true);
    try {
      const payloadPlans = plans.map((plan, index) => ({
        ...plan,
        id: String(plan.id || `plan-${index + 1}`).trim(),
        label: String(plan.label || "").trim() || `${Number(plan.quota) || 1} 点`,
        quota: Math.max(1, Number(plan.quota) || 1),
        price: String(plan.price || "0").trim(),
        sort_order: index,
      }));
      const data = await updateAdminBilling({
        settings: { ...settings, payment_type: String(settings.payment_type || "alipay").trim() || "alipay" },
        plans: payloadPlans,
      });
      setSettings({ ...emptySettings, ...data.settings, key: "" });
      setPlans(data.plans || []);
      setOrders(data.orders || []);
      toast.success("易支付设置已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存支付设置失败");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="rounded-lg border-white/80 bg-white/80 shadow-sm">
        <CardContent className="flex min-h-32 items-center justify-center p-6 text-sm text-stone-500">
          <LoaderCircle className="mr-2 size-4 animate-spin" />
          正在加载易支付设置
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-lg border-white/80 bg-white/80 shadow-sm">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold text-stone-950">
              <CreditCard className="size-5 text-rose-500" />
              易支付接口
            </div>
            <p className="mt-1 text-sm text-stone-500">配置商户信息、回调地址和用户可购买的额度套餐。</p>
          </div>
          <Button onClick={() => void save()} disabled={isSaving} className="h-10 rounded-xl bg-stone-950 px-4 text-white hover:bg-stone-800">
            {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            保存支付设置
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="flex items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
            <Checkbox checked={Boolean(settings.enabled)} onCheckedChange={(checked) => patchSettings({ enabled: Boolean(checked) })} />
            <span className="text-sm font-medium text-stone-700">启用易支付在线充值</span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-stone-500">支付网关</span>
            <Input value={settings.gateway_url || ""} onChange={(event) => patchSettings({ gateway_url: event.target.value })} className="h-10 rounded-xl border-stone-200 bg-stone-50" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-stone-500">商户 PID</span>
            <Input value={settings.pid || ""} onChange={(event) => patchSettings({ pid: event.target.value })} className="h-10 rounded-xl border-stone-200 bg-stone-50" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-stone-500">商户 KEY</span>
            <Input
              value={settings.key || ""}
              onChange={(event) => patchSettings({ key: event.target.value })}
              placeholder={settings.key_set ? "已保存，留空则不修改" : "易支付商户密钥"}
              className="h-10 rounded-xl border-stone-200 bg-stone-50"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-stone-500">支付类型</span>
            <Input value={settings.payment_type || "alipay"} onChange={(event) => patchSettings({ payment_type: event.target.value })} placeholder="alipay / wxpay / qqpay" className="h-10 rounded-xl border-stone-200 bg-stone-50" />
            <span className="block text-xs text-stone-400">用户在结算时选择支付宝或微信；这里仅作为兜底默认值。</span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-stone-500">支持链接</span>
            <Input value={settings.support_url || ""} onChange={(event) => patchSettings({ support_url: event.target.value })} className="h-10 rounded-xl border-stone-200 bg-stone-50" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-stone-500">异步通知地址</span>
            <Input value={settings.notify_url || ""} onChange={(event) => patchSettings({ notify_url: event.target.value })} placeholder="留空使用 /api/payment/easypay/notify" className="h-10 rounded-xl border-stone-200 bg-stone-50" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-stone-500">前端站点地址</span>
            <Input value={settings.frontend_url || ""} onChange={(event) => patchSettings({ frontend_url: event.target.value })} placeholder="https://www.your-site.com" className="h-10 rounded-xl border-stone-200 bg-stone-50" />
            <span className="block text-xs text-stone-400">前后端分离部署时必填，用于付款后回到用户个人中心。</span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-stone-500">支付返回地址</span>
            <Input value={settings.return_url || ""} onChange={(event) => patchSettings({ return_url: event.target.value })} placeholder="留空返回 /profile" className="h-10 rounded-xl border-stone-200 bg-stone-50" />
          </label>
        </div>

        <div className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 md:grid-cols-3">
          {publicUrlChecks.map((item) => (
            <div key={item.label} className="flex gap-3 rounded-md bg-white px-3 py-3">
              {item.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />}
              <div className="min-w-0">
                <div className="text-xs font-semibold text-stone-800">{item.label}</div>
                <div className="mt-1 text-xs leading-5 text-stone-500">{item.ok ? item.text : item.missing}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-stone-800">额度套餐</div>
            <Button type="button" variant="outline" onClick={() => setPlans((current) => [...current, newPlan()])} className="h-9 rounded-xl border-stone-200 bg-white px-3 text-stone-700">
              <Plus className="size-4" />
              添加套餐
            </Button>
          </div>
          <div className="space-y-3">
            {plans.map((plan, index) => (
              <div key={`${plan.id}-${index}`} className="grid gap-3 rounded-lg border border-stone-200 bg-white p-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_auto_auto] lg:items-end">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-stone-500">套餐名称</span>
                  <Input value={plan.label} onChange={(event) => patchPlan(index, { label: event.target.value })} placeholder="例如：标准包" className="h-10 rounded-xl border-stone-200" />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-stone-500">到账额度</span>
                  <Input value={String(plan.quota)} onChange={(event) => patchPlan(index, { quota: Number(event.target.value) || 0 })} placeholder="500" className="h-10 rounded-xl border-stone-200" />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-stone-500">售价</span>
                  <Input value={String(plan.price)} onChange={(event) => patchPlan(index, { price: event.target.value })} placeholder="39.90" className="h-10 rounded-xl border-stone-200" />
                </label>
                <label className="flex h-10 items-center gap-2 text-sm text-stone-600">
                  <Checkbox checked={plan.enabled !== false} onCheckedChange={(checked) => patchPlan(index, { enabled: Boolean(checked) })} />
                  启用
                </label>
                <Button type="button" variant="outline" onClick={() => setPlans((current) => current.filter((_, idx) => idx !== index))} className="h-10 rounded-xl border-rose-200 bg-white px-3 text-rose-600" aria-label="删除套餐" title="删除套餐">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {plans.length === 0 ? (
              <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
                还没有套餐。添加后用户才能在个人中心发起充值。
              </div>
            ) : null}
          </div>
        </div>

        {orders.length > 0 ? (
          <div className="rounded-lg border border-stone-200 bg-stone-50">
            <div className="border-b border-stone-200 px-4 py-3 text-sm font-medium text-stone-700">最近支付订单</div>
            <div className="divide-y divide-stone-200">
              {orders.slice(0, 6).map((order) => (
                <div key={order.order_no} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1.2fr_1fr_auto_auto] md:items-center">
                  <div className="min-w-0 truncate font-medium text-stone-800">{order.user_email || order.user_id}</div>
                  <div className="text-stone-500">{order.plan_label} · ¥{order.money}</div>
                  <div className="text-xs text-stone-400">{order.order_no}</div>
                  <Badge variant={order.status === "paid" ? "success" : "warning"}>{order.status === "paid" ? "已入账" : "待支付"}</Badge>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
