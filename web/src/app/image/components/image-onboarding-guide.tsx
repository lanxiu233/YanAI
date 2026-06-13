"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ImageConversationMode } from "@/store/image-conversations";
import { cn } from "@/lib/utils";

import {
  getImageGuideSteps,
  getImageGuideStorageKeys,
  shouldStartImageGuide,
  type ImageGuideStep,
  type ImageGuideTarget,
} from "./image-guide-targets";

type ImageOnboardingGuideProps = {
  ownerKey: string;
  mode: ImageConversationMode;
  autoStartReady: boolean;
  replaySignal: number;
};

type GuidePosition = {
  left: number;
  top: number;
  placement: "above" | "below" | "sheet";
};

const GUIDE_PANEL_WIDTH = 336;
const GUIDE_PANEL_GAP = 14;

function readStorageFlag(key: string) {
  try {
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeStorageFlag(key: string) {
  try {
    window.localStorage.setItem(key, "true");
  } catch {
    // Persistence is best-effort. The guide should still be usable manually.
  }
}

function isVisibleTarget(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  const disabled = "disabled" in element && Boolean(element.disabled);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && !disabled;
}

function findTargetElement(target: ImageGuideTarget) {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(`[data-guide-target="${target}"]`));
  return elements.find(isVisibleTarget) ?? null;
}

function calculateGuidePosition(targetElement: HTMLElement): GuidePosition {
  const targetRect = targetElement.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (viewportWidth < 640) {
    return {
      left: 12,
      top: Math.max(12, viewportHeight - 244),
      placement: "sheet",
    };
  }

  const left = Math.min(
    viewportWidth - GUIDE_PANEL_WIDTH - 16,
    Math.max(16, targetRect.left + targetRect.width / 2 - GUIDE_PANEL_WIDTH / 2),
  );
  const belowTop = targetRect.bottom + GUIDE_PANEL_GAP;
  const aboveTop = targetRect.top - GUIDE_PANEL_GAP - 206;
  const hasRoomBelow = belowTop + 206 < viewportHeight;

  return {
    left,
    top: Math.max(16, hasRoomBelow ? belowTop : aboveTop),
    placement: hasRoomBelow ? "below" : "above",
  };
}

export function ImageOnboardingGuide({ ownerKey, mode, autoStartReady, replaySignal }: ImageOnboardingGuideProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastReplaySignalRef = useRef(replaySignal);
  const autoStartOwnerRef = useRef<string | null>(null);
  const focusReturnRef = useRef<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTargetElement, setActiveTargetElement] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState<GuidePosition | null>(null);

  const steps = useMemo(() => getImageGuideSteps(mode), [mode]);
  const storageKeys = useMemo(() => getImageGuideStorageKeys(ownerKey), [ownerKey]);
  const activeStep: ImageGuideStep | null = steps[activeIndex] ?? null;

  const moveFocusBack = useCallback(() => {
    const returnTarget = focusReturnRef.current;
    if (returnTarget && document.contains(returnTarget)) {
      returnTarget.focus();
    }
  }, []);

  const closeGuide = useCallback(
    ({ persistDismissal }: { persistDismissal: boolean }) => {
      if (persistDismissal) {
        writeStorageFlag(storageKeys.dismissed);
      }
      setIsOpen(false);
      setActiveTargetElement(null);
      setPosition(null);
      window.setTimeout(moveFocusBack, 0);
    },
    [moveFocusBack, storageKeys.dismissed],
  );

  const completeGuide = useCallback(() => {
    writeStorageFlag(storageKeys.completed);
    setIsOpen(false);
    setActiveTargetElement(null);
    setPosition(null);
    window.setTimeout(moveFocusBack, 0);
  }, [moveFocusBack, storageKeys.completed]);

  const startGuide = useCallback(
    (manual: boolean) => {
      const canStart = shouldStartImageGuide({
        completed: readStorageFlag(storageKeys.completed),
        dismissed: readStorageFlag(storageKeys.dismissed),
        manual,
      });

      if (!canStart || steps.length === 0) {
        return;
      }

      focusReturnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setActiveIndex(0);
      setIsOpen(true);
    },
    [steps.length, storageKeys.completed, storageKeys.dismissed],
  );

  useEffect(() => {
    if (!autoStartReady || autoStartOwnerRef.current === ownerKey) {
      return;
    }

    autoStartOwnerRef.current = ownerKey;
    const timeout = window.setTimeout(() => startGuide(false), 350);
    return () => window.clearTimeout(timeout);
  }, [autoStartReady, ownerKey, startGuide]);

  useEffect(() => {
    if (lastReplaySignalRef.current === replaySignal) {
      return;
    }

    lastReplaySignalRef.current = replaySignal;
    startGuide(true);
  }, [replaySignal, startGuide]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    let frameId = 0;

    const syncTarget = () => {
      const validIndex = steps.findIndex((step, index) => index >= activeIndex && findTargetElement(step.target));
      if (validIndex === -1) {
        closeGuide({ persistDismissal: false });
        return;
      }

      const targetElement = findTargetElement(steps[validIndex].target);
      if (!targetElement || cancelled) {
        return;
      }

      if (validIndex !== activeIndex) {
        setActiveIndex(validIndex);
      }

      targetElement.scrollIntoView({ block: "nearest", inline: "nearest" });
      frameId = window.requestAnimationFrame(() => {
        if (cancelled) {
          return;
        }
        setActiveTargetElement(targetElement);
        setPosition(calculateGuidePosition(targetElement));
      });
    };

    syncTarget();
    const handleViewportChange = () => syncTarget();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [activeIndex, closeGuide, isOpen, steps]);

  useEffect(() => {
    if (!activeTargetElement) {
      return;
    }

    activeTargetElement.setAttribute("data-guide-active", "true");
    return () => {
      activeTargetElement.removeAttribute("data-guide-active");
    };
  }, [activeTargetElement]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timeout = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => window.clearTimeout(timeout);
  }, [activeIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeGuide({ persistDismissal: true });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeGuide, isOpen]);

  useEffect(() => {
    if (activeIndex < steps.length) {
      return;
    }

    setActiveIndex(Math.max(0, steps.length - 1));
  }, [activeIndex, steps.length]);

  if (!isOpen || !activeStep || !position) {
    return null;
  }

  const isFirstStep = activeIndex === 0;
  const isLastStep = activeIndex === steps.length - 1;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="image-guide-title"
      aria-describedby="image-guide-body"
      tabIndex={-1}
      className={cn(
        "fixed z-[80] w-[min(21rem,calc(100vw-1.5rem))] rounded-xl border border-white/15 bg-[#2a1822] p-4 text-white shadow-[0_24px_80px_-28px_rgba(42,24,34,0.65)] outline-none transition duration-150",
        position.placement === "sheet" && "right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-3 top-auto w-auto",
      )}
      style={position.placement === "sheet" ? undefined : { left: position.left, top: position.top }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-full bg-white/12 px-2.5 py-1 text-xs font-medium text-white/72">
          {activeIndex + 1} / {steps.length}
        </div>
        <button
          type="button"
          onClick={() => closeGuide({ persistDismissal: true })}
          className="grid size-7 shrink-0 place-items-center rounded-lg text-white/64 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
          aria-label="关闭新手引导"
        >
          <X className="size-4" />
        </button>
      </div>
      <h2 id="image-guide-title" className="mt-3 text-base font-semibold leading-6 tracking-normal text-white">
        {activeStep.title}
      </h2>
      <p id="image-guide-body" className="mt-2 text-sm leading-6 text-white/72">
        {activeStep.body}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button
          type="button"
          onClick={() => closeGuide({ persistDismissal: true })}
          className="h-9 rounded-lg px-3 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
        >
          跳过
        </button>
        {!isFirstStep ? (
          <button
            type="button"
            onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
            className="h-9 rounded-lg border border-white/14 px-3 text-sm font-medium text-white/78 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
          >
            上一步
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (isLastStep) {
              completeGuide();
              return;
            }
            setActiveIndex((index) => Math.min(steps.length - 1, index + 1));
          }}
          className="col-span-2 h-9 rounded-lg bg-white px-3 text-sm font-semibold text-[#2a1822] transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55 sm:col-span-1"
        >
          {isLastStep ? "完成" : "下一步"}
        </button>
      </div>
    </div>
  );
}
