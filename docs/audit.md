# values-demo audit

Baseline commit `97e1e53`. No source changed. 45 screenshots in `docs/audit-shots/`
(`<viewport>-s<step>-<name>-<start|middle|end>.png`), captured in real time. Steps: hero, case,
response, dashboard, focus. Overflow figures come from DOM measurement, not only eyeballing.

## 1. Overflow / clipping

- 1440x900 and 1920x1080: none. Nothing scrolls or touches the HUD (lowest content 822px vs HUD top 988px at 1080p).
- 390x844, step 2 (case): content is 810px in a 660px scroll box. At rest Option 2 is cut off and
  sits under the HUD. Only scrolling reveals it, with no affordance.
- 390x844, step 3 (response): content is 1094px in the same box. At rest the response text is cut
  mid-sentence under the HUD and both options are off screen, so the "Extracted choice" outline is never seen.
- 390x844, step 4 (dashboard): card spans -31px to 840px of an 844px viewport. Its top is clipped,
  so the "VALUEPRISM" / "02 · Dashboard" header is hidden behind the card. The last row (`run_0409`)
  sits under the HUD. The page has `overflow: hidden`, so none of it can be scrolled.
- 390x844, steps 1 and 5: clean. Not measured: the PAUSED pill (hidden during autoplay).

## 2. Does render() receive elapsed time?

No, you are right.
- `types.ts`: `render: () => ReactNode`. `DemoPlayer.tsx:22` calls `step.render()` with no arguments.
- `usePlayback.ts` keeps `elapsed` in a private ref and returns only `progress` (0..1), used by the HUD.
- `demoSteps.tsx:387-390` acknowledges this and passes `response={{}}`, so `ModelResponse` gets
  `elapsedMs === undefined` and shows the settled end state.
- Confirmed in `1440x900-s3-response-start.png` (0.5s in): response, highlight and outline are all
  already visible. The 12s timeline in `demoData.ts` never plays.
- `Stage` is `memo` on `step`, and steps 2 and 3 share the id `clinical-case`, so that slide never remounts.

## 3. File verdicts

KEEP
- `App.tsx`, `main.tsx`, `index.css`: trivial bootstrap; tokens and no-scroll reset are sound.
- `usePlayback.ts`: pause-aware clock works; it just doesn't expose elapsed.
- `components/Hud.tsx`: works; at 390px it covers content, but the layout is the cause.
- `components/PausedBadge.tsx`: fine apart from the em dash (section 4).
- `components/ClinicalCaseCard.tsx`: used; renders case and options correctly.
- `components/ModelResponse.tsx`: already driven purely by `elapsedMs`, correct once fed a clock.
- `components/ProviderIcon.tsx`, `components/AnimatedHighlight.tsx`: both used.
- `data/demoData.ts`: single content source; TODOs remain (empty `valueProfiles`, `regressionRows`, definitions).
- `assets/neurips-logo.svg`, `assets/providers/openai.svg`: both used.
- `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`, `package-lock.json`, `.gitignore`: config, no issues.

REWRITE
- `types.ts`: `render` signature has no room for elapsed time.
- `DemoPlayer.tsx`: calls `render()` bare; memoised `Stage` blocks updates.
- `demoSteps.tsx`: response step gets no clock; dashboard and focus are placeholder content
  (fake "1,284 cases" metrics); dashboard overflows at 390px.

DELETE
- `components/TypewriterText.tsx`: unused; own `setInterval`, so it would not pause with playback.
- `components/PrinciplistFramework.tsx`: unused; its value definitions are empty strings.
- `components/RadarChart.tsx`: unused; `valueProfiles` is empty.
- `components/ValueBadge.tsx`: unused; annotations are all pending.

## 4. Em dashes in user-facing copy

- `components/PausedBadge.tsx:25`: "PAUSED — press Space to continue" (md and up, while paused).
- None in `demoData.ts` or step copy. Other em dashes are in code comments only.
