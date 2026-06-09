"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Image, KeyRound, LoaderCircle, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import webConfig from "@/constants/common-env";
import { fetchRegisterOptions, login, type RegisterOptions } from "@/lib/api";
import { useRedirectIfAuthenticated } from "@/lib/use-auth-guard";
import { cn } from "@/lib/utils";
import { getDefaultRouteForRole, setStoredAuthSession } from "@/store/auth";

type LoginMode = "user" | "admin";

const inputClass =
  "h-11 rounded-xl border-rose-100 bg-white/90 px-3 text-sm text-stone-900 shadow-[0_1px_0_rgba(84,38,62,0.04)] placeholder:text-stone-400 focus-visible:ring-rose-200";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authKey, setAuthKey] = useState("");
  const [registerOptions, setRegisterOptions] = useState<RegisterOptions | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isCheckingAuth } = useRedirectIfAuthenticated();

  useEffect(() => {
    void fetchRegisterOptions()
      .then(setRegisterOptions)
      .catch(() => setRegisterOptions(null));
  }, []);

  const startLinuxDoOAuth = () => {
    const startPath = registerOptions?.linuxdo_start_url || "/auth/linuxdo/start";
    const apiBase = webConfig.apiUrl.replace(/\/$/, "");
    window.location.href = `${apiBase}${startPath}`;
  };

  const handleLogin = async () => {
    setIsSubmitting(true);
    try {
      const data =
        mode === "admin"
          ? await login(authKey.trim())
          : await login({ email: email.trim(), password });
      const sessionKey = mode === "admin" ? authKey.trim() : data.token || "";
      if (!sessionKey) {
        throw new Error("登录未返回有效会话");
      }
      await setStoredAuthSession({
        key: sessionKey,
        role: data.role,
        subjectId: data.subject_id,
        name: data.name,
        email: data.email,
        quota: data.quota,
      });
      router.replace(getDefaultRouteForRole(data.role));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "登录失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="grid min-h-[100dvh] w-full place-items-center px-4 py-6">
        <LoaderCircle className="size-5 animate-spin text-rose-400" />
      </div>
    );
  }

  return (
    <div className="relative isolate grid min-h-[100dvh] w-full place-items-center overflow-x-hidden px-4 py-6 sm:py-8">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_15%_12%,rgba(243,111,159,0.18),transparent_30%),radial-gradient(circle_at_85%_22%,rgba(202,164,232,0.16),transparent_28%),linear-gradient(135deg,#fff8fb_0%,#f7eef2_48%,#f6f1ea_100%)]" />
      <div className="yan-soft-grid absolute inset-0 -z-10 opacity-60" />

      <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/75 bg-white/80 shadow-[0_28px_90px_rgba(84,38,62,0.12)] backdrop-blur-xl lg:grid-cols-[400px_minmax(0,1fr)]">
        <section className="relative flex min-h-[430px] flex-col justify-between overflow-hidden border-b border-white/45 bg-[#2d1d26] p-5 text-white sm:min-h-[520px] sm:p-6 lg:min-h-[600px] lg:border-b-0 lg:border-r lg:p-8">
          <div className="absolute -right-24 -top-20 h-56 w-56 rounded-full bg-rose-400/24 blur-3xl" />
          <div className="absolute bottom-6 left-8 h-44 w-44 rounded-full bg-[#d5aa61]/14 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_38%)]" />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs font-medium text-white/74">
              <Sparkles className="size-3.5" />
              画图工作台
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs font-medium text-white/62">
              <ShieldCheck className="size-3.5" />
              登录态恢复
            </div>
          </div>

          <div className="relative z-10 mt-5 rounded-[26px] border border-white/12 bg-white/[0.08] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:mt-6 sm:p-4 lg:mt-8 lg:rounded-[30px]">
            <div className="rounded-[22px] border border-white/65 bg-[#fbf6f8] p-3 text-[#2d1d26] shadow-[0_18px_42px_rgba(0,0,0,0.14)] sm:p-4 lg:rounded-[24px]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-rose-300" />
                  <span className="size-2.5 rounded-full bg-[#d5aa61]/75" />
                  <span className="size-2.5 rounded-full bg-[#caa4e8]/75" />
                </div>
                <div className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-stone-500 shadow-sm">
                  gpt-image-2
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-rose-100 bg-white p-3 sm:mt-5">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-rose-600">
                  <Sparkles className="size-3.5" />
                  提示词草稿
                </div>
                <div className="space-y-2">
                  <div className="h-2.5 w-full rounded-full bg-[#2d1d26]/78" />
                  <div className="h-2.5 w-4/5 rounded-full bg-[#2d1d26]/16" />
                  <div className="h-2.5 w-2/3 rounded-full bg-[#2d1d26]/12" />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-[1.15fr_0.85fr] gap-3">
                <div className="relative min-h-36 overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_34%_22%,rgba(255,255,255,0.9),transparent_28%),linear-gradient(135deg,#fee2e2_0%,#fb7185_45%,#2d1d26_100%)] sm:min-h-48">
                  <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/25 bg-black/24 p-3 backdrop-blur-md">
                    <div className="h-2 w-16 rounded-full bg-white/75" />
                    <div className="mt-2 h-2 w-24 rounded-full bg-white/38" />
                  </div>
                </div>
                <div className="grid gap-3">
                  <div className="rounded-2xl bg-[#2d1d26] p-3 text-white">
                    <Image className="size-4 text-rose-200" />
                    <div className="mt-6 h-2 w-14 rounded-full bg-white/55" />
                    <div className="mt-2 h-2 w-20 rounded-full bg-white/25" />
                  </div>
                  <div className="rounded-2xl border border-rose-100 bg-white p-3">
                    <Bell className="size-4 text-rose-500" />
                    <div className="mt-5 h-2 w-16 rounded-full bg-stone-300" />
                    <div className="mt-2 h-2 w-10 rounded-full bg-stone-200" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-white/70 sm:text-xs">
              {[
                ["队列", "自动续跑"],
                ["作品", "归档同步"],
                ["提示词", "收藏复用"],
              ].map(([title, label]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.08] px-2.5 py-2 sm:px-3 sm:py-2.5">
                  <div className="font-medium text-white">{title}</div>
                  <div className="mt-1 text-[11px] text-white/48">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 mt-7 max-w-[19rem]">
            <h2 className="text-xl font-semibold leading-tight tracking-tight">回到上次的创作现场</h2>
            <p className="mt-3 text-sm leading-7 text-white/64">
              登录后恢复作品、参考图、提示词和通知状态，不需要重新整理工作区。
            </p>
          </div>
        </section>

        <Card className="border-0 bg-white/90 shadow-none">
          <CardContent className="mx-auto flex w-full max-w-[440px] flex-col justify-center space-y-6 p-6 sm:min-h-[600px] sm:p-10">
            <div className="flex items-center gap-3 lg:hidden">
              <span className="yan-mark-gradient grid size-10 place-items-center rounded-xl text-sm font-black text-white shadow-[0_14px_30px_rgba(243,111,159,0.22)]">
                颜
              </span>
              <div className="leading-tight">
                <div className="text-base font-semibold text-stone-950">颜值AI</div>
                <div className="text-xs text-stone-500">Image Studio</div>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-semibold tracking-tight text-stone-950">登录工作台</h1>
              <p className="text-sm leading-6 text-stone-600">选择个人账号或管理员密钥，进入对应的创作与管理界面。</p>
            </div>

            <div className="grid grid-cols-2 rounded-2xl border border-rose-100 bg-rose-50/75 p-1 text-sm font-medium">
              {[
                { value: "user" as const, label: "个人登录", icon: Mail },
                { value: "admin" as const, label: "管理员", icon: KeyRound },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={mode === item.value}
                    className={cn(
                      "flex h-10 items-center justify-center gap-2 rounded-xl transition active:scale-[0.98]",
                      mode === item.value
                        ? "bg-white text-rose-600 shadow-sm"
                        : "text-stone-500 hover:bg-white/50 hover:text-stone-800",
                    )}
                    onClick={() => setMode(item.value)}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void handleLogin();
              }}
            >
              {mode === "user" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="login-email" className="text-sm font-medium text-stone-800">
                      邮箱
                    </label>
                    <Input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="name@example.com"
                      autoComplete="email"
                      required
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="login-password" className="text-sm font-medium text-stone-800">
                      密码
                    </label>
                    <Input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="输入账号密码"
                      autoComplete="current-password"
                      required
                      className={inputClass}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label htmlFor="admin-auth-key" className="text-sm font-medium text-stone-800">
                    管理员密钥
                  </label>
                  <Input
                    id="admin-auth-key"
                    type="password"
                    value={authKey}
                    onChange={(event) => setAuthKey(event.target.value)}
                    placeholder="输入管理员 auth key"
                    autoComplete="off"
                    required
                    className={inputClass}
                  />
                  <p className="text-xs leading-5 text-stone-500">仅管理员使用，登录后进入用户、账号池和系统设置。</p>
                </div>
              )}

              <Button
                type="submit"
                className="h-11 w-full rounded-xl bg-stone-950 text-white shadow-[0_12px_28px_rgba(42,24,34,0.16)] transition hover:bg-stone-800 active:scale-[0.99]"
                disabled={isSubmitting}
              >
                {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {mode === "admin" ? "进入管理台" : "进入创作台"}
              </Button>
            </form>

            {mode === "user" && registerOptions?.linuxdo_oauth_enabled ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl border-rose-100 bg-white text-stone-800 hover:bg-rose-50 active:scale-[0.99]"
                onClick={startLinuxDoOAuth}
              >
                使用 Linux DO 登录或注册
              </Button>
            ) : null}

            {mode === "user" ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50/55 px-4 py-3 text-center text-sm text-stone-600">
                {registerOptions?.allow_user_registration === false ? (
                  "个人注册暂未开放，请联系管理员创建账号。"
                ) : (
                  <>
                    还没有账号？
                    <Link href="/signup" className="ml-1 font-semibold text-rose-600 hover:text-rose-700">
                      注册个人账号
                    </Link>
                  </>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
