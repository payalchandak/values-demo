import { Fragment, type CSSProperties, type ReactNode } from "react";
import { FADE_MS, MOVE_MS, VALUES, VALUE_COLORS, valueInk, valueTint } from "../../design";
import type { Chapter } from "../../types";
import type { Profile, StudyCase, Value } from "../../study/types";
import {
  captions,
  easeOut,
  headlines,
  motionAt,
  regressionBeats,
  segment,
  textAt,
  type TextState,
} from "./beats";
import {
  MODEL_RUNS,
  TEMPERATURE,
  VALUE_ORDER,
  bestFitIndex,
  deltaOf,
  logit,
  observedCount,
  sigmoid,
  softmaxSteps,
} from "./data";
import { DEFAULT_PROFILE_KEY, TOTAL_CASES, profileByKey } from "./dataset";
import { CompressBridge } from "./Compress";

/* -------------------------------------------------------------------------- */
/*  Props                                                                     */
/* -------------------------------------------------------------------------- */

export interface RegressionProps {
  /**
   * Exactly three example cases, supplied by the caller (the chapter never names
   * a case). The first row is highlighted as the opening case.
   */
  rows: readonly [StudyCase, StudyCase, StudyCase];
  /** Whose decisions are shown. Defaults to the profile with key `gpt`. */
  profile?: Profile;
  /**
   * Which row (0..2) expands to show the worked prediction. Defaults to the row
   * whose predicted probability is closest to its observed k/10, so the
   * walkthrough lands on a case where the model visibly fits.
   */
  expandedIndex?: number;
  /**
   * Draw the eyebrow and headline. Turn off when a host (the demo stage) shows
   * the headlines itself, from the exported `headlines` table.
   */
  showHeadline?: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Shared bits                                                               */
/* -------------------------------------------------------------------------- */

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

/** Signed number with a real minus sign. */
const signed = (x: number, digits = 2) =>
  `${x < 0 ? "\u2212" : ""}${Math.abs(x).toFixed(digits)}`;
const signedPlus = (x: number, digits = 2) => (x > 0 ? `+${signed(x, digits)}` : signed(x, digits));
const pct = (p: number) => `${Math.round(p * 100)}%`;

const fade = (p: number, rise = 8): CSSProperties => ({
  opacity: p,
  transform: `translateY(${(1 - p) * rise}px)`,
});

const MONO = "font-mono text-[10px] uppercase tracking-widest text-gray-400";

/** Two lines of text stacked in one cell, cross-fading, so a swap never jumps the layout. */
function TextSwap({ state, className }: { state: TextState; className: string }) {
  return (
    <div className={`grid ${className}`}>
      <span className="col-start-1 row-start-1" style={{ opacity: 1 - state.mix }} aria-hidden>
        {state.previous}
      </span>
      <span className="col-start-1 row-start-1" style={{ opacity: state.mix }}>
        {state.current}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Phase A: shared weights, case rows, one row expanded                       */
/* -------------------------------------------------------------------------- */

/** Case label | four value columns | result. Shared by head, rows, and rails. */
const TABLE_COLS = "minmax(4rem,1.3fr) repeat(4,minmax(0,1fr)) minmax(5.5rem,2.4fr)";
const TABLE_GAP = "gap-x-1 sm:gap-x-2";

const ROW_H = 40;
const ELLIPSIS_H = 34;
const PANEL_H = 124;
const BAR_REGION = 92;
const BAR_BASELINE = 66;
const BAR_UP_ROOM = 60;
const BAR_DOWN_ROOM = 22;

/** Pixels per unit of weight, so the largest weight fits whatever its sign. */
function barScale(weights: Record<Value, number>): number {
  const values = VALUE_ORDER.map((v) => weights[v]);
  const up = Math.max(0, ...values);
  const down = Math.max(0, ...values.map((w) => -w));
  return Math.min(up > 0 ? BAR_UP_ROOM / up : Infinity, down > 0 ? BAR_DOWN_ROOM / down : Infinity);
}

function WeightBar({
  value,
  weight,
  scale,
  grow,
}: {
  value: Value;
  weight: number;
  scale: number;
  grow: number;
}) {
  const h = Math.abs(weight) * scale * grow;
  return (
    <div className="relative w-full" style={{ height: BAR_REGION }}>
      <div
        className="absolute left-[15%] right-[15%] h-px bg-gray-300"
        style={{ top: BAR_BASELINE }}
      />
      <div
        className="absolute left-1/2 w-5 -translate-x-1/2 rounded-sm"
        style={{
          top: weight >= 0 ? BAR_BASELINE - h : BAR_BASELINE,
          height: h,
          background: VALUE_COLORS[value],
        }}
      />
    </div>
  );
}

function ValueLabel({ value }: { value: Value }) {
  return (
    <span className="font-medium" style={{ color: valueInk(value) }}>
      <span className="hidden sm:inline">{VALUES[value].name}</span>
      <span className="sm:hidden">{value}</span>
    </span>
  );
}

/** One value's trade-off in a case: Option 1 minus Option 2. */
function DeltaChip({ value, delta, emphasis }: { value: Value; delta: number; emphasis: number }) {
  const mag = Math.abs(delta);
  return (
    <span
      className="relative z-10 flex h-7 w-full max-w-9 items-center justify-center rounded-md border bg-white font-mono text-[11px] font-medium sm:text-xs"
      style={{
        borderColor: mag === 0 ? "#e5e7eb" : valueTint(value, 60),
        backgroundColor:
          mag === 0 ? "#fff" : `color-mix(in srgb, ${VALUE_COLORS[value]} ${mag * 12}%, white)`,
        color: mag === 0 ? "#9ca3af" : valueInk(value),
        boxShadow: emphasis > 0 ? `0 0 0 ${2 * emphasis}px ${valueTint(value, 35)}` : undefined,
      }}
    >
      {delta > 0 ? "+" : delta < 0 ? "\u2212" : ""}
      {mag}
    </span>
  );
}

interface TableProgress {
  rows: number; // linear 0..1
  weights: number;
  links: number;
  open: number;
  tradeoffs: number;
  weighted: number;
  predicted: number;
  observed: number;
}

function ProbabilityBar({
  label,
  value,
  display,
  progress,
  fill,
  hatch,
  detail,
}: {
  label: ReactNode;
  /** 0..1 bar length. Omitted when there is nothing to draw. */
  value: number | undefined;
  display: string;
  progress: number;
  fill: string;
  hatch?: boolean;
  detail?: ReactNode;
}) {
  return (
    <div style={fade(progress, 4)}>
      <div className="text-[10px] leading-tight text-gray-500">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
          {value !== undefined && (
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${value * progress * 100}%`,
                background: hatch
                  ? `repeating-linear-gradient(135deg, ${fill} 0 3px, color-mix(in srgb, ${fill} 45%, white) 3px 6px)`
                  : fill,
              }}
            />
          )}
        </div>
        <span className="w-10 text-right font-mono text-xs font-medium text-gray-800">
          {display}
        </span>
      </div>
      {detail && <div className="mt-0.5 text-[10px] text-gray-400">{detail}</div>}
    </div>
  );
}

/** The opened row: trade-offs x shared weights = predicted probability, beside observed. */
function ExpandedPanel({
  p,
  focus,
  profile,
}: {
  p: TableProgress;
  focus: StudyCase;
  profile: Profile;
}) {
  const z = logit(profile.weights, deltaOf(focus));
  const predicted = sigmoid(z);
  const k = observedCount(focus, profile);
  return (
    <div
      className="overflow-hidden"
      style={{ height: PANEL_H * p.open, opacity: clamp01(p.open * 1.4) }}
    >
      <div
        className={`grid ${TABLE_GAP}`}
        style={{
          height: PANEL_H,
          gridTemplateColumns: TABLE_COLS,
          gridTemplateRows: "58px 1fr",
        }}
      >
        <div
          className="flex items-center pl-1 text-[11px] leading-tight text-gray-500"
          style={fade(p.weighted)}
        >
          <span>
            <span className="font-mono text-gray-700">{"\u00D7"}</span> shared value weights
          </span>
        </div>
        {VALUE_ORDER.map((v) => (
          <div key={v} className="flex items-center justify-center" style={fade(p.weighted)}>
            <span
              className="relative z-10 rounded-md border bg-white px-0.5 py-1 font-mono text-[10px] font-medium sm:px-1.5 sm:text-xs"
              style={{ borderColor: valueTint(v, 60), color: valueInk(v) }}
            >
              {signed(profile.weights[v])}
            </span>
          </div>
        ))}
        <div className="row-span-2 flex flex-col justify-center gap-3 border-l border-gray-100 pl-2 sm:pl-3">
          <ProbabilityBar
            label={
              <>
                = predicted<span className="hidden sm:inline"> choice probability</span>
              </>
            }
            value={predicted}
            display={pct(predicted)}
            progress={p.predicted}
            fill="#1B2433"
          />
          <ProbabilityBar
            label={
              <>
                observed<span className="hidden sm:inline"> frequency</span>
              </>
            }
            value={k === undefined ? undefined : k / MODEL_RUNS}
            display={k === undefined ? "n/a" : `${k}/${MODEL_RUNS}`}
            progress={p.observed}
            fill="#6B7A90"
            hatch
            detail={
              <>
                {profile.displayName}
                <span className="hidden sm:inline">, {MODEL_RUNS} runs</span>
              </>
            }
          />
        </div>
        <div
          className="-mt-1 self-start pl-1 pr-2 text-[11px] leading-snug text-gray-500 sm:pr-4"
          style={{ gridColumn: "1 / 6" }}
        >
          {/* Opaque, so the shared-weight rails break around the text instead of striking through it. */}
          <div className="relative z-10 w-fit bg-[#f4f5f7]" style={fade(p.weighted)}>
            The weights are shared. Only this case&rsquo;s trade-offs change the answer.
          </div>
          <div
            className="relative z-10 mt-1 w-fit bg-[#f4f5f7] font-mono text-gray-700"
            style={fade(p.predicted)}
          >
            {"\u03A3 w\u00B7\u0394 = "}
            {signedPlus(z)} {"\u2192 \u03C3("}
            {signed(z)}
            {") = "}
            {predicted.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Rows appear in sequence: the three cases, then the ellipsis row. */
const stagger = (rows: number, index: number, count: number) =>
  easeOut(clamp01(rows * (count + 1.2) - index));

function CaseRow({
  index,
  count,
  expandedIndex,
  row,
  profile,
  p,
}: {
  index: number;
  count: number;
  expandedIndex: number;
  row: StudyCase;
  profile: Profile;
  p: TableProgress;
}) {
  const delta = deltaOf(row);
  const isFocus = index === expandedIndex; // the row that opens
  const isFirst = index === 0; // always the highlighted opening row
  const appear = stagger(p.rows, index, count);
  // Once a row is open, the others recede; the highlighted first row recedes less.
  const recede = isFocus ? 0 : isFirst ? 0.2 : 0.55;
  const tint = isFocus ? p.open * 100 : isFirst ? 55 : 0;
  return (
    <div
      className="rounded-lg border-b border-gray-100"
      style={{
        opacity: appear * (1 - recede * p.open),
        transform: `translateY(${(1 - appear) * 10}px)`,
        backgroundColor: tint > 0 ? `color-mix(in srgb, #f4f5f7 ${tint}%, white)` : undefined,
        boxShadow: isFirst ? "inset 3px 0 0 #1B2433" : undefined,
      }}
    >
      <div
        className={`grid items-center ${TABLE_GAP}`}
        style={{ height: ROW_H, gridTemplateColumns: TABLE_COLS }}
      >
        <div className="truncate pl-1 font-mono text-[11px] text-gray-500">Case {index + 1}</div>
        {VALUE_ORDER.map((v) => (
          <div key={v} className="flex justify-center">
            <DeltaChip value={v} delta={delta[v]} emphasis={isFocus ? p.tradeoffs : 0} />
          </div>
        ))}
        <div className="pl-2 text-[11px] text-gray-500 sm:pl-3">
          {isFocus && (
            <span style={fade(p.tradeoffs, 0)}>
              <span aria-hidden>{"\u2190 "}</span>case trade-offs
            </span>
          )}
        </div>
      </div>
      {isFocus && <ExpandedPanel p={p} focus={row} profile={profile} />}
    </div>
  );
}

/** Stands for the rest of the study: the weights still run through it. */
function EllipsisRow({ index, count, p }: { index: number; count: number; p: TableProgress }) {
  const appear = stagger(p.rows, index, count);
  return (
    <div
      className={`grid items-center ${TABLE_GAP}`}
      style={{
        height: ELLIPSIS_H,
        gridTemplateColumns: TABLE_COLS,
        opacity: appear * (1 - 0.55 * p.open),
        transform: `translateY(${(1 - appear) * 10}px)`,
      }}
    >
      <div className="truncate pl-1 font-mono text-[11px] text-gray-500">{TOTAL_CASES} cases</div>
      {VALUE_ORDER.map((v) => (
        <div key={v} className="flex justify-center">
          <span
            className="relative z-10 bg-white px-1 text-base leading-none text-gray-400"
            aria-hidden
          >
            {"\u22EE"}
          </span>
        </div>
      ))}
      <div />
    </div>
  );
}

function Rails({ links, weighted }: { links: number; weighted: number }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 grid ${TABLE_GAP}`}
      style={{ gridTemplateColumns: TABLE_COLS }}
    >
      <div />
      {VALUE_ORDER.map((v) => (
        <div key={v} className="flex justify-center">
          <div
            className="w-0.5 origin-top rounded-full"
            style={{
              height: "100%",
              background: VALUE_COLORS[v],
              opacity: 0.3 + 0.35 * weighted,
              transform: `scaleY(${links})`,
            }}
          />
        </div>
      ))}
      <div />
    </div>
  );
}

function TableLayer({
  p,
  rows,
  expandedIndex,
  profile,
}: {
  p: TableProgress;
  rows: RegressionProps["rows"];
  expandedIndex: number;
  profile: Profile;
}) {
  const scale = barScale(profile.weights);
  const count = rows.length + 1; // three cases plus the ellipsis row
  return (
    <div className="relative flex h-full flex-col px-3 pt-4 sm:px-6">
      <div className={`grid items-end ${TABLE_GAP}`} style={{ gridTemplateColumns: TABLE_COLS }}>
        <div className={`${MONO} pb-10 pl-1 leading-snug`} style={fade(p.weights, 0)}>
          Shared
          <br />
          value weights
        </div>
        {VALUE_ORDER.map((v) => (
          <div key={v} className="flex flex-col items-center text-[11px] sm:text-xs">
            <WeightBar value={v} weight={profile.weights[v]} scale={scale} grow={p.weights} />
            <div className="mt-1" style={{ opacity: p.weights }}>
              <ValueLabel value={v} />
            </div>
            <div className="mb-1 font-mono text-[11px] text-gray-500" style={{ opacity: p.weights }}>
              <span className="hidden sm:inline">w </span>
              {signed(profile.weights[v])}
            </div>
          </div>
        ))}
        <div />
      </div>

      <div className="relative mt-0.5">
        <Rails links={p.links} weighted={p.weighted} />
        {rows.map((row, i) => (
          <CaseRow
            key={row.id}
            index={i}
            count={count}
            expandedIndex={expandedIndex}
            row={row}
            profile={profile}
            p={p}
          />
        ))}
        <EllipsisRow index={rows.length} count={count} p={p} />
      </div>

      <div
        className="absolute inset-x-6 bottom-4 text-center text-xs text-gray-400"
        style={{ opacity: p.rows * (1 - p.open) }}
      >
        Each chip is Option 1 minus Option 2 on one value: positive favors Option 1.
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Phase B: fitted weights, softmax, priorities                              */
/* -------------------------------------------------------------------------- */

const FIT_COLS = "minmax(4.25rem,0.8fr) repeat(3,minmax(0,1fr))";
const FIT_GAP = "gap-x-3 sm:gap-x-6";

function BarCell({
  children,
  trackChildren,
  sub,
}: {
  children: ReactNode;
  trackChildren: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-center">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
        <div className="relative h-3 w-full rounded-full bg-gray-100 sm:flex-1">{trackChildren}</div>
        <span className="font-mono text-xs font-medium text-gray-800 sm:w-12 sm:text-right">
          {children}
        </span>
      </div>
      {sub && (
        <div className="mt-0.5 hidden pr-14 text-right font-mono text-[10px] text-gray-400 sm:block">
          {sub}
        </div>
      )}
    </div>
  );
}

function ColumnTitle({ title, sub, progress }: { title: string; sub: string; progress: number }) {
  return (
    <div style={fade(progress, 6)}>
      <div className="text-xs font-semibold text-gray-800 sm:text-sm">{title}</div>
      <div className="mt-0.5 text-[10px] leading-snug text-gray-500 sm:text-[11px]">{sub}</div>
    </div>
  );
}

function FitLayer({
  profile,
  fit,
  expo,
  norm,
  final,
}: {
  profile: Profile;
  fit: number;
  expo: number;
  norm: number;
  final: number;
}) {
  const weights = profile.weights;
  const softmax = softmaxSteps(weights);
  const maxExp = Math.max(...VALUE_ORDER.map((v) => softmax.exps[v]));
  // Signed scale that always includes zero, so a negative weight has room.
  const lo = Math.min(0, ...VALUE_ORDER.map((v) => weights[v]));
  const hi = Math.max(0, ...VALUE_ORDER.map((v) => weights[v]));
  const span = hi - lo || 1;
  const axis = (-lo / span) * 100;
  const earlier = 1 - 0.6 * final; // earlier stages recede once priorities are the result
  const barGrow = easeOut(clamp01((fit - 0.3) / 0.7));
  return (
    <div className="flex h-full flex-col justify-center px-3 sm:px-8" style={{ opacity: fit }}>
      <div className={`grid ${FIT_GAP}`} style={{ gridTemplateColumns: FIT_COLS }}>
        <div />
        <div style={{ opacity: earlier }}>
          <ColumnTitle title="Fitted weights" sub="w, one per value. Can be negative." progress={1} />
        </div>
        <div style={{ opacity: earlier }}>
          <ColumnTitle
            title="Exponentiate"
            sub={`e^(w/\u03C4), \u03C4 = ${TEMPERATURE}. Always positive.`}
            progress={expo}
          />
        </div>
        <ColumnTitle
          title="Priorities"
          sub="Divide by the sum. Nonnegative, total 100%."
          progress={norm}
        />
      </div>

      <div className="mt-3 border-t border-gray-100" />

      {VALUE_ORDER.map((v) => {
        const color = VALUE_COLORS[v];
        const w = weights[v];
        const width = (Math.abs(w) / span) * 100 * barGrow;
        const left = w >= 0 ? axis : axis - width;
        return (
          <div
            key={v}
            className={`grid h-14 items-center border-b border-gray-100 ${FIT_GAP}`}
            style={{ gridTemplateColumns: FIT_COLS }}
          >
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
              <ValueLabel value={v} />
            </div>

            <div style={{ opacity: earlier }}>
              <BarCell
                trackChildren={
                  <>
                    <div
                      className="absolute inset-y-0 w-px bg-gray-400"
                      style={{ left: `${axis}%` }}
                    />
                    <div
                      className="absolute inset-y-0 rounded-full"
                      style={{ left: `${left}%`, width: `${width}%`, background: color }}
                    />
                  </>
                }
              >
                {signed(w)}
              </BarCell>
            </div>

            <div style={{ opacity: expo * earlier }}>
              <BarCell
                trackChildren={
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${(softmax.exps[v] / maxExp) * 100 * expo}%`,
                      background: color,
                    }}
                  />
                }
              >
                {softmax.exps[v].toFixed(2)}
              </BarCell>
            </div>

            <div style={{ opacity: norm }}>
              <BarCell
                trackChildren={
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${softmax.priorities[v] * 100 * norm}%`,
                      background: color,
                    }}
                  />
                }
                sub={`${softmax.exps[v].toFixed(2)} \u00F7 ${softmax.sum.toFixed(2)}`}
              >
                {pct(softmax.priorities[v])}
              </BarCell>
            </div>
          </div>
        );
      })}

      <div
        className={`mt-2 grid font-mono text-[11px] text-gray-500 ${FIT_GAP}`}
        style={{ gridTemplateColumns: FIT_COLS }}
      >
        <div />
        <div />
        <div
          className="whitespace-nowrap text-left sm:pr-14 sm:text-right"
          style={{ opacity: expo * earlier }}
        >
          {"\u03A3 = "}
          {softmax.sum.toFixed(2)}
        </div>
        <div
          className="whitespace-nowrap text-left sm:pr-14 sm:text-right"
          style={{ opacity: clamp01((norm - 0.7) / 0.3) }}
        >
          {"\u03A3 = 100%"}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Equations                                                                 */
/* -------------------------------------------------------------------------- */

function Term({ value }: { value: Value }) {
  return (
    <span style={{ color: valueInk(value) }}>
      <i>w</i>
      <sub>{value}</sub>
      {"\u00B7\u0394"}
      <sub>{value}</sub>
    </span>
  );
}

function EquationStrip({ model, softmax }: { model: number; softmax: number }) {
  return (
    <div className="relative mx-auto h-[4.5rem] w-full max-w-3xl shrink-0 text-left sm:text-center">
      <div
        className="absolute inset-0 flex flex-col items-start justify-center sm:items-center"
        style={{ opacity: model * (1 - softmax), transform: `translateY(${(1 - model) * 8}px)` }}
      >
        <div className="font-serif text-[14px] sm:text-2xl">
          <i>P</i>(Option 1) = {"\u03C3"}({" "}
          {VALUE_ORDER.map((v, i) => (
            <Fragment key={v}>
              {i > 0 && " + "}
              <Term value={v} />
            </Fragment>
          ))}{" "}
          )
        </div>
        <div className="mt-1 text-[11px] text-gray-500 sm:text-xs">
          {"\u0394 = Option 1 minus Option 2"}
          <span className="hidden sm:inline">{" on each value \u00B7 the same w for every case"}</span>
        </div>
      </div>
      <div
        className="absolute inset-0 flex flex-col items-start justify-center sm:items-center"
        style={{ opacity: softmax, transform: `translateY(${(1 - softmax) * 8}px)` }}
      >
        <div className="font-serif text-[14px] sm:text-2xl">
          <i>priority</i>
          <sub>v</sub> = <i>e</i>
          <sup>
            <i>w</i>
            <sub>v</sub>/{"\u03C4"}
          </sup>{" "}
          / {"\u03A3"}
          <sub>u</sub> <i>e</i>
          <sup>
            <i>w</i>
            <sub>u</sub>/{"\u03C4"}
          </sup>
        </div>
        <div className="mt-1 text-[11px] text-gray-500 sm:text-xs">
          softmax {"\u00B7"} {"\u03C4"} = {TEMPERATURE}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Scene                                                                     */
/* -------------------------------------------------------------------------- */

export function RegressionScene({
  elapsedMs,
  rows,
  profile = profileByKey(DEFAULT_PROFILE_KEY),
  expandedIndex = bestFitIndex(rows, profile),
  showHeadline = true,
}: RegressionProps & { elapsedMs: number }) {
  // The stage draws headlines itself and passes showHeadline={false}. That path is
  // the short autoplay bridge. The dev route keeps this detail sequence.
  if (!showHeadline) {
    return <CompressBridge elapsedMs={elapsedMs} profile={profile} />;
  }
  // The engine's first tick can land a few ms below zero; nothing here is defined before 0.
  const t = Math.max(0, elapsedMs);
  if (!Number.isInteger(expandedIndex) || expandedIndex < 0 || expandedIndex >= rows.length) {
    throw new Error(`expandedIndex ${expandedIndex} is not a row index (0..${rows.length - 1})`);
  }
  const table: TableProgress = {
    rows: segment(t, "rows", MOVE_MS),
    weights: motionAt(t, "weights", MOVE_MS),
    links: motionAt(t, "links", MOVE_MS),
    open: motionAt(t, "expand", MOVE_MS),
    tradeoffs: motionAt(t, "tradeoffs", FADE_MS),
    weighted: motionAt(t, "weighted", FADE_MS),
    predicted: motionAt(t, "predicted", FADE_MS),
    observed: motionAt(t, "observed", FADE_MS),
  };
  const equation = motionAt(t, "equation", FADE_MS);
  const fit = motionAt(t, "fit", MOVE_MS);
  const expo = motionAt(t, "exponentiate", MOVE_MS);
  const norm = motionAt(t, "normalize", MOVE_MS);
  const final = motionAt(t, "priorities", MOVE_MS);

  const tableOpacity = 1 - clamp01(fit * 1.8);

  return (
    <div className="flex h-full w-full flex-col">
      <header className="shrink-0">
        {showHeadline && (
          <>
            <div className="font-mono text-[10px] uppercase tracking-widest text-gray-400 sm:text-xs">
              Regression
            </div>
            <TextSwap
              state={textAt(headlines, t)}
              className="mt-1 min-h-[3.25rem] text-xl font-semibold leading-snug tracking-tight text-gray-900 sm:min-h-8 sm:text-2xl"
            />
          </>
        )}
        <TextSwap
          state={textAt(captions(profile.displayName), t)}
          className="mt-1 min-h-[2.5rem] text-sm leading-snug text-gray-600 sm:min-h-6 sm:text-base"
        />
      </header>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 py-3">
        <section
          className="relative mx-auto h-[28rem] max-h-full w-full max-w-4xl shrink overflow-y-auto overflow-x-hidden border border-line bg-white"
          style={{
            borderRadius: 20,
            boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 12px 32px -12px rgba(16,24,40,0.10)",
          }}
        >
          <div
            className="h-full"
            style={{ opacity: tableOpacity, visibility: tableOpacity <= 0 ? "hidden" : "visible" }}
          >
            <TableLayer p={table} rows={rows} expandedIndex={expandedIndex} profile={profile} />
          </div>
          {fit > 0 && (
            <div className="absolute inset-0">
              <FitLayer profile={profile} fit={fit} expo={expo} norm={norm} final={final} />
            </div>
          )}
        </section>

        <EquationStrip model={equation} softmax={expo} />
      </div>
    </div>
  );
}

/** The chapter for the player. `rows` is required; `profile` defaults to GPT; `expandedIndex` to the best-fit row. */
export function regressionChapter(props: RegressionProps): Chapter {
  return {
    id: "regression",
    beats: regressionBeats,
    render: (ctx) => <RegressionScene elapsedMs={ctx.elapsedMs} {...props} />,
  };
}
