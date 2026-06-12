"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Copy, ImageIcon, LoaderCircle, RotateCcw, Save, Share2, Sparkles, WandSparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  createMyPrompt,
  createPromptShare,
  fetchPromptLibrary,
  type PromptLibraryItem,
  type PromptLibraryPayload,
} from "@/lib/api";
import { resolveApiAssetUrl } from "@/lib/assets";
import { cn } from "@/lib/utils";
import type { ImageConversation, ImageTurnStatus, StoredImage, StoredReferenceImage } from "@/store/image-conversations";

export type ImageLightboxItem = {
  id: string;
  src: string;
  sizeLabel?: string;
  dimensions?: string;
};

type ImageResultsProps = {
  selectedConversation: ImageConversation | null;
  onOpenLightbox: (images: ImageLightboxItem[], index: number) => void;
  onContinueEdit: (conversationId: string, image: StoredImage | StoredReferenceImage, promptDraft?: string) => void;
  onUsePromptDraft: (
    prompt: string,
    options?: { mode?: string; size?: string; count?: string; referenceImages?: StoredReferenceImage[] },
  ) => void;
  onRetryTurn: (conversationId: string, turnId: string) => void | Promise<void>;
  formatConversationTime: (value: string) => string;
};

type EmptyStatePromptSource = {
  id?: string;
  title?: string;
  label?: string;
  fallbackTitle: string;
  fallbackDescription?: string;
  fallbackPreview: string;
};

const emptyStateHeroSource: EmptyStatePromptSource = {
  id: "glasses",
  fallbackTitle: "不知道适合什么眼镜？",
  fallbackDescription: "面部特征分析 + 眼镜搭配指南",
  fallbackPreview: "https://cdn3.ldstatic.com/optimized/4X/f/d/3/fd350eb34e18b9bd60706b1820a89bf03730f824_2_600x750.jpeg",
};

const emptyStateExampleSources: EmptyStatePromptSource[] = [
  {
    title: "中国神话角色Q版组合插画",
    label: "国风插画",
    fallbackTitle: "中国神话角色Q版组合插画",
    fallbackPreview: "/banana-prompt-quicker/images/chinese_mythology_characters.jpg",
  },
  {
    title: "生成商业促销海报",
    label: "产品海报",
    fallbackTitle: "生成商业促销海报",
    fallbackPreview: "/banana-prompt-quicker/images/promo_poster.jpg",
  },
  {
    id: "handwritten-notes",
    label: "手写笔记风格",
    fallbackTitle: "手写笔记风格",
    fallbackPreview: "https://cdn3.ldstatic.com/optimized/4X/a/7/c/a7c6e18b0b22cd9f305cedec8aa55aecc8fae4d4_2_499x750.jpeg",
  },
  {
    id: "photo-portrait-v1",
    label: "写真随机风格 V1",
    fallbackTitle: "写真随机风格 V1",
    fallbackPreview: "/banana-prompt-quicker/images/fashion_portrait_collage.jpg",
  },
];

const emptyStatePreviewOverrides: Record<string, string> = {
  "photo-portrait-v1": "/banana-prompt-quicker/images/fashion_portrait_collage.jpg",
};

function buildPromptShareTitle(prompt: string) {
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "未命名提示词";
  }
  return cleaned.length > 24 ? `${cleaned.slice(0, 24)}...` : cleaned;
}

function shareUrlFromId(shareId: string) {
  if (typeof window === "undefined") {
    return `/prompt-manager?share=${encodeURIComponent(shareId)}`;
  }
  return `${window.location.origin}/prompt-manager?share=${encodeURIComponent(shareId)}`;
}

async function sharePromptPayload(payload: PromptLibraryPayload) {
  const data = await createPromptShare(payload);
  const shareUrl = shareUrlFromId(data.share_id);
  if (navigator.share) {
    try {
      await navigator.share({ title: payload.title, text: payload.description || payload.title, url: shareUrl });
      return "shared";
    } catch {
      // Fall back to clipboard below when native sharing is cancelled or unavailable.
    }
  }
  await navigator.clipboard.writeText(shareUrl);
  return "copied";
}

