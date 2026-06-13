# Coachmark Creation Guide Design

## Summary

YanAI will reduce first-run friction in the image workspace with a coachmark walkthrough: a floating guidance bubble that attaches to the next relevant control, explains one action, and moves forward when the user clicks "下一步".

This is not a chat-style wizard and not a blocking form wizard. The creation workspace remains usable. The guide appears automatically only for a user's first visit to `/image`, can be skipped, and can later be replayed from a visible "新手引导" action.

## Goals

- Help first-time users complete their first image generation without reading the whole interface.
- Keep the creation canvas as the primary product surface.
- Avoid forcing experienced users through repeated onboarding.
- Explain quota cost before generation.
- Improve accessibility for guided onboarding, keyboard users, and reduced-motion users.
- Support the broader user-side hardening direction from the frontend audit.

## Non-Goals

- Do not redesign `/image` into a full multi-page wizard.
- Do not remove history, prompt library, reference images, or advanced settings.
- Do not introduce a third-party tour library unless local implementation proves too brittle.
- Do not add smart behavioral triggers in this phase, such as idle detection or failure-triggered tips.

## Primary User Flow

The first time a user opens `/image`, the guide starts after the workspace is loaded and the session is valid.

1. The first coachmark targets the prompt textarea.
   - Title: `先写画面描述`
   - Body: `在这里输入你想生成的内容。可以先写得很粗略，之后还能补充参考图、比例和数量。`
2. The second coachmark targets the mode selector.
   - Title: `选择生成方式`
   - Body: `文生图适合从一句话开始。图生图适合基于参考图继续修改。`
3. The third coachmark targets reference-image upload.
   - If current mode is `edit`, show this step.
   - If current mode is `generate`, skip this step.
   - Title: `添加参考图`
   - Body: `图生图需要至少一张参考图。你可以上传，也可以直接粘贴图片。`
4. The fourth coachmark targets size and count controls.
   - Title: `确认比例和张数`
   - Body: `比例会影响画面构图，张数会影响本次额度消耗。建议第一次先生成 1 张。`
5. The fifth coachmark targets the generate button and quota hint.
   - Title: `开始生成`
   - Body: `点击后结果会出现在画布区域。失败时可以在结果卡片里重试或改成 1 张再试。`

At the end, the guide stores completion in local storage scoped by user identity when possible. If no stable user id is available, use the existing image conversation owner key.

## Replay Flow

The workspace header adds a secondary "新手引导" button.

- Clicking it always starts the coachmark guide from step 1.
- Manual replay does not change first-run completion state except when the user reaches the end.
- The button is visible enough to find, but secondary to creation.

## Interaction Model

The coachmark is a floating panel with:

- Step indicator: `1 / 5`
- Title
- Short body text
- `上一步` when applicable
- `下一步` or `完成`
- `跳过`
- `关闭` icon with accessible label `关闭新手引导`

When a step starts:

- The target element is scrolled into view with nearest alignment.
- The target receives a visible highlight ring.
- The coachmark positions itself near the target and avoids viewport overflow.
- On mobile, the coachmark uses a bottom sheet style when there is not enough room near the target.

The guide should not block normal page interaction except for focus management inside the guide controls. Users can still scroll. If a target is missing, disabled, or hidden, the guide skips to the next valid step.

## Visual Design

The coachmark uses YanAI's existing rose and ink palette.

- Panel background: deep ink for emphasis or white panel with rose highlight, depending on contrast against the current surface.
- Highlight: rose ring with subtle shadow, no heavy overlay.
- No full-screen dimmer by default. A full-screen dimmer would make the workspace feel modal and less canvas-first.
- Motion: quick fade/translate only, disabled under `prefers-reduced-motion`.
- Radius: match the existing 8px to 12px product vocabulary.

## Mobile Behavior

On small screens:

- The target still receives a highlight ring.
- The coachmark appears as a bottom sheet anchored above safe-area padding.
- The guide uses `上一步`, `下一步`, and `跳过` as full-width or well-spaced controls.
- Step copy must not refer to left, right, or desktop position.
- The first-run guide starts only after the composer and target controls exist in the DOM.

## Accessibility

Because the coachmark has interactive controls, treat it as a non-modal dialog/popover, not as a plain tooltip.

- Use `role="dialog"` or an equivalent semantic wrapper with `aria-labelledby` and `aria-describedby`.
- Move focus to the coachmark panel when it opens.
- Return focus to the replay button, start target, or a safe workspace element when the guide closes.
- Support `Esc` to close.
- Ensure `Tab` reaches coachmark controls in a predictable order.
- Add `aria-current="step"` or clear step text for screen readers.
- The target highlight cannot be the only state cue; the coachmark text must identify the target.
- Respect `prefers-reduced-motion`.

## State And Storage

Use local storage keys scoped to the user:

- `yanai:image-guide:v1:<ownerKey>:completed`
- `yanai:image-guide:v1:<ownerKey>:dismissed`

Rules:

- If `completed` or `dismissed` is true, do not auto-start.
- Manual replay ignores both flags.
- Increment the guide version when the guide content or target list changes materially.
- If local storage is unavailable, the guide still works manually but does not auto-persist.

## Error And Edge Cases

- If the user is not authenticated, do not start the guide on the loading/auth guard screen.
- If a target is missing, skip the step and continue.
- If every target is missing, do not show the guide.
- If the prompt composer is disabled or a generation is running, show the guide only when controls are stable.
- If the user switches mode from `generate` to `edit` during the guide, recompute whether the reference image step should appear.
- If the viewport resizes, reposition the coachmark.
- If the user navigates away, close the guide and keep prior completion state unchanged unless the guide was completed or skipped.

## Implementation Shape

Create a focused guide component instead of embedding the logic directly into `web/src/app/image/page.tsx`.

Recommended units:

- `web/src/app/image/components/image-onboarding-guide.tsx`
  - Owns coachmark rendering, step state, target lookup, positioning, keyboard controls, persistence, and replay.
- `web/src/app/image/components/image-guide-targets.ts`
  - Defines stable target ids and guide step metadata.
- Small attributes added to existing controls:
  - `data-guide-target="prompt"`
  - `data-guide-target="mode"`
  - `data-guide-target="reference"`
  - `data-guide-target="settings"`
  - `data-guide-target="generate"`
- `web/src/app/globals.css`
  - Add reduced-motion safety if no existing rule covers the guide.

Avoid large rewrites of the image generation queue in this phase.

## Testing Strategy

Add focused tests for pure logic where possible:

- First-run storage gate starts only when not completed/dismissed.
- Manual replay starts even after completion.
- Step list skips reference step in `generate` mode.
- Step list includes reference step in `edit` mode.
- Missing target handling skips invalid steps.

Add browser/manual verification:

- Desktop first-run guide appears on `/image`.
- `跳过` persists dismissal.
- `完成` persists completion.
- Manual "新手引导" restarts after dismissal/completion.
- Mobile guide uses bottom sheet behavior and no horizontal overflow.
- Keyboard can navigate the guide and `Esc` closes it.
- Reduced motion mode does not animate the guide.

## References

- Nielsen Norman Group guidance on instructional overlays and coach marks: keep guidance contextual, short, and easy to dismiss.
- WAI-ARIA guidance for interactive popover/dialog behavior: interactive coachmarks must not be implemented as non-interactive tooltips.
