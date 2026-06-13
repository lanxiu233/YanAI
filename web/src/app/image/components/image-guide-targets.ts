import type { ImageConversationMode } from "@/store/image-conversations";

export const IMAGE_GUIDE_VERSION = "v1";

export type ImageGuideTarget = "prompt" | "mode" | "reference" | "settings" | "generate";

export type ImageGuideStep = {
  target: ImageGuideTarget;
  title: string;
  body: string;
};

const IMAGE_GUIDE_STEPS: ImageGuideStep[] = [
  {
    target: "prompt",
    title: "先写画面描述",
    body: "在这里输入你想生成的内容。第一次可以先写粗一点，后面再补参考图、比例和张数。",
  },
  {
    target: "mode",
    title: "选择生成方式",
    body: "文生图适合从一句话开始。图生图适合基于参考图继续修改。",
  },
  {
    target: "reference",
    title: "添加参考图",
    body: "图生图需要至少一张参考图。你可以上传，也可以直接把图片粘贴到描述框里。",
  },
  {
    target: "settings",
    title: "确认比例和张数",
    body: "比例会影响画面构图，张数会影响本次额度消耗。建议第一次先生成 1 张。",
  },
  {
    target: "generate",
    title: "开始生成",
    body: "点击后结果会出现在画布区域。失败时可以在结果卡片里重试，或改成 1 张再试。",
  },
];

export function getImageGuideSteps(mode: ImageConversationMode) {
  return IMAGE_GUIDE_STEPS.filter((step) => mode === "edit" || step.target !== "reference");
}

export function getImageGuideStorageKeys(ownerKey: string) {
  const scopedOwnerKey = ownerKey || "anonymous";
  return {
    completed: `yanai:image-guide:${IMAGE_GUIDE_VERSION}:${scopedOwnerKey}:completed`,
    dismissed: `yanai:image-guide:${IMAGE_GUIDE_VERSION}:${scopedOwnerKey}:dismissed`,
  };
}

export function shouldStartImageGuide({
  completed,
  dismissed,
  manual,
}: {
  completed: boolean;
  dismissed: boolean;
  manual: boolean;
}) {
  return manual || (!completed && !dismissed);
}
