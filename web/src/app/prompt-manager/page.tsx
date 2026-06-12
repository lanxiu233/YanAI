"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  CheckCircle2,
  Copy,
  Bot,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Share2,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  approveAdminPrompt,
  createAdminPrompt,
  createMyPrompt,
  createPromptShare,
  deleteAdminPrompt,
  deleteMyPrompt,
  fetchAdminPrompts,
  fetchMyPrompts,
  fetchPromptShare,
  generatePromptWithAssistant,
  importPromptShare,
  type PromptLibraryItem,
  type PromptLibraryPayload,
  rejectAdminPrompt,
  submitMyPrompt,
  updateAdminPrompt,
  updateMyPrompt,
  uploadMyPromptExampleImage,
  uploadPromptExampleImage,
} from "@/lib/api";
import { resolveApiAssetUrl } from "@/lib/assets";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/use-auth-guard";
import type { StoredAuthSession } from "@/store/auth";

type PromptFormState = {
  title: string;
  description: string;
  preview: string;
  reference_image_urls: string;
  prompt: string;
  author: string;
  link: string;
  mode: "generate" | "edit";
  image_size: string;
  image_count: string;
  category: string;
  sub_category: string;
};

const emptyForm: PromptFormState = {
  title: "",
  description: "",
  preview: "",
  reference_image_urls: "",
  prompt: "",
  author: "",
  link: "",
  mode: "generate",
  image_size: "",
  image_count: "",
  category: "",
  sub_category: "",
};

function normalizeMode(value?: string): "generate" | "edit" {
  return value === "edit" ? "edit" : "generate";
}

function modeLabel(value?: string) {
  return normalizeMode(value) === "edit" ? "图生图" : "文生图";
}

function categoryLabel(item: PromptLibraryItem) {
  return [item.category, item.sub_category].filter(Boolean).join(" / ") || "未分类";
}

function promptStatus(item: PromptLibraryItem) {
  return item.status || "public";
}

function statusLabel(status?: string) {
  if (status === "personal") return "个人";
  if (status === "submitted") return "待审核";
  if (status === "rejected") return "已驳回";
  if (status === "shared") return "分享";
  return "公共";
}

function statusBadgeVariant(status?: string): "success" | "warning" | "danger" | "info" {
  if (status === "submitted") return "warning";
  if (status === "rejected") return "danger";
  if (status === "personal") return "info";
  return "success";
}

function canUserEdit(item: PromptLibraryItem) {
  return ["personal", "submitted", "rejected"].includes(promptStatus(item));
}

function shareUrlFromId(shareId: string) {
  if (typeof window === "undefined") {
    return `/prompt-manager?share=${encodeURIComponent(shareId)}`;
  }
  return `${window.location.origin}/prompt-manager?share=${encodeURIComponent(shareId)}`;
}

function extractShareId(value: string) {
  const text = value.trim();
  if (!text) {
    return "";
  }
  try {
    const url = new URL(text);
    return url.searchParams.get("share") || url.searchParams.get("shared") || "";
  } catch {
    const match = text.match(/(?:share|shared)=([a-zA-Z0-9_-]+)/);
    return match?.[1] || text;
  }
}

function toForm(item?: PromptLibraryItem): PromptFormState {
  if (!item) {
    return emptyForm;
  }
  return {
    title: item.title || "",
    description: item.description || "",
    preview: item.preview || "",
    reference_image_urls: (item.reference_image_urls || []).join("\n"),
    prompt: item.prompt || "",
    author: item.author || "",
    link: item.link || "",
    mode: normalizeMode(item.mode),
    image_size: item.image_size || "",
    image_count: item.image_count || "",
    category: item.category || "",
    sub_category: item.sub_category || "",
  };
}

function splitUrls(value: string) {
  return value
    .replace(/,/g, "\n")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toPayload(form: PromptFormState): PromptLibraryPayload {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    preview: form.preview.trim(),
    reference_image_urls: splitUrls(form.reference_image_urls),
    prompt: form.prompt.trim(),
    author: form.author.trim(),
    link: form.link.trim(),
    mode: form.mode,
    image_size: form.image_size.trim(),
    image_count: form.image_count.trim(),
    category: form.category.trim(),
    sub_category: form.sub_category.trim(),
  };
}

function summarizePrompt(prompt: string) {
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  return cleaned.length > 108 ? `${cleaned.slice(0, 108)}...` : cleaned;
}

