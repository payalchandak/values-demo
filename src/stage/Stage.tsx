import { useLayoutEffect, useRef } from "react";
import type { ChapterContext } from "../types";
import { beatStart, chapterDuration } from "../types";
import ProviderIcon from "../components/ProviderIcon";
import openaiLogo from "../assets/providers/openai.svg";
import OpeningScene from "../chapters/opening/OpeningScene";
import { markSpinDeg, modelHandoff } from "../chapters/opening/timeline";
import VoteScene from "../chapters/vote/VoteScene";
import { casesBeats } from "../chapters/cases/beats";
import IndividualModels from "../chapters/ending/IndividualModels";
import ModelsAndPhysicians from "../chapters/ending/ModelsAndPhysicians";
import { AUTOPLAY_MODELS, GALLERY_PHYSICIANS, INDIVIDUAL_MODELS } from "../chapters/ending/profiles";
import { individualLabelWeight } from "../chapters/ending/beats";
import { clamp01, easeInOut } from "../chapters/ending/shared";
import { FADE_MS } from "../design/motion";
import { gptProfile } from "./data";
import Morph from "./Morph";
import { MORPH_LEAD_MS, MORPH_TIMING, morphBeats } from "./morphBeats";
import {
  headlineAt,
  isOpening,
  openingTime,
  SEGMENT_OFFSET,
  type HeadlineState,
  type SegmentId,
} from "./plan";

const ICON_SIZE = 40;
/** Hand-off cross-fade: the previous chapter's last frame fades out over the start of the next. */
const GHOST_MS = FADE_MS;

const ramp = (t: number, a: number, b: number) => (b <= a ? (t >= b ? 1 : 0) : clamp01((t - a) / (b - a)));

/* -------------------------------------------------------------------------- */
/*  The persistent OpenAI icon                                                */
/* -------------------------------------------------------------------------- */

interface IconPlan {
  from: string | null;
  to?: string;
  /** 0 = at `from`, 1 = at `to`. */
  mix: number;
  opacity: number;
  /** Fade out as the anchor leaves the scene area (the scrolling profile list). */
  clipToScene?: boolean;
}

/**
 * Where the icon is, as a pure function of the chapter and its clock. Anchors
 * are real elements the scenes leave behind (`data-anchor`); One element, one image, never remounted.
 */
function iconPlan(segment: SegmentId, e: number): IconPlan {
  switch (segment) {
    case "opening-hook":
    case "opening-dilemma":
      return { from: null, mix: 0, opacity: 0 };
    case "opening-framework":
      // The model has not answered yet: the shared icon waits for the model chapter.
      return { from: null, mix: 0, opacity: 0 };
    case "opening-model":
      return { from: "icon-response", mix: 0, opacity: modelHandoff(e).responseEnter };
    case "cases":
      // Every card draws its own icon, so the pile fades it with the card.
      return { from: null, mix: 0, opacity: 0 };
    case "individual-models": {
      // Through the bars-to-donut, the icon fades in at the hole as the labels arrive.
      // Then it sits there and cross-fades with the next model's icon.
      if (e < MORPH_LEAD_MS) {
        const r = beatStart(morphBeats, "labels");
        return { from: "icon-label", mix: 0, opacity: easeInOut(ramp(e, r, r + MORPH_TIMING.labelsMs)), clipToScene: true };
      }
      return {
        from: "icon-label",
        mix: 0,
        opacity: individualLabelWeight(e - MORPH_LEAD_MS, INDIVIDUAL_MODELS[0].key),
        clipToScene: true,
      };
    }
    default:
      return { from: null, mix: 0, opacity: 0 };
  }
}

/** First live element with this anchor name (never one in the hidden measuring copies). */
function findAnchor(root: HTMLElement, name: string): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>(`[data-anchor="${name}"]`)) {
    if (!el.closest("[data-probe]")) return el;
  }
  return null;
}

/** Positions the icon over its anchors. Writes styles directly: no state, no extra renders. */
function placeIcon(root: HTMLElement, icon: HTMLElement, plan: IconPlan) {
  const box = root.getBoundingClientRect();
  const rectOf = (name: string | null | undefined) => {
    if (!name) return null;
    return findAnchor(root, name)?.getBoundingClientRect() ?? null;
  };
  const a = rectOf(plan.from);
  const b = rectOf(plan.to);
  const mix = plan.mix;
  const at = mix >= 1 ? (b ?? a) : mix <= 0 ? (a ?? b) : a && b ? null : (a ?? b);
  let left: number, top: number, size: number;
  if (at) {
    left = at.left;
    top = at.top;
    size = at.width;
  } else if (a && b) {
    left = a.left + (b.left - a.left) * mix;
    top = a.top + (b.top - a.top) * mix;
    size = a.width + (b.width - a.width) * mix;
  } else {
    icon.style.opacity = "0";
    return;
  }
  let opacity = plan.opacity;
  if (plan.clipToScene) {
    const zone = root.querySelector("[data-scene-zone]")?.getBoundingClientRect();
    if (zone) {
      const cy = top + size / 2;
      opacity *= clamp01(Math.min(cy - zone.top, zone.bottom - cy) / 24);
    }
  }
  icon.style.opacity = String(opacity);
  icon.style.transform = `translate(${left - box.left}px, ${top - box.top}px) scale(${size / ICON_SIZE})`;
}