export function ImageResults({
  selectedConversation,
  onOpenLightbox,
  onContinueEdit,
  onUsePromptDraft,
  onRetryTurn,
  formatConversationTime,
}: ImageResultsProps) {
  const [imageDimensions, setImageDimensions] = useState<Record<string, string>>({});
  const [promptLibraryItems, setPromptLibraryItems] = useState<PromptLibraryItem[]>([]);

  useEffect(() => {
    if (selectedConversation) {
      return;
    }

    let cancelled = false;
    void fetchPromptLibrary()
      .then((data) => {
        if (!cancelled) {
          setPromptLibraryItems(data.items || data.prompts || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPromptLibraryItems([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedConversation]);

  const emptyStateHero = useMemo(() => buildEmptyStatePromptPreview(emptyStateHeroSource, promptLibraryItems), [promptLibraryItems]);
  const emptyStateExamples = useMemo(
    () => emptyStateExampleSources.map((source) => buildEmptyStatePromptPreview(source, promptLibraryItems)),
    [promptLibraryItems],
  );

  const updateImageDimensions = (id: string, width: number, height: number) => {
    const dimensions = formatImageDimensions(width, height);
    setImageDimensions((current) => {
      if (current[id] === dimensions) {
        return current;
      }
      return { ...current, [id]: dimensions };
    });
  };

  const copyTurnPrompt = async (prompt: string) => {
    const cleaned = prompt.trim();
    if (!cleaned) {
      toast.error("没有可复制的提示词");
      return;
    }
    await navigator.clipboard.writeText(cleaned);
    toast.success("提示词已复制");
  };

  const shareTurnPrompt = async (turn: { prompt: string; mode: string; size: string; count: number }) => {
    const cleaned = turn.prompt.trim();
    if (!cleaned) {
      toast.error("没有可分享的提示词");
      return;
    }
    try {
      const result = await sharePromptPayload({
        title: buildPromptShareTitle(cleaned),
        description: turn.mode === "edit" ? "图生图提示词" : "文生图提示词",
        prompt: cleaned,
        mode: turn.mode,
        image_size: turn.size,
        image_count: String(turn.count),
      });
      toast.success(result === "shared" ? "分享已打开" : "分享链接已复制");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "分享失败");
    }
  };

  const saveTurnPrompt = async (turn: { prompt: string; mode: string; size: string; count: number }) => {
    const cleaned = turn.prompt.trim();
    if (!cleaned) {
      toast.error("没有可保存的提示词");
      return;
    }
    try {
      await createMyPrompt({
        title: buildPromptShareTitle(cleaned),
        description: turn.mode === "edit" ? "从创作结果保存的图生图提示词" : "从创作结果保存的文生图提示词",
        prompt: cleaned,
        mode: turn.mode,
        image_size: turn.size,
        image_count: String(turn.count),
      });
      toast.success("已保存到我的提示词");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    }
  };

  const buildStyleShiftPrompt = (prompt: string) =>
    `${prompt.trim()}\n\n基于这张图换一种更有新鲜感的视觉风格：保留主体和核心构图，重新调整光线、色彩、氛围和画面质感，让结果更像一张完成度更高的作品。`;

  const buildEnhancePrompt = () =>
    "基于这张图做高清质感增强：保留主体、构图、身份和画面内容不变，提升清晰度、细节、光影层次和色彩质感，降低噪点和压缩痕迹，保持真实自然，不要改变人物五官或主体结构。";

  if (!selectedConversation) {
    return (
      <div className="grid gap-4 sm:min-h-[520px] sm:items-center lg:grid-cols-[minmax(0,1.08fr)_minmax(280px,.92fr)]">
        <div className="relative min-h-[280px] overflow-hidden rounded-lg border border-white/70 bg-white/52 shadow-sm sm:min-h-[420px]">
          <img
            src={emptyStateHero.preview}
            alt={emptyStateHero.title}
            className="absolute inset-0 h-full w-full object-cover opacity-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#2d1d26]/70 via-[#2d1d26]/12 to-white/10" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <div className="inline-flex rounded-full bg-white/18 px-3 py-1 text-xs font-semibold backdrop-blur">示例预览</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">{emptyStateHero.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/78">{emptyStateHero.description}</p>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-lg border border-white/70 bg-white/58 p-4">
            <div className="grid size-12 place-items-center rounded-lg bg-gradient-to-br from-rose-100 to-fuchsia-100 text-rose-500">
              <ImageIcon className="size-5" />
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-stone-950">从右侧创作台开始</h1>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              支持文生图、图生图、参考图上传和粘贴、提示词库、队列恢复、灯箱预览与继续编辑。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {emptyStateExamples.map((item) => (
              <div key={item.label} className="rounded-lg border border-white/70 bg-gradient-to-br from-white/76 to-rose-50/70 p-3">
                <div className="h-20 overflow-hidden rounded-lg border border-white/70 bg-rose-50">
                  <img src={item.preview} alt={`${item.label}示例`} className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="mt-3 text-sm font-semibold text-stone-800">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {selectedConversation.turns.map((turn, turnIndex) => {
        const referenceLightboxImages = turn.referenceImages.map((image, index) => ({
          id: `${turn.id}-reference-${index}`,
          src: image.dataUrl,
        }));
        const successfulTurnImages = turn.images.flatMap((image) =>
          image.status === "success" && (image.b64_json || image.url)
            ? [
                {
                  id: image.id,
                  src: image.b64_json ? `data:image/png;base64,${image.b64_json}` : image.url || "",
                  sizeLabel: image.b64_json ? formatBase64ImageSize(image.b64_json) : undefined,
                  dimensions: imageDimensions[image.id],
                },
              ]
            : [],
        );

        return (
          <section key={turn.id} className="overflow-hidden rounded-lg border border-white/70 bg-white/46 shadow-sm">
            <div className="border-b border-rose-100/70 bg-white/56 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-2 text-[11px] font-medium text-stone-400">
                    <span>第 {turnIndex + 1} 轮</span>
                    <span>{turn.mode === "edit" ? "图生图" : "文生图"}</span>
                    <span>{getTurnStatusLabel(turn.status)}</span>
                    <span>{formatConversationTime(turn.createdAt)}</span>
                  </div>
                  <p className="line-clamp-2 text-sm leading-6 text-stone-800">{turn.prompt}</p>
                </div>
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:items-center sm:gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 justify-center rounded-lg border-rose-100 bg-white/85 px-2.5 text-stone-700 hover:bg-white sm:justify-start"
                    onClick={() => void copyTurnPrompt(turn.prompt)}
                  >
                    <Copy className="size-4" />
                    复制
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 justify-center rounded-lg border-rose-100 bg-white/85 px-2.5 text-stone-700 hover:bg-white sm:justify-start"
                    onClick={() => void shareTurnPrompt(turn)}
                  >
                    <Share2 className="size-4" />
                    分享
                  </Button>
                  {turn.status === "error" ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 justify-center rounded-lg border-amber-200 bg-amber-50 px-2.5 text-amber-800 hover:bg-amber-100 sm:justify-start"
                        onClick={() => void onRetryTurn(selectedConversation.id, turn.id)}
                      >
                        <RotateCcw className="size-4" />
                        重试
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 justify-center rounded-lg border-rose-100 bg-white/85 px-2.5 text-stone-700 hover:bg-white sm:justify-start"
                        onClick={() =>
                          onUsePromptDraft(turn.prompt, {
                            mode: turn.mode,
                            size: turn.size,
                            count: "1",
                            referenceImages: turn.referenceImages,
                          })
                        }
                      >
                        改成 1 张
                      </Button>
                    </>
                  ) : null}
                  <div className="flex h-9 items-center justify-center rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-stone-600">
                    {turn.count} 张
                  </div>
                </div>
              </div>
            </div>

            {turn.referenceImages.length > 0 ? (
              <div className="border-b border-rose-100/60 px-4 py-3">
                <div className="mb-3 text-xs font-semibold text-stone-500">本轮参考图</div>
                <div className="flex flex-wrap gap-3">
                  {turn.referenceImages.map((image, index) => (
                    <div key={`${turn.id}-${image.name}-${index}`} className="flex items-end gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenLightbox(referenceLightboxImages, index)}
                        className="group relative size-20 overflow-hidden rounded-lg border border-rose-100 bg-rose-50/60 text-left transition hover:border-rose-200"
                        aria-label={`预览参考图 ${image.name || index + 1}`}
                      >
                        <img
                          src={image.dataUrl}
                          alt={image.name || `参考图 ${index + 1}`}
                          className="absolute inset-0 h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                        />
                      </button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg border-rose-100 bg-white/85 text-stone-700 hover:bg-white"
                        onClick={() => onContinueEdit(selectedConversation.id, image)}
                      >
                        <Sparkles className="size-4" />
                        加入编辑
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {turn.images.map((image, index) => {
                const featured = index === 0 && turn.images.length > 1;

                if (image.status === "success" && (image.b64_json || image.url)) {
                  const currentIndex = successfulTurnImages.findIndex((item) => item.id === image.id);
                  const imageSrc = image.b64_json ? `data:image/png;base64,${image.b64_json}` : image.url || "";
                  const sizeLabel = image.b64_json ? formatBase64ImageSize(image.b64_json) : "";
                  const dimensions = imageDimensions[image.id];
                  const imageMeta = [sizeLabel, dimensions].filter(Boolean).join(" · ");

                  return (
                    <div
                      key={image.id}
                      className={cn(
                        "group overflow-hidden rounded-lg border border-white/75 bg-white/78 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_54px_rgba(84,38,62,0.16)]",
                        featured && "md:row-span-2",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onOpenLightbox(successfulTurnImages, Math.max(0, currentIndex))}
                        className={cn("relative block w-full cursor-zoom-in overflow-hidden bg-stone-100", featured ? "aspect-[3/4]" : getImageAspectClass(turn.size))}
                      >
                        <img
                          src={imageSrc}
                          alt={`Generated result ${index + 1}`}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025] group-hover:brightness-90"
                          onLoad={(event) => {
                            updateImageDimensions(
                              image.id,
                              event.currentTarget.naturalWidth,
                              event.currentTarget.naturalHeight,
                            );
                          }}
                        />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/55 to-transparent px-3 pt-10 pb-3 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                          <div className="text-left text-xs font-medium text-white/90">点击放大预览</div>
                        </div>
                      </button>
                      <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 text-xs text-stone-500">
                          <span>结果 {index + 1}</span>
                          {imageMeta ? <span className="ml-2 text-stone-400">{imageMeta}</span> : null}
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="justify-center rounded-lg border-rose-100 bg-white/85 text-stone-700 hover:bg-white"
                            onClick={() => onContinueEdit(selectedConversation.id, image)}
                          >
                            <Sparkles className="size-4" />
                            编辑
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="justify-center rounded-lg border-rose-100 bg-white/85 text-stone-700 hover:bg-white"
                            onClick={() => onContinueEdit(selectedConversation.id, image, buildStyleShiftPrompt(turn.prompt))}
                          >
                            <WandSparkles className="size-4" />
                            换风格
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="justify-center rounded-lg border-rose-100 bg-white/85 text-stone-700 hover:bg-white"
                            onClick={() => onContinueEdit(selectedConversation.id, image, buildEnhancePrompt())}
                          >
                            <Sparkles className="size-4" />
                            增强
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="justify-center rounded-lg border-rose-100 bg-white/85 text-stone-700 hover:bg-white"
                            onClick={() => void saveTurnPrompt(turn)}
                          >
                            <Save className="size-4" />
                            保存
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (image.status === "error") {
                  return (
                    <div
                      key={image.id}
                      className={cn(
                        "overflow-hidden rounded-lg border border-rose-200 bg-rose-50",
                        getImageAspectClass(turn.size),
                        featured && "md:row-span-2",
                      )}
                    >
                      <div className="flex h-full items-center justify-center px-6 py-8 text-center text-sm leading-6 text-rose-600">
                        <div className="space-y-3">
                          <div>{image.error || "生成失败"}</div>
                          <div className="flex flex-wrap justify-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg border-rose-100 bg-white/85 text-stone-700"
                              onClick={() =>
                                onUsePromptDraft(turn.prompt, {
                                  mode: turn.mode,
                                  size: turn.size,
                                  count: "1",
                                  referenceImages: turn.referenceImages,
                                })
                              }
                            >
                              改成 1 张
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg border-rose-100 bg-white/85 text-stone-700"
                              onClick={() => void copyTurnPrompt(turn.prompt)}
                            >
                              <Copy className="size-4" />
                              复制提示词
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={image.id}
                    className={cn(
                      "overflow-hidden rounded-lg border border-rose-100/80 bg-rose-50/70",
                      getImageAspectClass(turn.size),
                      featured && "md:row-span-2",
                    )}
                  >
                    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-8 text-center text-stone-500">
                      <div className="rounded-full bg-white p-3 shadow-sm">
                        {turn.status === "queued" ? (
                          <Clock3 className="size-5" />
                        ) : (
                          <LoaderCircle className="size-5 animate-spin" />
                        )}
                      </div>
                      <p className="text-sm">{turn.status === "queued" ? "已加入当前对话队列..." : "正在处理图片..."}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {turn.status === "queued" ? (
              <div className="mx-4 mb-4 rounded-lg bg-amber-50/70 px-4 py-3 text-sm leading-6 text-amber-700">
                等待当前对话中的前序任务完成
              </div>
            ) : null}

            {turn.status === "error" && turn.error ? (
              <div className="mx-4 mb-4 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm leading-6 text-amber-700">
                {turn.error}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function getImageAspectClass(size: string) {
  if (size === "1:1") return "aspect-square";
  if (size === "16:9") return "aspect-video";
  if (size === "9:16") return "aspect-[9/16]";
  if (size === "4:3") return "aspect-[4/3]";
  if (size === "3:4") return "aspect-[3/4]";
  return "aspect-[4/3]";
}

function findPromptPreview(source: EmptyStatePromptSource, items: PromptLibraryItem[]) {
  return items.find((item) => (source.id ? item.id === source.id : false) || (source.title ? item.title === source.title : false));
}

function buildEmptyStatePromptPreview(source: EmptyStatePromptSource, items: PromptLibraryItem[]) {
  const prompt = findPromptPreview(source, items);
  const previewOverride = source.id ? emptyStatePreviewOverrides[source.id] : "";
  return {
    label: source.label || prompt?.title || source.fallbackTitle,
    title: prompt?.title || source.fallbackTitle,
    description: prompt?.description || source.fallbackDescription || "",
    preview: resolveApiAssetUrl(previewOverride || prompt?.preview || source.fallbackPreview),
  };
}

function getTurnStatusLabel(status: ImageTurnStatus) {
  if (status === "queued") {
    return "排队中";
  }
  if (status === "generating") {
    return "处理中";
  }
  if (status === "success") {
    return "已完成";
  }
  return "失败";
}

function formatBase64ImageSize(base64: string) {
  const normalized = base64.replace(/\s/g, "");
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  const bytes = Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);

  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

function formatImageDimensions(width: number, height: number) {
  return `${width} x ${height}`;
}
