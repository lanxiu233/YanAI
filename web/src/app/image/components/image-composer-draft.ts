export const IMAGE_COMPOSER_DRAFT_VERSION = "v1";

export type ImageComposerDraftMode = "generate" | "edit";

export type ImageComposerDraft = {
  prompt: string;
  mode: ImageComposerDraftMode;
  imageCount: string;
  imageSize: string;
  updatedAt: string;
};

type ImageComposerDraftInput = {
  prompt: string;
  mode: ImageComposerDraftMode;
  imageCount: string;
  imageSize: string;
};

export function getImageComposerDraftStorageKey(ownerKey: string) {
  const scopedOwnerKey = ownerKey || "anonymous";
  return `yanai:image-composer-draft:${IMAGE_COMPOSER_DRAFT_VERSION}:${scopedOwnerKey}`;
}

function normalizeImageCount(value: string) {
  const count = Math.max(1, Math.min(10, Number(value) || 1));
  return String(count);
}

export function createImageComposerDraft(input: ImageComposerDraftInput, updatedAt = new Date().toISOString()) {
  const prompt = input.prompt.trim();
  const mode = input.mode === "edit" ? "edit" : "generate";
  const imageCount = normalizeImageCount(input.imageCount);
  const imageSize = input.imageSize.trim();
  const isDefault = !prompt && mode === "generate" && imageCount === "1" && !imageSize;

  if (isDefault) {
    return null;
  }

  return {
    prompt,
    mode,
    imageCount,
    imageSize,
    updatedAt,
  } satisfies ImageComposerDraft;
}

export function parseImageComposerDraft(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ImageComposerDraft>;
    if (parsed.mode !== "generate" && parsed.mode !== "edit") {
      return null;
    }
    if (typeof parsed.prompt !== "string" || typeof parsed.imageCount !== "string" || typeof parsed.imageSize !== "string") {
      return null;
    }

    return {
      prompt: parsed.prompt.trim(),
      mode: parsed.mode,
      imageCount: normalizeImageCount(parsed.imageCount),
      imageSize: parsed.imageSize.trim(),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    } satisfies ImageComposerDraft;
  } catch {
    return null;
  }
}
