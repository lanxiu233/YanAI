"use client";

import { useMemo, useState } from "react";
import { Ban, CheckCircle2, Code2, Copy, FileImage, ImageUp, KeyRound, LoaderCircle, Trash2 } from "lucide-react";

import webConfig from "@/constants/common-env";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { UserKey } from "@/lib/api";

type ApiExampleMode = "generate" | "edit";

type ApiUsagePanelProps = {
  keys: UserKey[];
  revealedKey: string;
  keyName: string;
  isCreatingKey: boolean;
  pendingKeyIds: Set<string>;
  onKeyNameChange: (value: string) => void;
  onCreateKey: () => void;
  onToggleKey: (item: UserKey) => void;
  onDeleteKey: (item: UserKey) => void;
  onCopy: (value: string) => void;
};

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

function publicApiBaseUrl() {
  const configured = webConfig.apiUrl.replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function ApiUsagePanel({
  keys,
  revealedKey,
  keyName,
  isCreatingKey,
  pendingKeyIds,
  onKeyNameChange,
  onCreateKey,
  onToggleKey,
  onDeleteKey,
  onCopy,
}: ApiUsagePanelProps) {
  const [apiExampleMode, setApiExampleMode] = useState<ApiExampleMode>("generate");
  const apiBaseUrl = useMemo(() => publicApiBaseUrl(), []);
  const apiKeyPreview = revealedKey || "YOUR_YANAI_KEY";

  const apiExample = useMemo(() => {
    if (apiExampleMode === "edit") {
      return [
        `curl -X POST "${apiBaseUrl}/v1/images/edits" \\`,
        `  -H "Authorization: Bearer ${apiKeyPreview}" \\`,
        `  -F "model=gpt-image-2" \\`,
        `  -F "image=@./reference.png" \\`,
        `  -F "prompt=保留人物神态，重绘为高端商业海报质感" \\`,
        `  -F "size=1024x1024"`,
      ].join("\n");
    }
    return [
      `curl -X POST "${apiBaseUrl}/v1/images/generations" \\`,
      `  -H "Authorization: Bearer ${apiKeyPreview}" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '{`,
      `    "model": "gpt-image-2",`,
      `    "prompt": "一张高端护肤品商业主视觉，柔和棚拍光，干净背景，真实产品摄影质感",`,
      `    "size": "1024x1024",`,
      `    "n": 1,`,
      `    "response_format": "b64_json"`,
      `  }'`,
    ].join("\n");
  }, [apiBaseUrl, apiExampleMode, apiKeyPreview]);

  return (
    <Card className="rounded-lg border-white/80 bg-white/80 shadow-sm">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-stone-100">
              <KeyRound className="size-5 text-stone-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">生图 API 调用</h2>
              <p className="text-sm leading-6 text-stone-500">把颜值AI接进自己的脚本、工作流或产品里，调用成功后按生成张数消耗当前额度。</p>
            </div>
          </div>
          <Badge variant={keys.some((item) => item.enabled) ? "success" : "secondary"} className="w-fit rounded-md">
            {keys.some((item) => item.enabled) ? "Key 可用" : "等待创建 Key"}
          </Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.35fr]">
          <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
              <Code2 className="size-4 text-rose-500" />
              接入一次生图
            </div>
            <div className="space-y-2">
              {[
                { title: "创建一个个人 Key", text: "Key 只显示一次，适合放进本地脚本、设计工具插件或自己的后端服务。" },
                { title: "调用图片接口", text: "文生图走 /v1/images/generations，参考图重绘走 /v1/images/edits。" },
                { title: "处理返回图片", text: "默认返回 b64_json，可直接保存为 PNG；调用记录会自动进入我的图片。" },
              ].map((step, index) => (
                <div key={step.title} className="flex gap-3 rounded-lg bg-white px-3 py-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-rose-50 text-xs font-semibold text-rose-600">{index + 1}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-stone-900">{step.title}</div>
                    <div className="mt-1 text-xs leading-5 text-stone-500">{step.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900">
              个人 Key 只开放图片能力。额度不足或 Key 停用时，请求会直接返回错误，不会偷偷排队。
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-stone-200 bg-stone-950 text-white">
            <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">可复制请求</div>
                <div className="mt-1 text-xs text-white/55">{apiBaseUrl}</div>
              </div>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-white/8 p-1">
                {[
                  { value: "generate" as const, label: "文生图", icon: FileImage },
                  { value: "edit" as const, label: "图生图", icon: ImageUp },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = apiExampleMode === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setApiExampleMode(item.value)}
                      className={active ? "inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-white px-3 text-xs font-medium text-stone-950" : "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium text-white/65 transition hover:bg-white/10 hover:text-white"}
                    >
                      <Icon className="size-3.5" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <pre className="max-h-[360px] overflow-auto p-4 text-[12px] leading-6 text-rose-50">
              <code>{apiExample}</code>
            </pre>
            <div className="flex flex-col gap-2 border-t border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-white/55">刚创建的 Key 会自动带入示例；旧 Key 请替换 YOUR_YANAI_KEY。</div>
              <Button type="button" variant="outline" className="h-9 rounded-lg border-white/15 bg-white/10 px-3 text-white hover:bg-white/15" onClick={() => onCopy(apiExample)}>
                <Copy className="size-4" />
                复制示例
              </Button>
            </div>
          </div>
        </div>

        {revealedKey ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
            <div className="font-medium">新 key 仅展示一次，请立即保存。</div>
            <div className="mt-3 flex flex-col gap-3 rounded-lg border border-emerald-200 bg-white/80 p-3 md:flex-row md:items-center md:justify-between">
              <code className="break-all font-mono text-[13px]">{revealedKey}</code>
              <Button type="button" variant="outline" className="h-10 rounded-xl border-emerald-200 bg-white px-4 text-emerald-700" onClick={() => onCopy(revealedKey)}>
                <Copy className="size-4" />
                复制
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input value={keyName} onChange={(event) => onKeyNameChange(event.target.value)} placeholder="例如：本机脚本、设计工具调用" className="h-11 rounded-xl border-stone-200 bg-white" />
          <Button className="h-11 rounded-xl bg-stone-950 text-white hover:bg-stone-800" onClick={onCreateKey} disabled={isCreatingKey}>
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
                    <Button type="button" variant="outline" className="h-10 rounded-xl border-stone-200 bg-white px-4 text-stone-700" onClick={() => onToggleKey(item)} disabled={pending}>
                      {pending ? <LoaderCircle className="size-4 animate-spin" /> : item.enabled ? <Ban className="size-4" /> : <CheckCircle2 className="size-4" />}
                      {item.enabled ? "停用" : "启用"}
                    </Button>
                    <Button type="button" variant="outline" className="h-10 rounded-xl border-rose-200 bg-white px-4 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => onDeleteKey(item)} disabled={pending}>
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
  );
}
