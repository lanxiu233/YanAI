import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { TopNav } from "@/components/top-nav";

export const metadata: Metadata = {
  title: "颜值AI",
  description: "AI image creation and management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className="antialiased"
        style={{
          fontFamily:
            '"SF Pro Display","SF Pro Text","PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif',
        }}
      >
        <Toaster position="top-center" richColors offset={48} />
        <main className="yan-soft-grid min-h-[100dvh] overflow-x-hidden px-2 py-2 text-stone-900 [padding-bottom:calc(0.5rem+env(safe-area-inset-bottom))] [padding-top:calc(0.5rem+env(safe-area-inset-top))] sm:px-4 sm:py-4 lg:px-5">
          <div className="yan-app-surface mx-auto flex min-h-[calc(100dvh_-_1rem_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] max-w-[1800px] flex-col overflow-hidden rounded-lg sm:min-h-[calc(100dvh_-_2rem)]">
            <TopNav />
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-3 sm:px-5 sm:py-4 lg:px-6">
              {children}
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
