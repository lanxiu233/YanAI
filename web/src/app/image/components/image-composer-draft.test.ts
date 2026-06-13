import { describe, expect, it } from "vitest";

import {
  createImageComposerDraft,
  getImageComposerDraftStorageKey,
  parseImageComposerDraft,
} from "./image-composer-draft";

describe("image composer draft", () => {
  it("scopes draft storage by owner", () => {
    expect(getImageComposerDraftStorageKey("user-1")).toBe("yanai:image-composer-draft:v1:user-1");
  });

  it("does not create a draft for an empty default composer", () => {
    expect(
      createImageComposerDraft(
        {
          imageCount: "1",
          imageSize: "",
          mode: "generate",
          prompt: "",
        },
        "2026-06-13T00:00:00.000Z",
      ),
    ).toBeNull();
  });

  it("creates a draft when the prompt has content", () => {
    expect(
      createImageComposerDraft(
        {
          imageCount: "1",
          imageSize: "3:4",
          mode: "generate",
          prompt: "  一张柔光人像  ",
        },
        "2026-06-13T00:00:00.000Z",
      ),
    ).toEqual({
      imageCount: "1",
      imageSize: "3:4",
      mode: "generate",
      prompt: "一张柔光人像",
      updatedAt: "2026-06-13T00:00:00.000Z",
    });
  });

  it("parses a valid stored draft", () => {
    expect(
      parseImageComposerDraft(
        JSON.stringify({
          imageCount: "2",
          imageSize: "1:1",
          mode: "edit",
          prompt: "换成杂志封面",
          updatedAt: "2026-06-13T00:00:00.000Z",
        }),
      ),
    ).toEqual({
      imageCount: "2",
      imageSize: "1:1",
      mode: "edit",
      prompt: "换成杂志封面",
      updatedAt: "2026-06-13T00:00:00.000Z",
    });
  });

  it("rejects invalid stored drafts", () => {
    expect(parseImageComposerDraft("not-json")).toBeNull();
    expect(parseImageComposerDraft(JSON.stringify({ mode: "bad", prompt: "x" }))).toBeNull();
  });
});
