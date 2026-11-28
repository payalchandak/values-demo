import { useLayoutEffect, useState } from "react";
import { NEUTRAL } from "../../design";
import { CARD_CLASS, CARD_SURFACE } from "./cardClass";
import { openingCase } from "./openingCase";
import { openingRows } from "./openingRows";

const clamp01 = (n: number): number => Math.min(Math.max(n, 0), 1);
const ramp = (x: number, a: number, b: number): number => clamp01((x - a) / (b - a));

/** The card's border, top and bottom. */
const BORDER_PX = 2;
/** The header is a slimmer card than the full case: less padding above and below its one line. */
const HEADER_PAD = "0.6em";

function useHeight() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    if (!node) return;
    const measure = () => setHeight(node.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);
  return [setNode, height] as const;
}

/**
 * The case card on its way to a one-line header. `tuck` is 0..1 and is the only
 * input, so a seek shows the exact frame. The card keeps its border and
 * surface and only its height changes: the full text fades out over the first
 * half and the vignette's first sentence fades in across the middle, cut to one line by CSS.
 */
export default function TuckedCase({ tuck, shared }: { tuck: number; shared: boolean }) {
  const p = clamp01(tuck);
  const [fullRef, fullH] = useHeight();
  const [lineRef, lineH] = useHeight();
  const frame = { borderColor: NEUTRAL.line, color: NEUTRAL.ink };
  const header = (
    <p className="truncate leading-[1.5]" ref={lineRef} data-case-header>
      {openingRows.caseHeader}
    </p>
  );

  if (p >= 1) {
    return (
      <div
        data-shared={shared ? "patient" : undefined}
        className={CARD_CLASS}
        style={{ ...frame, paddingTop: HEADER_PAD, paddingBottom: HEADER_PAD }}
      >
        {header}
      </div>
    );
  }

  const full = fullH + BORDER_PX;
  const height =
    fullH === 0 || lineH === 0
      ? undefined
      : `calc(${full * (1 - p)}px + (${lineH + BORDER_PX}px + 2 * ${HEADER_PAD}) * ${p})`;
  return (
    <div
      data-shared={shared ? "patient" : undefined}
      className={`${CARD_SURFACE} relative overflow-hidden`}
      style={{ ...frame, height }}
    >
      <div ref={fullRef} className="p-[0.9em]" style={{ opacity: 1 - ramp(p, 0, 0.5) }}>
        <p className="leading-[1.5]" style={{ textWrap: "pretty" }}>
          {openingCase.vignette}
        </p>
      </div>
      <div
        className="absolute inset-x-[0.9em]"
        style={{ top: HEADER_PAD, opacity: ramp(p, 0.3, 0.8) }}
        aria-hidden={p < 0.5}
      >
        {header}
      </div>
    </div>
  );
}
