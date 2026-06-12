"use client";

import { usePathname } from "next/navigation";

import { TopNav } from "@/components/top-nav";

const standaloneRoutes = new Set(["", "/", "/login", "/signup", "/admin-login"]);

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = normalizePath(usePathname() || "");
  const isStandaloneRoute = standaloneRoutes.has(pathname);

  if (isStandaloneRoute) {
    return <main className="min-h-[100dvh] bg-[var(--yan-bg)] text-stone-900">{children}</main>;
  }

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[var(--yan-bg)] text-stone-900">
      <div className="mx-auto flex min-h-[100dvh] max-w-[1920px] flex-col">
        <TopNav />
        <div className="min-h-0 flex-1 overflow-x-hidden px-3 py-4 sm:px-5 lg:px-6">{children}</div>
      </div>
    </main>
  );
}
