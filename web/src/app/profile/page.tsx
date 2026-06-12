"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Gift, LoaderCircle, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  checkInToday,
  createPaymentOrder,
  createMyUserKey,
  deleteMyUserKey,
  fetchBillingPlans,
  fetchMe,
  fetchMyCheckinStatus,
  fetchMyUserKeys,
  fetchMyPaymentOrders,
  redeemMyCode,
  updateMyProfile,
  updateMyUserKey,
  type BillingPlan,
  type CheckinStatus,
  type CurrentUser,
  type PaymentOrder,
  type UserKey,
} from "@/lib/api";
import { useAuthGuard } from "@/lib/use-auth-guard";
import { ApiUsagePanel } from "./components/api-usage-panel";
import { RechargeDialog } from "./components/recharge-dialog";

type PaymentType = "alipay" | "wxpay";

function ProfileSkeleton() {
  return (
    <section className="mx-auto w-full max-w-5xl space-y-5">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded-full bg-rose-100" />
        <div className="h-8 w-32 rounded-lg bg-stone-100" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-40 rounded-lg border border-white/80 bg-white/70 p-6 shadow-sm md:col-span-2">
          <div className="h-4 w-20 rounded-full bg-stone-100" />
          <div className="mt-3 h-6 w-64 max-w-full rounded-lg bg-stone-100" />
          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="h-11 rounded-xl bg-stone-100" />
            <div className="h-11 rounded-xl bg-rose-100 sm:w-28" />
          </div>
        </div>
        <div className="h-56 rounded-lg border border-white/80 bg-white/70 p-6 shadow-sm">
          <div className="size-11 rounded-xl bg-rose-100" />
          <div className="mt-5 h-4 w-20 rounded-full bg-stone-100" />
          <div className="mt-3 h-10 w-24 rounded-lg bg-rose-100" />
          <div className="mt-5 h-10 rounded-xl bg-stone-100" />
        </div>
      </div>
      <div className="h-28 rounded-lg border border-white/80 bg-white/70 shadow-sm" />
      <div className="h-72 rounded-lg border border-white/80 bg-white/70 shadow-sm" />
    </section>
  );
}

