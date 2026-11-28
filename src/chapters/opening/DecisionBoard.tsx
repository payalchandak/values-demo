import { type ReactNode } from "react";
import ProviderIcon from "../../components/ProviderIcon";
import { openingCase } from "./openingCase";
import { openingRows } from "./openingRows";
import { COLUMN_GAP, DOT_GAP, DOT_SIZE, EDGE_PAD, ICON_GAP, ROW_HEIGHT } from "./rowMetrics";
import { CHARCOAL } from "./charcoal";
import { decisionDotEnter, OFFSETS } from "./timeline";

/**
 * GPT's ten decisions as one dot row under the choices. The first dot is
 * already beside the mark; the other nine land one per spin.
 */

/** Same slot as the opening's mark: 36px at the base size, scaled with the scene. */
function IconSlot({ children, anchor }: { children?: ReactNode; anchor?: string }) {
  return (
    <span
      data-anchor={anchor}
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: "calc(36px * var(--z))", height: "calc(36px * var(--z))" }}
    >
      <span className="inline-flex" style={{ zoom: "var(--z)" }}>
        {children}
      </span>
    </span>
  );
}

function Dot({ opacity }: { opacity: number }) {
  return (
    <span
      aria-hidden
      className="block shrink-0 rounded-full"
      style={{ width: DOT_SIZE, height: DOT_SIZE, backgroundColor: CHARCOAL, opacity }}
    />
  );
}

export default function DecisionBoard({ t, sharedIcon }: { t: number; sharedIcon: boolean }) {
  const gpt = openingRows.models[0];
  const e = t - OFFSETS.model;

  // Dots sit on the side each query chose, in run order. The first is already beside the mark;
  // each later one lands as the mark finishes a spin.
  const dots = (side: 0 | 1) =>
    openingCase.decisions.flatMap((choice, i) => (choice === side ? [<Dot key={i} opacity={i === 0 ? 1 : decisionDotEnter(e, i)} />] : []));

  return (
    <div className="w-full shrink-0">
      <div
        role="img"
        aria-label={`${gpt.name} chose Choice 1 in ${gpt.choice1} of ${gpt.trials} queries`}
        className="grid w-full grid-cols-2 items-center"
        style={{ height: ROW_HEIGHT, columnGap: COLUMN_GAP }}
      >
        <div className="flex min-w-0 items-center" style={{ paddingLeft: EDGE_PAD, gap: ICON_GAP }}>
          <IconSlot anchor={sharedIcon ? "icon-response" : undefined}>
            {sharedIcon ? null : <ProviderIcon src={gpt.logo.src} alt={gpt.logo.alt} size={36} />}
          </IconSlot>
          <span className="flex items-center" style={{ gap: DOT_GAP }}>
            {dots(0)}
          </span>
        </div>
        <div className="flex min-w-0 items-center justify-end" style={{ paddingRight: EDGE_PAD, gap: DOT_GAP }}>
          {dots(1)}
        </div>
      </div>
    </div>
  );
}
