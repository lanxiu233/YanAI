"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login } from "@/lib/api";
import { getDefaultRouteForRole, getStoredAuthSession, setStoredAuthSession } from "@/store/auth";

const inputClass =
  "h-11 rounded-xl border-stone-200 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-400 focus-visible:ring-rose-200";

export default function AdminLoginPage() {
  const router = useRouter();
  const [authKey, setAuthKey] = useState("");
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void getStoredAuthSession().then((session) => {
      if (!active) return;
      if (session?.role === "admin") {
        router.replace(getDefaultRouteForRole(session.role));
        return;
      }
      setIsChecking(false);
    });
    return () => {
      active = false;
    };
  }, [router]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const normalizedAuthKey = authKey.trim();
      const data = await login(normalizedAuthKey);
      if (data.role !== "admin") {
        throw new Error("该入口仅支持管理员账号");
      }
      await setStoredAuthSession({
        key: normalizedAuthKey,
        role: data.role,
        subjectId: data.subject_id,
        name: data.name,
        email: data.email,
        quota: data.quota,
      });
      router.replace(getDefaultRouteForRole(data.role));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "管理员登录失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isChecking) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#f7f3f1]">
        <LoaderCircle className="size-5 animate-spin text-rose-400" />
      </div>
    );
  }

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[#f7f3f1] px-4 py-10 text-stone-950">
      <div className="w-full max-w-[26rem] rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3 border-b border-stone-200 pb-4">
          <span className="grid size-10 place-items-center rounded-lg bg-stone-950 text-white">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-stone-950">管理端登录</h1>
            <p className="mt-1 text-sm text-stone-500">请输入管理员 Auth Key 进入控制台。</p>
          </div>
        </div>

        <form
          className="mt-5 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <label className="block space-y-2">
            <span className="text-sm font-medium text-stone-800">管理员密钥</span>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
              <Input
                type="password"
                value={authKey}
                onChange={(event) => setAuthKey(event.target.value)}
                placeholder="输入管理端 Auth Key"
                autoComplete="current-password"
                required
                className={`${inputClass} pl-9`}
              />
            </div>
          </label>

          <Button type="submit" className="h-11 w-full rounded-xl bg-stone-950 text-white hover:bg-stone-800" disabled={isSubmitting || !authKey.trim()}>
            {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
            进入控制台
            <ArrowRight className="size-4" />
          </Button>
        </form>

        <div className="mt-5 border-t border-stone-200 pt-4 text-center text-sm text-stone-500">
          <Link href="/" className="hover:text-stone-950">
            返回用户首页
          </Link>
        </div>
      </div>
    </div>
  );
}