function PromptManagerContent({ session }: { session: StoredAuthSession }) {
  const isAdmin = session.role === "admin";
  const [items, setItems] = useState<PromptLibraryItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [statusFilter, setStatusFilter] = useState("全部");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isImportingShare, setIsImportingShare] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareInput, setShareInput] = useState("");
  const [sharePreview, setSharePreview] = useState<PromptLibraryItem | null>(null);
  const [editingItem, setEditingItem] = useState<PromptLibraryItem | null>(null);
  const [form, setForm] = useState<PromptFormState>(emptyForm);
  const [assistantGoal, setAssistantGoal] = useState("");
  const [assistantStyle, setAssistantStyle] = useState("");
  const [assistantResult, setAssistantResult] = useState("");
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const values = Array.from(new Set(items.map(categoryLabel))).sort((a, b) => a.localeCompare(b, "zh-CN"));
    return ["全部", ...values];
  }, [items]);

  const statusFilters = useMemo(() => {
    const values = Array.from(new Set(items.map((item) => statusLabel(promptStatus(item)))));
    return ["全部", ...values];
  }, [items]);

  const filteredItems = useMemo(() => {
    const text = query.trim().toLowerCase();
    return items.filter((item) => {
      const itemCategory = categoryLabel(item);
      if (category !== "全部" && itemCategory !== category) {
        return false;
      }
      if (statusFilter !== "全部" && statusLabel(promptStatus(item)) !== statusFilter) {
        return false;
      }
      if (!text) {
        return true;
      }
      return [item.title, item.description, item.prompt, item.author, item.category, item.sub_category, item.owner_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text));
    });
  }, [category, items, query, statusFilter]);

  const loadPrompts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = isAdmin ? await fetchAdminPrompts() : await fetchMyPrompts();
      setItems(data.items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载提示词失败");
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadPrompts();
  }, [loadPrompts]);

  const loadSharePreview = useCallback(async (value: string) => {
    const shareId = extractShareId(value);
    if (!shareId) {
      toast.error("请输入分享链接或分享 ID");
      return null;
    }
    setIsImportingShare(true);
    try {
      const data = await fetchPromptShare(shareId);
      setShareInput(shareId);
      setSharePreview(data.item);
      return data.item;
    } catch (error) {
      setSharePreview(null);
      toast.error(error instanceof Error ? error.message : "读取分享失败");
      return null;
    } finally {
      setIsImportingShare(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get("share") || params.get("shared") || "";
    if (!shareId) {
      return;
    }
    setShareDialogOpen(true);
    setShareInput(shareId);
    void loadSharePreview(shareId);
  }, [loadSharePreview]);

  const openCreateDialog = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (item: PromptLibraryItem) => {
    setEditingItem(item);
    setForm(toForm(item));
    setDialogOpen(true);
  };

  const updateForm = (updates: Partial<PromptFormState>) => {
    setForm((current) => ({ ...current, ...updates }));
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setIsUploading(true);
    try {
      const result = isAdmin ? await uploadPromptExampleImage(file) : await uploadMyPromptExampleImage(file);
      setForm((current) => {
        if (!current.preview.trim()) {
          return { ...current, preview: result.url };
        }
        const urls = splitUrls(current.reference_image_urls);
        return { ...current, reference_image_urls: [...urls, result.url].join("\n") };
      });
      toast.success("示例图已上传");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    const payload = toPayload(form);
    if (!payload.title || !payload.prompt) {
      toast.error("请填写标题和提示词");
      return;
    }
    setIsSaving(true);
    try {
      const data = editingItem
        ? isAdmin
          ? await updateAdminPrompt(editingItem.id, payload)
          : await updateMyPrompt(editingItem.id, payload)
        : isAdmin
          ? await createAdminPrompt(payload)
          : await createMyPrompt(payload);
      setItems(data.items);
      setDialogOpen(false);
      toast.success(editingItem ? "提示词已更新" : "提示词已添加");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: PromptLibraryItem) => {
    if (!window.confirm(`删除「${item.title}」？`)) {
      return;
    }
    try {
      const data = isAdmin ? await deleteAdminPrompt(item.id) : await deleteMyPrompt(item.id);
      setItems(data.items);
      toast.success("提示词已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const copyPrompt = async (item: PromptLibraryItem) => {
    await navigator.clipboard.writeText(item.prompt);
    toast.success("提示词已复制");
  };

  const sharePromptItem = async (item: PromptLibraryItem) => {
    try {
      const data = await createPromptShare({ ...toPayload(toForm(item)), source_prompt_id: item.id });
      const shareUrl = shareUrlFromId(data.share_id);
      if (navigator.share) {
        try {
          await navigator.share({ title: item.title, text: item.description || item.title, url: shareUrl });
          toast.success("分享已打开");
          return;
        } catch {
          // Fall back to clipboard below when native sharing is cancelled or unavailable.
        }
      }
      await navigator.clipboard.writeText(shareUrl);
      toast.success("分享链接已复制");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "分享失败");
    }
  };

  const handleSubmitForReview = async (item: PromptLibraryItem) => {
    try {
      const data = await submitMyPrompt(item.id);
      setItems(data.items);
      toast.success("已推送给管理员审核");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提交失败");
    }
  };

  const handleAssistantGenerate = async () => {
    const goal = assistantGoal.trim();
    if (!goal) {
      toast.error("请先描述你想生成的图片");
      return;
    }
    setIsAssistantLoading(true);
    try {
      const data = await generatePromptWithAssistant({
        goal,
        style: assistantStyle.trim(),
        mode: "generate",
      });
      setAssistantResult(data.prompt);
      toast.success("提示词已生成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成提示词失败");
    } finally {
      setIsAssistantLoading(false);
    }
  };

  const useAssistantResult = () => {
    if (!assistantResult.trim()) {
      return;
    }
    setEditingItem(null);
    setForm({
      ...emptyForm,
      title: assistantGoal.trim().slice(0, 32) || "AI 生成提示词",
      description: assistantStyle.trim(),
      prompt: assistantResult.trim(),
    });
    setDialogOpen(true);
  };

  const copyAssistantResult = async () => {
    if (!assistantResult.trim()) {
      return;
    }
    await navigator.clipboard.writeText(assistantResult);
    toast.success("提示词已复制");
  };

  const handleApprove = async (item: PromptLibraryItem) => {
    try {
      const data = await approveAdminPrompt(item.id);
      setItems(data.items);
      toast.success("已加入公共提示词库");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "审核失败");
    }
  };

  const handleReject = async (item: PromptLibraryItem) => {
    const reason = window.prompt(`驳回「${item.title}」的原因（可留空）`) || "";
    try {
      const data = await rejectAdminPrompt(item.id, reason);
      setItems(data.items);
      toast.success("已驳回");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "驳回失败");
    }
  };

  const handleImportShare = async () => {
    const shareId = extractShareId(shareInput);
    if (!shareId) {
      toast.error("请输入分享链接或分享 ID");
      return;
    }
    setIsImportingShare(true);
    try {
      await importPromptShare(shareId, isAdmin ? "public" : "personal");
      await loadPrompts();
      setShareDialogOpen(false);
      setShareInput("");
      setSharePreview(null);
      toast.success(isAdmin ? "已导入公共提示词库" : "已导入我的提示词");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导入失败");
    } finally {
      setIsImportingShare(false);
    }
  };
  const formPreviewUrl = resolveApiAssetUrl(form.preview);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">Prompts</div>
          <h1 className="text-2xl font-semibold tracking-tight">{isAdmin ? "提示词管理" : "我的提示词"}</h1>
          <p className="text-sm text-stone-500">
            {isAdmin ? "审核用户提交的提示词，维护公共提示词库。" : "创建、分享和提交自己的提示词，审核通过后会进入公共库。"}
          </p>
        </div>
        <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-auto">
          <Button
            variant="outline"
            onClick={() => setShareDialogOpen(true)}
            className="h-10 justify-center rounded-xl border-stone-200 bg-white px-4 text-stone-700"
          >
            <Upload className="size-4" />
            导入分享
          </Button>
          <Button variant="outline" onClick={() => void loadPrompts()} disabled={isLoading} className="h-10 justify-center rounded-xl border-stone-200 bg-white px-4 text-stone-700">
            <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
            刷新
          </Button>
          <Button onClick={openCreateDialog} className="h-10 justify-center rounded-xl bg-stone-950 px-4 text-white hover:bg-stone-800">
            <Plus className="size-4" />
            {isAdmin ? "添加公共提示词" : "添加提示词"}
          </Button>
        </div>
      </div>

      {!isAdmin ? (
        <div className="rounded-lg border border-rose-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                <Bot className="size-4 text-rose-500" />
                提示词助手
              </div>
              <p className="mt-1 text-sm text-stone-500">描述你要的画面，免费生成可直接用于创作台的商业提示词。</p>
            </div>
            <Button onClick={() => void handleAssistantGenerate()} disabled={isAssistantLoading || !assistantGoal.trim()} className="h-10 rounded-xl bg-rose-500 px-4 text-white hover:bg-rose-600">
              {isAssistantLoading ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
              生成提示词
            </Button>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_220px]">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-stone-500">画面需求</span>
              <Textarea
                value={assistantGoal}
                onChange={(event) => setAssistantGoal(event.target.value)}
                placeholder="例如：给一款高端护肤精华做电商主图，背景干净，有水润质感和高级光影"
                className="min-h-[112px] resize-y rounded-xl border-stone-200 bg-stone-50 text-sm leading-6"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-stone-500">风格偏好</span>
              <Input
                value={assistantStyle}
                onChange={(event) => setAssistantStyle(event.target.value)}
                placeholder="高端、清透、胶片等"
                className="h-10 rounded-xl border-stone-200 bg-stone-50"
              />
            </label>
          </div>
          {isAssistantLoading ? (
            <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
              <LoaderCircle className="mr-2 inline size-4 animate-spin text-rose-500" />
              正在整理主体、光线、构图和商业用途...
            </div>
          ) : null}
          {assistantResult ? (
            <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="mb-2 text-xs font-medium text-stone-500">生成结果</div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-stone-700">{assistantResult}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void copyAssistantResult()} className="h-9 rounded-xl border-stone-200 bg-white px-3 text-stone-700">
                  <Copy className="size-4" />
                  复制
                </Button>
                <Button type="button" onClick={useAssistantResult} className="h-9 rounded-xl bg-stone-950 px-3 text-white hover:bg-stone-800">
                  <Plus className="size-4" />
                  存为我的提示词
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="yan-panel flex flex-col gap-3 rounded-lg p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、作者、分类或提示词内容"
              className="h-10 rounded-xl border-stone-200 bg-stone-50 pl-9 shadow-none focus-visible:bg-white"
            />
          </div>
          <div className="text-sm text-stone-500">共 {items.length} 条，当前 {filteredItems.length} 条</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={cn(
                "h-9 rounded-full border px-3 text-xs font-medium transition",
                category === item
                  ? "border-stone-900 bg-stone-950 text-white"
                  : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900",
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatusFilter(item)}
              className={cn(
                "h-9 rounded-full border px-3 text-xs font-medium transition",
                statusFilter === item
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[320px] items-center justify-center text-sm text-stone-500">
          <LoaderCircle className="mr-2 size-4 animate-spin" />
          正在加载提示词
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed border-rose-100 bg-white/60 text-sm text-stone-500">
          没有找到提示词
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => {
            const previewUrl = resolveApiAssetUrl(item.preview);
            const status = promptStatus(item);
            const editable = isAdmin || canUserEdit(item);
            const removable = isAdmin || canUserEdit(item);
            const canSubmit = !isAdmin && (status === "personal" || status === "rejected");
            const canReview = isAdmin && status === "submitted";
            return (
              <article key={item.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                <div className="aspect-[4/3] bg-stone-100">
                  {previewUrl ? (
                    <img src={previewUrl} alt={`${item.title} 示例图`} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-stone-400">
                      <ImagePlus className="size-8" />
                    </div>
                  )}
                </div>
                <div className="flex min-h-[230px] flex-col gap-3 p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={normalizeMode(item.mode) === "edit" ? "info" : "success"}>{modeLabel(item.mode)}</Badge>
                    <Badge variant={statusBadgeVariant(status)}>{statusLabel(status)}</Badge>
                    <Badge variant="outline">{categoryLabel(item)}</Badge>
                  </div>
                  <div className="min-w-0">
                    <h2 className="line-clamp-2 text-sm font-semibold leading-5 text-stone-950">{item.title}</h2>
                    {item.description ? <p className="mt-1 truncate text-xs text-stone-400">{item.description}</p> : null}
                    <p className="mt-2 line-clamp-4 text-xs leading-5 text-stone-500">{summarizePrompt(item.prompt)}</p>
                    {status === "rejected" && item.rejection_reason ? (
                      <p className="mt-2 line-clamp-2 rounded-lg bg-rose-50 px-2 py-1.5 text-xs leading-5 text-rose-600">
                        {item.rejection_reason}
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 truncate text-xs text-stone-400">
                      {item.owner_name ? `${item.owner_name} · ` : ""}
                      {item.author || "未署名"}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 sm:shrink-0 sm:flex-nowrap">
                      <Button variant="ghost" size="icon" className="size-8 rounded-lg text-stone-500 hover:bg-stone-100" onClick={() => void copyPrompt(item)} aria-label="复制提示词" title="复制提示词">
                        <Copy className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 rounded-lg text-stone-500 hover:bg-stone-100" onClick={() => void sharePromptItem(item)} aria-label="分享提示词" title="分享提示词">
                        <Share2 className="size-4" />
                      </Button>
                      {canSubmit ? (
                        <Button variant="ghost" size="icon" className="size-8 rounded-lg text-amber-600 hover:bg-amber-50" onClick={() => void handleSubmitForReview(item)} aria-label="提交审核" title="提交审核">
                          <Upload className="size-4" />
                        </Button>
                      ) : null}
                      {canReview ? (
                        <>
                          <Button variant="ghost" size="icon" className="size-8 rounded-lg text-emerald-600 hover:bg-emerald-50" onClick={() => void handleApprove(item)} aria-label="通过审核" title="通过审核">
                            <CheckCircle2 className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8 rounded-lg text-rose-600 hover:bg-rose-50" onClick={() => void handleReject(item)} aria-label="驳回提示词" title="驳回提示词">
                            <XCircle className="size-4" />
                          </Button>
                        </>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!editable}
                        className="size-8 rounded-lg text-stone-500 hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-300"
                        onClick={() => openEditDialog(item)}
                        aria-label="编辑提示词"
                        title="编辑提示词"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!removable}
                        className="size-8 rounded-lg text-rose-500 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-stone-300"
                        onClick={() => void handleDelete(item)}
                        aria-label="删除提示词"
                        title="删除提示词"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="w-[min(94vw,560px)] max-w-none rounded-lg p-0">
          <DialogHeader className="border-b border-stone-200 px-5 pt-5 pb-4 sm:px-6">
            <DialogTitle className="text-xl font-semibold text-stone-950">导入分享提示词</DialogTitle>
            <DialogDescription className="text-stone-500">
              粘贴别人分享的链接或分享 ID，确认后会导入到{isAdmin ? "公共提示词库" : "我的提示词"}。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 py-5 sm:px-6">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-stone-500">分享链接 / ID</span>
              <Input
                value={shareInput}
                onChange={(event) => {
                  setShareInput(event.target.value);
                  setSharePreview(null);
                }}
                placeholder="例如 https://.../prompt-manager?share=xxxx"
                className="h-10 rounded-xl border-stone-200"
              />
            </label>
            {sharePreview ? (
              <div className="rounded-lg border border-rose-100 bg-rose-50/45 p-4">
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge variant={normalizeMode(sharePreview.mode) === "edit" ? "info" : "success"}>
                    {modeLabel(sharePreview.mode)}
                  </Badge>
                  <Badge variant="outline">{categoryLabel(sharePreview)}</Badge>
                </div>
                <div className="text-sm font-semibold text-stone-950">{sharePreview.title}</div>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-stone-500">
                  {sharePreview.description || summarizePrompt(sharePreview.prompt)}
                </p>
              </div>
            ) : null}
          </div>
          <div className="grid gap-2 border-t border-stone-200 px-5 py-4 sm:flex sm:justify-end sm:px-6">
            <Button type="button" variant="outline" onClick={() => setShareDialogOpen(false)} className="h-10 w-full rounded-xl border-stone-200 bg-white px-4 sm:w-auto">
              取消
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadSharePreview(shareInput)}
              disabled={isImportingShare || !shareInput.trim()}
              className="h-10 w-full rounded-xl border-stone-200 bg-white px-4 sm:w-auto"
            >
              {isImportingShare ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
              预览
            </Button>
            <Button
              type="button"
              onClick={() => void handleImportShare()}
              disabled={isImportingShare || !shareInput.trim()}
              className="h-10 w-full rounded-xl bg-stone-950 px-4 text-white hover:bg-stone-800 sm:w-auto"
            >
              {isImportingShare ? <LoaderCircle className="size-4 animate-spin" /> : null}
              导入
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[88vh] w-[min(94vw,860px)] max-w-none flex-col overflow-hidden rounded-lg p-0">
          <DialogHeader className="border-b border-stone-200 px-5 pt-5 pb-4 sm:px-6">
            <DialogTitle className="text-xl font-semibold text-stone-950">
              {editingItem ? "编辑提示词" : "添加提示词"}
            </DialogTitle>
            <DialogDescription className="text-stone-500">
              标题、卡片描述、提示词和示例图会同步到画图页。
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-stone-500">标题</span>
                  <Input value={form.title} onChange={(event) => updateForm({ title: event.target.value })} className="h-10 rounded-xl border-stone-200" />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-stone-500">卡片描述</span>
                  <Input value={form.description} onChange={(event) => updateForm({ description: event.target.value })} className="h-10 rounded-xl border-stone-200" />
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-stone-500">模式</span>
                    <Select value={form.mode} onValueChange={(value) => updateForm({ mode: normalizeMode(value) })}>
                      <SelectTrigger className="h-10 rounded-xl border-stone-200 shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="generate">文生图</SelectItem>
                        <SelectItem value="edit">图生图</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-stone-500">分类</span>
                    <Input value={form.category} onChange={(event) => updateForm({ category: event.target.value })} className="h-10 rounded-xl border-stone-200" />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-stone-500">子分类</span>
                    <Input value={form.sub_category} onChange={(event) => updateForm({ sub_category: event.target.value })} className="h-10 rounded-xl border-stone-200" />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-stone-500">默认比例</span>
                    <Input value={form.image_size} onChange={(event) => updateForm({ image_size: event.target.value })} placeholder="例如 4:3、1:1，留空为未指定" className="h-10 rounded-xl border-stone-200" />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-stone-500">默认张数</span>
                    <Input value={form.image_count} onChange={(event) => updateForm({ image_count: event.target.value })} placeholder="例如 1，留空则不覆盖" className="h-10 rounded-xl border-stone-200" />
                  </label>
                </div>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-stone-500">提示词</span>
                  <Textarea
                    value={form.prompt}
                    onChange={(event) => updateForm({ prompt: event.target.value })}
                    className="min-h-[260px] resize-y rounded-xl border-stone-200 text-sm leading-6"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-stone-500">作者</span>
                    <Input value={form.author} onChange={(event) => updateForm({ author: event.target.value })} className="h-10 rounded-xl border-stone-200" />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-stone-500">来源链接</span>
                    <Input value={form.link} onChange={(event) => updateForm({ link: event.target.value })} className="h-10 rounded-xl border-stone-200" />
                  </label>
                </div>
              </div>
              <div className="space-y-4">
                <input ref={uploadInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleUpload(event)} />
                <div className="space-y-2">
                  <span className="text-xs font-medium text-stone-500">示例图</span>
                  <div className="aspect-[4/3] overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                    {formPreviewUrl ? (
                      <img src={formPreviewUrl} alt="示例图预览" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-stone-400">
                        <ImagePlus className="size-8" />
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => uploadInputRef.current?.click()}
                    disabled={isUploading}
                    className="h-10 w-full rounded-xl border-stone-200 bg-white"
                  >
                    {isUploading ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                    上传示例图
                  </Button>
                </div>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-stone-500">示例图 URL</span>
                  <Input value={form.preview} onChange={(event) => updateForm({ preview: event.target.value })} className="h-10 rounded-xl border-stone-200" />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-stone-500">参考图 URL</span>
                  <Textarea
                    value={form.reference_image_urls}
                    onChange={(event) => updateForm({ reference_image_urls: event.target.value })}
                    className="min-h-[132px] resize-y rounded-xl border-stone-200 text-sm leading-6"
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="grid gap-2 border-t border-stone-200 px-5 py-4 sm:flex sm:justify-end sm:px-6">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10 w-full rounded-xl border-stone-200 bg-white px-4 sm:w-auto">
              取消
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={isSaving} className="h-10 w-full rounded-xl bg-stone-950 px-4 text-white hover:bg-stone-800 sm:w-auto">
              {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default function PromptManagerPage() {
  const { isCheckingAuth, session } = useAuthGuard();
  if (isCheckingAuth || !session) {
    return <div className="flex min-h-[40vh] items-center justify-center"><LoaderCircle className="size-5 animate-spin text-stone-400" /></div>;
  }
  return <PromptManagerContent session={session} />;
}