function ProfileContent() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checkin, setCheckin] = useState<CheckinStatus | null>(null);
  const [keys, setKeys] = useState<UserKey[]>([]);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [supportUrl, setSupportUrl] = useState("");
  const [paymentDisabledReason, setPaymentDisabledReason] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [keyName, setKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [payingPlanId, setPayingPlanId] = useState("");
  const [pendingKeyIds, setPendingKeyIds] = useState<Set<string>>(() => new Set());

  const checkinRange = useMemo(() => {
    if (!checkin) return "1-5";
    return `${checkin.min_quota}-${checkin.max_quota}`;
  }, [checkin]);

  const load = async () => {
    setIsLoading(true);
    try {
      const [meData, checkinData, keyData] = await Promise.all([
        fetchMe(),
        fetchMyCheckinStatus(),
        fetchMyUserKeys(),
      ]);
      setUser(meData.user);
      setName(meData.user.name || "");
      setCheckin(checkinData.checkin);
      setKeys(keyData.items);
      void Promise.all([fetchBillingPlans(), fetchMyPaymentOrders()])
        .then(([billingData, orderData]) => {
          setPlans(billingData.plans || []);
          setPaymentEnabled(Boolean(billingData.settings?.enabled));
          setSupportUrl(String(billingData.settings?.support_url || ""));
          setPaymentDisabledReason(String(billingData.settings?.disabled_reason || ""));
          setOrders(orderData.items || []);
        })
        .catch(() => {
          setPlans([]);
          setPaymentEnabled(false);
          setSupportUrl("");
          setPaymentDisabledReason("支付配置加载失败，请稍后重试");
          setOrders([]);
        });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载个人信息失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data = await updateMyProfile({ name: name.trim() });
      setUser(data.user);
      toast.success("资料已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    try {
      const data = await checkInToday();
      setUser(data.user);
      setCheckin(data.checkin);
      toast.success(data.checked_in ? `签到成功，获得 ${data.amount} 点额度` : "今天已经签到过了");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "签到失败");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleRedeem = async () => {
    try {
      const data = await redeemMyCode(code.trim());
      setUser(data.user);
      setCode("");
      toast.success(`兑换成功，增加 ${data.redeem_code.quota} 点额度`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "兑换失败");
    }
  };

  const handleCreatePayment = async (plan: BillingPlan, paymentType: PaymentType) => {
    setPayingPlanId(plan.id);
    try {
      const data = await createPaymentOrder(plan.id, paymentType);
      if (!data.pay_url) {
        toast.error("支付链接生成失败，请联系支持");
        return;
      }
      window.location.assign(data.pay_url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建支付订单失败");
    } finally {
      setPayingPlanId("");
    }
  };

  const handleCreateKey = async () => {
    setIsCreatingKey(true);
    try {
      const data = await createMyUserKey(keyName.trim());
      setKeys(data.items);
      setRevealedKey(data.key);
      setKeyName("");
      toast.success("API Key 已创建");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建 API Key 失败");
    } finally {
      setIsCreatingKey(false);
    }
  };

  const setKeyPending = (id: string, pending: boolean) => {
    setPendingKeyIds((current) => {
      const next = new Set(current);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleToggleKey = async (item: UserKey) => {
    setKeyPending(item.id, true);
    try {
      const data = await updateMyUserKey(item.id, { enabled: !item.enabled });
      setKeys(data.items);
      toast.success(item.enabled ? "API Key 已停用" : "API Key 已启用");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新 API Key 失败");
    } finally {
      setKeyPending(item.id, false);
    }
  };

  const handleDeleteKey = async (item: UserKey) => {
    setKeyPending(item.id, true);
    try {
      const data = await deleteMyUserKey(item.id);
      setKeys(data.items);
      toast.success("API Key 已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除 API Key 失败");
    } finally {
      setKeyPending(item.id, false);
    }
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5">
      <div className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-400">Profile</div>
        <h1 className="text-2xl font-semibold tracking-tight">个人中心</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-lg border-white/80 bg-white/80 shadow-sm md:col-span-2">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-stone-500">当前账号</div>
                <div className="mt-1 truncate text-lg font-semibold text-stone-950">{user?.email}</div>
              </div>
              <Badge variant={user?.status === "disabled" ? "secondary" : "success"}>
                {user?.status === "disabled" ? "已停用" : "正常"}
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="昵称" className="h-11 rounded-xl border-rose-100 bg-white" />
              <Button className="h-11 rounded-xl bg-rose-500 text-white hover:bg-rose-600" onClick={() => void handleSave()} disabled={isSaving}>
                {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                保存资料
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-white/80 bg-white/80 shadow-sm">
          <CardContent className="space-y-3 p-6">
            <div className="w-fit rounded-xl bg-rose-50 p-3 text-rose-500">
              <Sparkles className="size-5" />
            </div>
            <div className="text-sm text-stone-500">可用额度</div>
            <div className="text-4xl font-semibold text-rose-600">{user?.quota ?? 0}</div>
            <div className="text-xs text-stone-400">已消耗 {user?.spent_quota ?? user?.quota_used ?? 0} 点</div>
            <Button className="h-10 w-full rounded-xl bg-stone-950 text-white hover:bg-stone-800" onClick={() => setRechargeOpen(true)}>
              <CreditCard className="size-4" />
              额度充值
            </Button>
            <Button className="h-10 w-full rounded-xl bg-stone-950 text-white hover:bg-stone-800" onClick={() => void handleCheckIn()} disabled={isCheckingIn || checkin?.claimed_today}>
              {isCheckingIn ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {checkin?.claimed_today ? "今日已签到" : `签到领 ${checkinRange} 点`}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg border-white/80 bg-white/80 shadow-sm">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
            <Gift className="size-4 text-rose-500" />
            兑换额度
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="输入兑换码" className="h-11 rounded-xl border-rose-100 bg-white uppercase" />
            <Button className="h-11 rounded-xl bg-rose-500 text-white hover:bg-rose-600" onClick={() => void handleRedeem()}>
              立即兑换
            </Button>
          </div>
        </CardContent>
      </Card>

      <ApiUsagePanel
        keys={keys}
        revealedKey={revealedKey}
        keyName={keyName}
        isCreatingKey={isCreatingKey}
        pendingKeyIds={pendingKeyIds}
        onKeyNameChange={setKeyName}
        onCreateKey={() => void handleCreateKey()}
        onToggleKey={(item) => void handleToggleKey(item)}
        onDeleteKey={(item) => void handleDeleteKey(item)}
        onCopy={(value) => void handleCopy(value)}
      />

      <RechargeDialog
        open={rechargeOpen}
        onOpenChange={setRechargeOpen}
        plans={plans}
        orders={orders}
        paymentEnabled={paymentEnabled}
        supportUrl={supportUrl}
        paymentDisabledReason={paymentDisabledReason}
        payingPlanId={payingPlanId}
        onCreatePayment={(plan, paymentType) => void handleCreatePayment(plan, paymentType)}
      />
    </section>
  );
}

export default function ProfilePage() {
  const { isCheckingAuth, session } = useAuthGuard(["user"]);
  if (isCheckingAuth || !session) {
    return <ProfileSkeleton />;
  }
  return <ProfileContent />;
}
