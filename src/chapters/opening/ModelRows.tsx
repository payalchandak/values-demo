import { useLayoutEffect, useState, type ReactNode } from "react";
import ProviderIcon from "../../components/ProviderIcon";
import { NEUTRAL } from "../../design";
import { CHARCOAL } from "./charcoal";
import { openingRows, type ModelRow } from "./openingRows";
import { COLUMN_GAP, DOT_GAP, DOT_SIZE, EDGE_PAD, ICON_GAP, ROW_HEIGHT, iconOnLeft } from "./rowMetrics";
import { modelRowEnter, physicianEnter, physicianRowEnter } from "./timeline";

const clamp01 = (n: number): number => Math.min(Math.max(n, 0), 1);

/** Gap between rows. */
const ROW_GAP = "0.1em";
/** Each physician side is laid out in two groups, so it breaks into two even lines when it cannot fit on one. */
const SIDE_GROUPS = 2;
/** Rows settle in from this far below. */
const ARRIVE_RISE = "0.5em";

function useBoxHeight() {
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

/** Same slot as the opening's mark: 36px at the base size, scaled with the scene. Empty when this side is the minority. */
function IconSlot({ children }: { children?: ReactNode }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: "calc(36px * var(--z))", height: "calc(36px * var(--z))" }}
    >
      {children != null && (
        <span className="inline-flex" style={{ zoom: "var(--z)" }}>
          {children}
        </span>
      )}
    </span>
  );
}

/** One query. Dots are queries; squares (below) are people. */
function Dot({ opacity = 1 }: { opacity?: number }) {
  return (
    <span
      aria-hidden
      className="block shrink-0 rounded-full"
      style={{ width: DOT_SIZE, height: DOT_SIZE, backgroundColor: CHARCOAL, opacity }}
    />
  );
}

const repeat = (n: number, make: (i: number) => ReactNode): ReactNode[] => Array.from({ length: n }, (_, i) => make(i));

function Dots({ n }: { n: number }) {
  return (
    <span className="flex items-center" style={{ gap: DOT_GAP }}>
      {repeat(n, (i) => (
        <Dot key={i} />
      ))}
    </span>
  );
}

function ModelRowView({ row, enter }: { row: ModelRow; enter: number }) {
  const onLeft = iconOnLeft(row.choice1, row.choice2);
  const logo = <ProviderIcon src={row.logo.src} alt={row.logo.alt} size={36} />;
  return (
    <div
      role="img"
      aria-label={`${row.name} chose Choice 1 in ${row.choice1} of ${row.trials} queries`}
      className="grid w-full grid-cols-2 items-center"
      style={{
        height: ROW_HEIGHT,
        columnGap: COLUMN_GAP,
        opacity: enter,
        transform: enter < 1 ? `translateY(calc(${ARRIVE_RISE} * ${1 - enter}))` : undefined,
        visibility: enter === 0 ? "hidden" : undefined,
      }}
    >
      <div className="flex min-w-0 items-center" style={{ paddingLeft: EDGE_PAD, gap: ICON_GAP }}>
        <IconSlot>{onLeft ? logo : null}</IconSlot>
        <Dots n={row.choice1} />
      </div>
      <div className="flex min-w-0 items-center justify-end" style={{ paddingRight: EDGE_PAD, gap: ICON_GAP }}>
        <Dots n={row.choice2} />
        <IconSlot>{onLeft ? null : logo}</IconSlot>
      </div>
    </div>
  );
}

function Square({ enter }: { enter: number }) {
  return (
    <span
      aria-hidden
      className="block shrink-0"
      style={{
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: "0.12em",
        backgroundColor: NEUTRAL.inkMuted,
        opacity: enter,
        transform: enter < 1 ? `scale(${0.5 + 0.5 * enter})` : undefined,
      }}
    />
  );
}

/** One physician side: its squares in P order, in two groups that wrap as even lines only when they must. */
function Squares({ keys, first, t, end }: { keys: readonly string[]; first: number; t: number; end: boolean }) {
  const size = Math.ceil(keys.length / SIDE_GROUPS);
  const groups: string[][] = [];
  for (let i = 0; i < keys.length; i += size) groups.push(keys.slice(i, i + size));
  // The left side fills from the left. The right side fills from the right edge, so its last square lands first.
  let position = 0;
  return (
    <div
      className="flex min-w-0 flex-1 flex-wrap"
      style={{ gap: DOT_GAP, justifyContent: end ? "flex-end" : "flex-start" }}
    >
      {groups.map((group, g) => (
        <div key={g} className="flex shrink-0" style={{ gap: DOT_GAP }}>
          {group.map((key) => {
            const j = position++;
            return <Square key={key} enter={physicianEnter(t, first + (end ? keys.length - 1 - j : j))} />;
          })}
        </div>
      ))}
    </div>
  );
}

function PhysicianRow({ t }: { t: number }) {
  const { left, right, total } = openingRows.physicians;
  const enter = physicianRowEnter(t);
  const onLeft = iconOnLeft(left.length, right.length);
  const badge = (
    <span
      aria-hidden
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full border border-neutral-200 bg-white font-semibold"
      style={{ width: 36, height: 36, fontSize: 13, color: NEUTRAL.inkMuted, opacity: enter }}
    >
      MD
    </span>
  );
  return (
    <>
      <div
        aria-hidden
        style={{ height: 1, backgroundColor: NEUTRAL.line, margin: "0.45em 0", opacity: enter }}
      />
      <div
        role="img"
        aria-label={`${left.length} of ${total} physicians chose Choice 1`}
        className="grid w-full grid-cols-2 items-center"
        style={{ minHeight: ROW_HEIGHT, columnGap: COLUMN_GAP, visibility: enter === 0 ? "hidden" : undefined }}
      >
        <div className="flex min-w-0 items-center" style={{ paddingLeft: EDGE_PAD, gap: ICON_GAP }}>
          <IconSlot>{onLeft ? badge : null}</IconSlot>
          <Squares keys={left} first={0} t={t} end={false} />
        </div>
        <div className="flex min-w-0 items-center justify-end" style={{ paddingRight: EDGE_PAD, gap: ICON_GAP }}>
          <Squares keys={right} first={left.length} t={t} end />
          <IconSlot>{onLeft ? null : badge}</IconSlot>
        </div>
      </div>
      <p
        className="text-center"
        style={{ fontSize: "0.8em", lineHeight: 1.3, marginTop: "0.25em", color: NEUTRAL.inkMuted, opacity: enter }}
      >
        {total} physicians, one vote each
      </p>
    </>
  );
}

/**
 * Rows 2 to 12 and the physician row, under GPT's row. `grow` (0..1) opens
 * their room while the case tucks, so GPT's row glides instead of jumping.
 * Each row's own arrival is a pure function of the opening time `t`.
 */
export default function ModelRows({ t, grow }: { t: number; grow: number }) {
  const [ref, measured] = useBoxHeight();
  const p = clamp01(grow);
  const settled = p >= 1;
  const rows = openingRows.models.slice(1);
  return (
    <div style={{ height: settled ? "auto" : measured === 0 ? 0 : measured * p }}>
      <div ref={ref} className="flex w-full flex-col" style={{ gap: ROW_GAP, paddingTop: ROW_GAP }}>
        {rows.map((row, i) => (
          <ModelRowView key={row.key} row={row} enter={modelRowEnter(t, i)} />
        ))}
        <PhysicianRow t={t} />
      </div>
    </div>
  );
}
