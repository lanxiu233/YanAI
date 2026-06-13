"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  Bell,
  Boxes,
  FileText,
  Gift,
  Image,
  Images,
  KeyRound,
  LogOut,
  Menu,
  PenLine,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import webConfig from "@/constants/common-env";
import {
  ANNOUNCEMENT_UPDATED_EVENT,
  fetchAnnouncement,
  type AnnouncementConfig,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { clearStoredAuthSession, getCachedAuthSession, getStoredAuthSession, type StoredAuthSession } from "@/store/auth";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const adminNavItems = [
  { href: "/users", label: "用户管理", icon: Users },
  { href: "/accounts", label: "号池管理", icon: Boxes },
  { href: "/register", label: "注册机", icon: KeyRound },
  { href: "/prompt-manager", label: "提示词审核", icon: PenLine },
  { href: "/image-manager", label: "图片管理", icon: Images },
  { href: "/channels", label: "渠道", icon: Waypoints },
  { href: "/models", label: "模型", icon: BadgeDollarSign },
  { href: "/redeem-codes", label: "兑换码", icon: Gift },
  { href: "/logs", label: "日志", icon: FileText },
  { href: "/settings", label: "设置", icon: Settings },
] satisfies NavItem[];

const userNavItems = [
  { href: "/image", label: "画图", icon: Sparkles },
  { href: "/my-images", label: "我的图片", icon: Image },
  { href: "/prompt-manager", label: "我的提示词", icon: PenLine },
  { href: "/profile", label: "个人中心", icon: User },
] satisfies NavItem[];

const ANNOUNCEMENT_REFRESH_INTERVAL_MS = 30000;

const announcementLabels: Record<AnnouncementConfig["level"], string> = {
  info: "通知",
  success: "完成",
  warning: "提醒",
  danger: "重要",
};

function formatAnnouncementTime(value?: string | null) {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) {
    return "";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<StoredAuthSession | null | undefined>(() => getCachedAuthSession());
  const [announcement, setAnnouncement] = useState<AnnouncementConfig | null>(null);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const sessionKey = session?.key;
  const sessionRole = session?.role;

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (pathname === "/login" || pathname === "/signup" || pathname === "/admin-login") {
        if (active) setSession(null);
        return;
      }
      const storedSession = await getStoredAuthSession();
      if (active) setSession(storedSession);
    };

    void load();
    return () => {
      active = false;
    };
  }, [pathname]);

  const refreshAnnouncement = async () => {
    try {
      const data = await fetchAnnouncement();
      setAnnouncement(data.announcement);
    } catch {
      setAnnouncement(null);
    }
  };

  useEffect(() => {
    let active = true;

    if (!sessionKey) {
      queueMicrotask(() => {
        if (active) setAnnouncement(null);
      });
      return () => {
        active = false;
      };
    }

    const refresh = async () => {
      try {
        const data = await fetchAnnouncement();
        if (active) setAnnouncement(data.announcement);
      } catch {
        if (active) setAnnouncement(null);
      }
    };

    const handleAnnouncementUpdated = () => {
      void refresh();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === ANNOUNCEMENT_UPDATED_EVENT) {
        void refresh();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    void refresh();
    window.addEventListener(ANNOUNCEMENT_UPDATED_EVENT, handleAnnouncementUpdated);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleAnnouncementUpdated);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "hidden") {
        void refresh();
      }
    }, ANNOUNCEMENT_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.removeEventListener(ANNOUNCEMENT_UPDATED_EVENT, handleAnnouncementUpdated);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleAnnouncementUpdated);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [sessionKey]);

  useEffect(() => {
    if (!sessionRole) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const items = sessionRole === "admin" ? adminNavItems : userNavItems;
      items.forEach((item) => {
        if (item.href !== pathname) {
          router.prefetch(item.href);
        }
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [pathname, router, sessionRole]);

  const handleLogout = async () => {
    const nextPath = session?.role === "admin" ? "/admin-login" : "/login";
    await clearStoredAuthSession();
    router.replace(nextPath);
  };

  if (pathname === "/login" || pathname === "/signup" || pathname === "/admin-login" || session === undefined || !session) {
    return null;
  }

  const isAdmin = session.role === "admin";
  const navItems = isAdmin ? adminNavItems : userNavItems;
  const roleLabel = isAdmin ? "管理员" : "个人用户";
  const workspaceLabel = isAdmin ? "控制台" : "创作空间";
  const homeHref = isAdmin ? "/users" : "/image";
  const currentNavItem = navItems.find((item) => pathname === item.href) ?? navItems[0];
  const CurrentIcon = currentNavItem.icon;
  const hasAnnouncement = Boolean(announcement?.enabled && (announcement.title || announcement.content));
  const announcementTime = formatAnnouncementTime(announcement?.updated_at);

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95">
      <div className="flex min-h-[4.25rem] items-center justify-between gap-2 px-3 sm:min-h-16 sm:gap-3 sm:px-5 lg:px-6">
        <Link href={homeHref} className="group flex shrink-0 items-center gap-2.5 whitespace-nowrap">
          <span className="yan-mark-gradient grid size-10 place-items-center rounded-lg text-sm font-black text-white shadow-sm transition group-hover:brightness-105">
            颜
          </span>
          <span className="hidden leading-tight md:block">
            <span className="block text-[17px] font-bold tracking-tight text-stone-950">颜值AI</span>
            <span className="block text-xs font-medium text-stone-500">{workspaceLabel}</span>
          </span>
        </Link>

        <Link
          href={currentNavItem.href}
          className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-900 sm:hidden"
        >
          <CurrentIcon className="size-4 shrink-0 text-rose-500" />
          <span className="truncate">{currentNavItem.label}</span>
          <span className="shrink-0 rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
            {workspaceLabel}
          </span>
        </Link>

        <nav className="hidden min-w-0 flex-1 justify-center gap-1 overflow-x-auto sm:flex">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition sm:text-sm",
                  active
                    ? "bg-stone-950 text-white"
                    : "text-stone-500 hover:bg-stone-100 hover:text-stone-950",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
          <span className="hidden items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 md:inline-flex">
            {isAdmin ? <ShieldCheck className="size-3.5" /> : <Sparkles className="size-3.5" />}
            {roleLabel}
          </span>
          <Popover
            open={announcementOpen}
            onOpenChange={(open) => {
              setAnnouncementOpen(open);
              if (open) void refreshAnnouncement();
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "relative inline-flex size-10 items-center justify-center rounded-lg transition hover:bg-stone-100 sm:size-9",
                  hasAnnouncement ? "text-rose-600" : "text-stone-400 hover:text-stone-700",
                )}
                aria-label="查看通知"
              >
                <Bell className="size-4" />
                {hasAnnouncement ? <span className="absolute right-2 top-2 size-2 rounded-full bg-rose-500 shadow-[0_0_0_3px_rgba(255,255,255,0.9)]" /> : null}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] space-y-3 rounded-lg border-stone-200 bg-white p-4">
              {hasAnnouncement && announcement ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <Badge variant={announcement.level}>{announcementLabels[announcement.level]}</Badge>
                      <h2 className="break-words text-sm font-semibold leading-6 text-stone-950">
                        {announcement.title || "站内公告"}
                      </h2>
                    </div>
                    {announcementTime ? <span className="shrink-0 text-[11px] text-stone-400">{announcementTime}</span> : null}
                  </div>
                  {announcement.content ? (
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-stone-600">{announcement.content}</p>
                  ) : null}
                </>
              ) : (
                <div className="space-y-1 text-sm leading-6">
                  <h2 className="font-semibold text-stone-900">暂无公告</h2>
                  <p className="text-stone-500">有新的站内消息时会显示在这里。</p>
                </div>
              )}
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-950 sm:hidden"
                aria-label="打开导航菜单"
              >
                <Menu className="size-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={10} className="w-[min(20rem,calc(100vw-1rem))] rounded-lg border-stone-200 bg-white p-2 sm:hidden">
              <div className="px-2 py-2">
                <div className="text-xs font-medium text-stone-400">{workspaceLabel}</div>
                <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-stone-950">
                  <span>{roleLabel}</span>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">
                    v{webConfig.appVersion}
                  </span>
                </div>
              </div>
              <div className="grid gap-1">
                {navItems.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
                        active
                          ? "bg-stone-950 text-white"
                          : "text-stone-600 hover:bg-stone-50 hover:text-stone-950",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
          <span className="hidden rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-400 lg:inline-block">
            v{webConfig.appVersion}
          </span>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-950 sm:size-9"
            onClick={() => void handleLogout()}
            aria-label="退出登录"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
