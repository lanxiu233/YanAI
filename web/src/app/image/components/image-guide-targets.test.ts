import { describe, expect, it } from "vitest";

import { getImageGuideSteps, getImageGuideStorageKeys, shouldStartImageGuide } from "./image-guide-targets";

describe("image guide targets", () => {
  it("skips the reference upload step in text-to-image mode", () => {
    expect(getImageGuideSteps("generate").map((step) => step.target)).toEqual([
      "prompt",
      "mode",
      "settings",
      "generate",
    ]);
  });

  it("includes the reference upload step in image-edit mode", () => {
    expect(getImageGuideSteps("edit").map((step) => step.target)).toEqual([
      "prompt",
      "mode",
      "reference",
      "settings",
      "generate",
    ]);
  });

  it("scopes storage keys by guide version and owner", () => {
    expect(getImageGuideStorageKeys("user-123")).toEqual({
      completed: "yanai:image-guide:v1:user-123:completed",
      dismissed: "yanai:image-guide:v1:user-123:dismissed",
    });
  });

  it("does not auto-start after completion or dismissal", () => {
    expect(shouldStartImageGuide({ completed: true, dismissed: false, manual: false })).toBe(false);
    expect(shouldStartImageGuide({ completed: false, dismissed: true, manual: false })).toBe(false);
  });

  it("manual replay bypasses stored completion and dismissal", () => {
    expect(shouldStartImageGuide({ completed: true, dismissed: true, manual: true })).toBe(true);
  });
});
