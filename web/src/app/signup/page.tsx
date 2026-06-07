"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Images, LoaderCircle, MailCheck, Sparkles, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import webConfig from "@/constants/common-env";
import { fetchRegisterOptions, registerPersonalUser, sendRegisterVerificationCode, type RegisterOptions } from "@/lib/api";
import { useRedirectIfAuthenticated } from "@/lib/use-auth-guard";
import { setStoredAuthSession } from "@/store/auth";

const inputClass =
  "h-11 rounded-xl border-rose-100 bg-white/90 px-3 text-sm text-stone-900 shadow-[0_1px_0_rgba(84,38,62,0.04)] placeholder:text-stone-400 focus-visible:ring-rose-200";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [registerOptions, setRegisterOptions] = useState<RegisterOptions | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
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

  const handleSendCode = async () => {
    setIsSendingCode(true);
    try {
      const data = await sendRegisterVerificationCode(email.trim());
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
        email: email.trim(),
        password,
        name: name.trim(),
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

  const registrationClosed = registerOptions?.allow_user_registration === false;
  const requiresEmailVerification = Boolean(registerOptions?.email_verification_enabled);

  if (isCheckingAuth) {
    return (
      <div className="grid min-h-[100dvh] w-full place-items-center px-4 py-6">
        <LoaderCircle className="size-5 animate-spin text-rose-400" />
      </div>
    );
  }

  return (
    <div className="relative isolate grid min-h-[100dvh] w-full place-items-center overflow-hidden px-4 py-6 sm:py-8">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_18%_18%,rgba(202,164,232,0.18),transparent_30%),radial-gradient(circle_at_86%_18%,rgba(243,111,159,0.17),transparent_28%),linear-gradient(135deg,#fff8fb_0%,#f8eef4_48%,#f5f0ea_100%)]" />
      <div className="yan-soft-grid absolute inset-0 -z-10 opacity-60" />

      <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/75 bg-white/80 shadow-[0_28px_90px_rgba(84,38,62,0.12)] backdrop-blur-xl lg:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="border-0 bg-white/90 shadow-none">
          <CardContent className="mx-auto flex min-h-[600px] w-full max-w-[460px] flex-col justify-center space-y-6 p-6 sm:p-10">
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
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                <UserPlus className="size-3.5" />
                个人账号
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-stone-950">创建创作账号</h1>
              <p className="text-sm leading-6 text-stone-600">用于保存作品、提示词和额度记录，注册后直接进入画图工作台。</p>
            </div>

            {registrationClosed ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                当前未开放个人注册。你仍可返回登录页，或联系管理员创建账号。
              </div>
            ) : null}

            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (!registrationClosed) void handleSignup();
              }}
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="signup-name" className="text-sm font-medium text-stone-800">
                    昵称
                  </label>
                  <Input
                    id="signup-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="用于工作台和作品归属显示"
                    autoComplete="name"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="signup-email" className="text-sm font-medium text-stone-800">
                    邮箱
                  </label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                    required
                    className={inputClass}
                  />
                </div>

                {requiresEmailVerification ? (
                  <div className="space-y-2">
                    <label htmlFor="signup-code" className="text-sm font-medium text-stone-800">
                      邮箱验证码
                    </label>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <Input
                        id="signup-code"
                        value={verificationCode}
                        onChange={(event) => setVerificationCode(event.target.value)}
                        placeholder="输入邮件中的验证码"
                        autoComplete="one-time-code"
                        required
                        className={inputClass}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-xl border-rose-100 bg-white px-4 text-rose-600 hover:bg-rose-50 active:scale-[0.99]"
                        onClick={() => void handleSendCode()}
                        disabled={isSendingCode || !email.trim()}
                      >
                        {isSendingCode ? <LoaderCircle className="size-4 animate-spin" /> : null}
                        发送验证码
                      </Button>
                    </div>
                    <p className="text-xs leading-5 text-stone-500">验证码邮件会以“颜值AI”作为发件人名称，请检查收件箱或垃圾邮件。</p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label htmlFor="signup-password" className="text-sm font-medium text-stone-800">
                    密码
                  </label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="至少 6 位"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    className={inputClass}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="h-11 w-full rounded-xl bg-stone-950 text-white shadow-[0_12px_28px_rgba(42,24,34,0.16)] transition hover:bg-stone-800 active:scale-[0.99]"
                disabled={isSubmitting || registrationClosed}
              >
                {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                注册并进入创作台
              </Button>
            </form>

            {registerOptions?.linuxdo_oauth_enabled ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl border-rose-100 bg-white text-stone-800 hover:bg-rose-50 active:scale-[0.99]"
                onClick={startLinuxDoOAuth}
              >
                使用 Linux DO 注册或登录
              </Button>
            ) : null}

            <div className="rounded-2xl border border-rose-100 bg-rose-50/55 px-4 py-3 text-center text-sm text-stone-600">
              已有账号？
              <Link href="/login" className="ml-1 font-semibold text-rose-600 hover:text-rose-700">
                去登录
              </Link>
            </div>
          </CardContent>
        </Card>

        <section className="relative hidden min-h-[600px] overflow-hidden border-l border-white/45 bg-[#2d1d26] p-8 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -left-24 -top-20 h-56 w-56 rounded-full bg-[#caa4e8]/22 blur-3xl" />
          <div className="absolute bottom-8 right-8 h-44 w-44 rounded-full bg-rose-400/18 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_38%)]" />

          <div className="relative z-10 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs font-medium text-white/74">
              <CheckCircle2 className="size-3.5" />
              邮箱校验
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs font-medium text-white/62">
              <Sparkles className="size-3.5" />
              个人工作区
            </div>
          </div>

          <div className="relative z-10 mt-8 rounded-[30px] border border-white/12 bg-white/[0.08] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
            <div className="rounded-[24px] border border-white/65 bg-[#fbf6f8] p-4 text-[#2d1d26] shadow-[0_18px_42px_rgba(0,0,0,0.14)]">
              <div className="flex items-center gap-3">
                <div className="grid size-12 place-items-center rounded-2xl bg-[#2d1d26] text-base font-semibold text-white">颜</div>
                <div className="min-w-0 flex-1">
                  <div className="h-2.5 w-24 rounded-full bg-[#2d1d26]/78" />
                  <div className="mt-2 h-2 w-36 rounded-full bg-[#2d1d26]/16" />
                </div>
                <div className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  已验证
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="h-24 rounded-2xl bg-[linear-gradient(135deg,#fecdd3,#fb7185)]" />
                <div className="h-24 rounded-2xl bg-[linear-gradient(135deg,#fde68a,#f97316)]" />
                <div className="h-24 rounded-2xl bg-[linear-gradient(135deg,#e9d5ff,#c084fc)]" />
              </div>

              <div className="mt-4 rounded-2xl border border-rose-100 bg-white p-3">
                <div className="flex items-center justify-between text-xs font-medium text-stone-600">
                  <span>初始额度</span>
                  <span className="text-rose-600">可配置</span>
                </div>
                <div className="mt-3 flex items-end gap-1.5">
                  <span className="h-7 flex-1 rounded-full bg-[#2d1d26]/12" />
                  <span className="h-12 flex-1 rounded-full bg-rose-300/85" />
                  <span className="h-9 flex-1 rounded-full bg-[#caa4e8]/45" />
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-[20px] border border-white/12 bg-white/[0.08] p-3">
                <Images className="size-4 text-rose-200" />
                <div className="mt-5 h-2 w-20 rounded-full bg-white/55" />
                <div className="mt-2 h-2 w-12 rounded-full bg-white/25" />
              </div>
              <div className="rounded-[20px] border border-white/12 bg-white/[0.08] p-3">
                <MailCheck className="size-4 text-rose-200" />
                <div className="mt-5 h-2 w-24 rounded-full bg-white/55" />
                <div className="mt-2 h-2 w-14 rounded-full bg-white/25" />
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-7 max-w-[19rem]">
            <h2 className="text-xl font-semibold leading-tight tracking-tight">作品和额度跟随账号</h2>
            <p className="mt-3 text-sm leading-7 text-white/64">
              注册后生成记录、提示词收藏和个人额度会独立保存，适合多人共用同一部署。
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
