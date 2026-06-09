"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle2, Copy, Gift, KeyRound, LoaderCircle, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  checkInToday,
  createMyUserKey,
  deleteMyUserKey,
  fetchMe,
  fetchMyCheckinStatus,
  fetchMyUserKeys,
  redeemMyCode,
  updateMyProfile,
  updateMyUserKey,
  type CheckinStatus,
  type CurrentUser,
  type UserKey,
} from "@/lib/api";
import { useAuthGuard } from "@/lib/use-auth-guard";

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function ProfileContent() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checkin, setCheckin] = useState<CheckinStatus | null>(null);
  const [keys, setKeys] = useState<UserKey[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [keyName, setKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
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
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoaderCircle className="size-5 animate-spin text-rose-400" />
      </div>
    );
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

      <Card className="rounded-lg border-white/80 bg-white/80 shadow-sm">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-stone-100">
                <KeyRound className="size-5 text-stone-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">个人 API Key</h2>
                <p className="text-sm leading-6 text-stone-500">使用个人 key 调用图片接口时，会消耗当前账号额度。</p>
              </div>
            </div>
          </div>

          {revealedKey ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
              <div className="font-medium">新 key 仅展示一次，请立即保存。</div>
              <div className="mt-3 flex flex-col gap-3 rounded-lg border border-emerald-200 bg-white/80 p-3 md:flex-row md:items-center md:justify-between">
                <code className="break-all font-mono text-[13px]">{revealedKey}</code>
                <Button type="button" variant="outline" className="h-10 rounded-xl border-emerald-200 bg-white px-4 text-emerald-700" onClick={() => void handleCopy(revealedKey)}>
                  <Copy className="size-4" />
                  复制
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input value={keyName} onChange={(event) => setKeyName(event.target.value)} placeholder="例如：本机脚本、设计工具调用" className="h-11 rounded-xl border-stone-200 bg-white" />
            <Button className="h-11 rounded-xl bg-stone-950 text-white hover:bg-stone-800" onClick={() => void handleCreateKey()} disabled={isCreatingKey}>
              {isCreatingKey ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              创建 Key
            </Button>
          </div>

          {keys.length === 0 ? (
            <div className="rounded-xl bg-stone-50 px-6 py-8 text-center text-sm text-stone-500">
              暂无个人 API Key。
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((item) => {
                const pending = pendingKeyIds.has(item.id);
                return (
                  <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white px-4 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-medium text-stone-800">{item.name || "未命名 Key"}</div>
                        <Badge variant={item.enabled ? "success" : "secondary"} className="rounded-md">
                          {item.enabled ? "已启用" : "已停用"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                        <span>创建 {formatDateTime(item.created_at)}</span>
                        <span>最近使用 {formatDateTime(item.last_used_at)}</span>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 md:flex md:items-center">
                      <Button type="button" variant="outline" className="h-10 rounded-xl border-stone-200 bg-white px-4 text-stone-700" onClick={() => void handleToggleKey(item)} disabled={pending}>
                        {pending ? <LoaderCircle className="size-4 animate-spin" /> : item.enabled ? <Ban className="size-4" /> : <CheckCircle2 className="size-4" />}
                        {item.enabled ? "停用" : "启用"}
                      </Button>
                      <Button type="button" variant="outline" className="h-10 rounded-xl border-rose-200 bg-white px-4 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => void handleDeleteKey(item)} disabled={pending}>
                        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                        删除
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export default function ProfilePage() {
  const { isCheckingAuth, session } = useAuthGuard(["user"]);
  if (isCheckingAuth || !session) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoaderCircle className="size-5 animate-spin text-rose-400" />
      </div>
    );
  }
  return <ProfileContent />;
}