/* -------------------------------------------------------------------------- */
/*  Headline                                                                  */
/* -------------------------------------------------------------------------- */

function Headline({ state }: { state: HeadlineState }) {
  return (
    <div
      className="grid shrink-0 place-items-center px-12 text-center text-xl font-semibold leading-snug tracking-tight text-[#1B2433] sm:text-2xl md:text-3xl"
      style={{ minHeight: "4.5rem" }}
    >
      <span className="col-start-1 row-start-1 text-balance" style={{ opacity: 1 - state.mix }} aria-hidden>
        {state.previous}
      </span>
      <span className="col-start-1 row-start-1 text-balance" style={{ opacity: state.mix }}>
        {state.current}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stage                                                                     */
/* -------------------------------------------------------------------------- */

const CASES_END = chapterDuration({ beats: casesBeats });

/**
 * The one stage every chapter renders into. It is a single component, never
 * keyed by chapter, so it stays mounted from the first frame to the last:
 * the opening layer, the scene layer and the OpenAI icon all persist, and what
 * changes between chapters is only the clock position each scene is drawn at.
 */
export default function Stage({ segment, ctx }: { segment: SegmentId; ctx: ChapterContext }) {
  const e = Math.max(0, ctx.elapsedMs);
  const T = SEGMENT_OFFSET[segment] + e;
  const rootRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  const inOpening = isOpening(segment);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const icon = iconRef.current;
    if (!root || !icon) return;
    const plan = iconPlan(segment, e);
    const run = () => placeIcon(root, icon, plan);
    run();
    // The hole slot appears after the donut measures, and moves when the frame
    // changes. Follow it. Ignore our own writes on the icon, or this loops.
    const ro = new ResizeObserver(run);
    ro.observe(root);
    const mo = new MutationObserver((records) => {
      if (records.every((r) => r.target === icon || icon.contains(r.target))) return;
      run();
    });
    mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class"] });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  });
  // Two turns while the model thinks. The turn ends upright.
  const spinDeg = segment === "opening-model" ? markSpinDeg(e) : 0;

  return (
    <div ref={rootRef} data-stage className="relative h-full w-full">
      {inOpening && (
        <div className="absolute inset-0">
          <OpeningScene t={openingTime(segment, e)} sharedIcon />
        </div>
      )}

      {!inOpening && (
        <div className="absolute inset-0 flex flex-col" key="scenes">
          <Headline state={headlineAt(T)} />
          <div data-scene-zone className="relative min-h-0 flex-1">
            {segment === "cases" && <VoteScene elapsedMs={e} profile={gptProfile} />}

            {segment === "individual-models" &&
              (e < MORPH_LEAD_MS ? (
                <>
                  <Morph profile={gptProfile} elapsedMs={e} />
                  {e < GHOST_MS && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 bg-canvas"
                      style={{ opacity: 1 - e / GHOST_MS }}
                    >
                      <VoteScene elapsedMs={CASES_END} profile={gptProfile} />
                    </div>
                  )}
                </>
              ) : (
                <IndividualModels
                  models={INDIVIDUAL_MODELS}
                  elapsedMs={e - MORPH_LEAD_MS}
                  showHeader={false}
                  sharedIconFor={INDIVIDUAL_MODELS[0].key}
                />
              ))}

            {segment === "models-and-physicians" && (
              <ModelsAndPhysicians
                models={AUTOPLAY_MODELS}
                anchorKey={INDIVIDUAL_MODELS[INDIVIDUAL_MODELS.length - 1].key}
                physicians={GALLERY_PHYSICIANS}
                elapsedMs={e}
                onReplay={ctx.restart}
                showHeader={false}
              />
            )}
          </div>
        </div>
      )}

      <div ref={iconRef} aria-hidden className="pointer-events-none absolute left-0 top-0 z-30 origin-top-left" style={{ opacity: 0 }}>
        <div style={{ transform: `rotate(${spinDeg}deg)` }}>
          <ProviderIcon src={openaiLogo} alt="OpenAI" size={ICON_SIZE} />
        </div>
      </div>
    </div>
  );
}
