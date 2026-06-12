"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, LoaderCircle, LogIn, Mail, Sparkles, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import webConfig from "@/constants/common-env";
import { fetchRegisterOptions, login, registerPersonalUser, sendRegisterVerificationCode, type RegisterOptions } from "@/lib/api";
import { getDefaultRouteForRole, getStoredAuthSession, setStoredAuthSession, type StoredAuthSession } from "@/store/auth";
import { cn } from "@/lib/utils";

type AuthView = "login" | "signup";

const gallery = [
  { src: "/landing-hero-portrait.png", title: "肖像" },
  { src: "/landing-gallery-still.png", title: "静物" },
  { src: "/landing-gallery-interior.png", title: "空间" },
];

const inputClass =
  "h-11 rounded-xl border-stone-200 bg-white/90 px-3 text-sm text-stone-900 placeholder:text-stone-400 focus-visible:ring-rose-200";

function resolveEntry(session: StoredAuthSession | null) {
  if (!session) return { href: "", label: "进入创作" };
  return {
    href: getDefaultRouteForRole(session.role),
    label: session.role === "admin" ? "进入控制台" : "进入创作台",
  };
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[100dvh] place-items-center bg-[#f7f3f1]">
          <LoaderCircle className="size-5 animate-spin text-rose-400" />
        </div>
      }
    >
      <HomePageInner />
    </Suspense>
  );
}

function HomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<StoredAuthSession | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [registerOptions, setRegisterOptions] = useState<RegisterOptions | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  useEffect(() => {
    let active = true;
    void getStoredAuthSession().then((value) => {
      if (active) setSession(value);
    });
    void fetchRegisterOptions()
      .then((value) => {
        if (active) setRegisterOptions(value);
      })
      .catch(() => {
        if (active) setRegisterOptions(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const auth = searchParams.get("auth");
    if (auth === "login" || auth === "signup") {
      setAuthView(auth);
      setAuthOpen(true);
    }
  }, [searchParams]);

  const entry = useMemo(() => resolveEntry(session), [session]);
  const registrationClosed = registerOptions?.allow_user_registration === false;
  const requiresEmailVerification = Boolean(registerOptions?.email_verification_enabled);

  const openAuth = (view: AuthView) => {
    setAuthView(view);
    setAuthOpen(true);
    window.history.replaceState(null, "", `/?auth=${view}`);
  };

  const closeAuth = (open: boolean) => {
    setAuthOpen(open);
    if (!open && window.location.search.includes("auth=")) {
      window.history.replaceState(null, "", "/");
    }
  };

  const startLinuxDoOAuth = () => {
    const startPath = registerOptions?.linuxdo_start_url || "/auth/linuxdo/start";
    const apiBase = webConfig.apiUrl.replace(/\/$/, "");
    window.location.href = `${apiBase}${startPath}`;
  };

  const handleLogin = async () => {
    setIsSubmitting(true);
    try {
      const data = await login({ email: email.trim(), password });
      if (data.role !== "user") throw new Error("请使用用户账号登录");
      const sessionKey = data.token || "";
      if (!sessionKey) throw new Error("登录未返回有效会话");
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

  const handleSendCode = async () => {
    setIsSendingCode(true);
    try {
      const data = await sendRegisterVerificationCode(signupEmail.trim());
      toast.success(data.required ? "验证码已发送，请检查邮箱" : "当前未启用邮箱验证");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发送验证码失败");
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleSignup = async () => {
    setIsSubmitting(true);
    try {
      const data = await registerPersonalUser({
        email: signupEmail.trim(),
        password: signupPassword,
        name: signupName.trim(),
        verification_code: verificationCode.trim(),
      });
      await setStoredAuthSession({
        key: data.token,
        role: data.user.role,
        subjectId: data.user.id,
        name: data.user.name,
        email: data.user.email,
        quota: data.user.quota,
      });
      router.replace("/image");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "注册失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#f7f3f1] text-stone-950">
      <header className="fixed inset-x-0 top-0 z-40">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-2 text-stone-950">
            <span className="size-2.5 rounded-full bg-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.12)] transition group-hover:bg-rose-600" />
            <span className="text-[15px] font-semibold tracking-normal text-stone-950 [text-shadow:0_1px_18px_rgba(255,255,255,0.72)]">
              颜值 AI
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button type="button" variant="outline" className="hidden h-10 rounded-full border-white/70 bg-white/78 px-4 text-stone-800 backdrop-blur hover:bg-white sm:inline-flex" onClick={() => openAuth("login")}>
              <LogIn className="size-4" />
              登录
            </Button>
            {session ? (
              <Button asChild className="h-10 rounded-full bg-stone-950 px-4 text-white hover:bg-stone-800">
                <Link href={entry.href}>
                  {entry.label}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button type="button" className="h-10 rounded-full bg-stone-950 px-4 text-white hover:bg-stone-800" onClick={() => openAuth("login")}>
                {entry.label}
                <ArrowRight className="size-4" />
              </Button>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="relative isolate min-h-[88dvh] overflow-hidden">
          <Image
            src="/landing-hero-portrait.png"
            alt="颜值AI 生成的艺术人像"
            fill
            sizes="100vw"
            priority
            className="absolute inset-0 -z-20 object-cover object-[70%_40%]"
          />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(247,243,241,0.98)_0%,rgba(247,243,241,0.9)_38%,rgba(247,243,241,0.34)_68%,rgba(247,243,241,0.08)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-44 bg-gradient-to-t from-[#f7f3f1] to-transparent" />

          <div className="mx-auto flex min-h-[88dvh] max-w-7xl items-center px-4 pb-16 pt-28 sm:px-6 lg:px-8">
            <div className="max-w-[28rem]">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/72 px-3 py-1.5 text-sm font-medium text-stone-700 backdrop-blur">
                <Sparkles className="size-4 text-rose-500" />
                AI 影像工作室
              </div>
              <h1 className="sr-only">颜值AI</h1>
              <p className="mt-6 max-w-[25rem] text-xl leading-9 text-stone-800">
                一句话，生成一张可以继续打磨的图。
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {session ? (
                  <Button asChild className="h-12 rounded-full bg-rose-500 px-6 text-base text-white hover:bg-rose-600">
                    <Link href={entry.href}>
                      {entry.label}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button type="button" className="h-12 rounded-full bg-rose-500 px-6 text-base text-white hover:bg-rose-600" onClick={() => openAuth("login")}>
                    {entry.label}
                    <ArrowRight className="size-4" />
                  </Button>
                )}
                <Button type="button" variant="outline" className="h-12 rounded-full border-stone-300 bg-white/76 px-6 text-base text-stone-800 backdrop-blur hover:bg-white" onClick={() => openAuth("signup")}>
                  注册账号
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-stone-950">近期图像</h2>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {gallery.map((item, index) => (
              <article
                key={item.src}
                className={index === 0 ? "relative min-h-[30rem] overflow-hidden rounded-lg bg-stone-200 sm:col-span-1" : "relative min-h-[18rem] overflow-hidden rounded-lg bg-stone-200 sm:mt-16"}
              >
                <Image src={item.src} alt={item.title} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/58 to-transparent p-4">
                  <div className="text-sm font-medium text-white">{item.title}</div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 bg-[#f7f3f1]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>颜值AI</span>
          <div className="flex gap-4">
            <button type="button" className="hover:text-stone-950" onClick={() => openAuth("login")}>登录</button>
            <button type="button" className="hover:text-stone-950" onClick={() => openAuth("signup")}>注册</button>
            {session ? <Link href={getDefaultRouteForRole(session.role)} className="hover:text-stone-950">进入</Link> : null}
          </div>
        </div>
      </footer>

      <Dialog open={authOpen} onOpenChange={closeAuth}>
        <DialogContent className="w-[min(94vw,470px)] max-w-none rounded-lg border-white/80 bg-white/96 p-0 shadow-[0_28px_90px_rgba(42,24,34,0.24)]">
          <DialogHeader className="border-b border-stone-200 px-5 pt-5 pb-4">
            <div className="flex items-center gap-2">
              <span className="yan-mark-gradient grid size-9 place-items-center rounded-lg text-xs font-black text-white">颜</span>
              <div>
                <DialogTitle className="text-lg font-semibold text-stone-950">
                  {authView === "login" ? "登录颜值AI" : "创建账号"}
                </DialogTitle>
                <DialogDescription className="text-sm text-stone-500">
                  {authView === "login" ? "回到你的创作现场。" : "保存作品、提示词和额度记录。"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="px-5 py-5">
            <div className="grid grid-cols-2 rounded-xl border border-stone-200 bg-stone-50 p-1 text-sm font-medium">
              {[
                { value: "login" as const, label: "登录", icon: Mail },
                { value: "signup" as const, label: "注册", icon: UserPlus },
              ].map((item) => {
                const Icon = item.icon;
                const active = authView === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    className={cn(
                      "flex h-10 items-center justify-center gap-2 rounded-lg transition",
                      active ? "bg-white text-rose-600 shadow-sm" : "text-stone-500 hover:bg-white/60 hover:text-stone-900",
                    )}
                    onClick={() => setAuthView(item.value)}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {authView === "login" ? (
              <form
                className="mt-5 space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleLogin();
                }}
              >
                <div className="space-y-4">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-stone-800">邮箱</span>
                    <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" required className={inputClass} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-stone-800">密码</span>
                    <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="输入密码" autoComplete="current-password" required className={inputClass} />
                  </label>
                </div>

                <Button type="submit" className="h-11 w-full rounded-xl bg-stone-950 text-white hover:bg-stone-800" disabled={isSubmitting}>
                  {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                  登录并进入
                </Button>

                {registerOptions?.linuxdo_oauth_enabled ? (
                  <Button type="button" variant="outline" className="h-11 w-full rounded-xl border-stone-200 bg-white text-stone-800 hover:bg-stone-50" onClick={startLinuxDoOAuth}>
                    使用 Linux DO 登录
                  </Button>
                ) : null}
              </form>
            ) : (
              <form
                className="mt-5 space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!registrationClosed) void handleSignup();
                }}
              >
                {registrationClosed ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                    当前未开放个人注册，请联系管理员创建账号。
                  </div>
                ) : null}
                <div className="space-y-4">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-stone-800">昵称</span>
                    <Input value={signupName} onChange={(event) => setSignupName(event.target.value)} placeholder="用于作品归属显示" autoComplete="name" className={inputClass} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-stone-800">邮箱</span>
                    <Input type="email" value={signupEmail} onChange={(event) => setSignupEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" required className={inputClass} />
                  </label>
                  {requiresEmailVerification ? (
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-stone-800">邮箱验证码</span>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <Input value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} placeholder="输入验证码" autoComplete="one-time-code" required className={inputClass} />
                        <Button type="button" variant="outline" className="h-11 rounded-xl border-stone-200 bg-white px-4 text-stone-700 hover:bg-stone-50" onClick={() => void handleSendCode()} disabled={isSendingCode || !signupEmail.trim()}>
                          {isSendingCode ? <LoaderCircle className="size-4 animate-spin" /> : null}
                          发送
                        </Button>
                      </div>
                    </label>
                  ) : null}
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-stone-800">密码</span>
                    <Input type="password" value={signupPassword} onChange={(event) => setSignupPassword(event.target.value)} placeholder="至少 6 位" autoComplete="new-password" required minLength={6} className={inputClass} />
                  </label>
                </div>

                <Button type="submit" className="h-11 w-full rounded-xl bg-rose-500 text-white hover:bg-rose-600" disabled={isSubmitting || registrationClosed}>
                  {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  注册并进入创作台
                </Button>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
