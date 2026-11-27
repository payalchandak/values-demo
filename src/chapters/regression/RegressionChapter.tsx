import { Fragment, type CSSProperties, type ReactNode } from "react";
import type { Chapter } from "../../types";
import type { Delta, Value } from "../../study/types";
import { captionAt, easeOut, motionAt, regressionBeats, segment } from "./beats";
import {
  FOCUS_ROW,
  PHYSICIANS_PER_CASE,
  TEMPERATURE,
  VALUE_ORDER,
  deltaOf,
  logit,
  placeholderCases,
  placeholderProfile,
  sigmoid,
  softmaxSteps,
  valueMeta,
} from "./data";

/* -------------------------------------------------------------------------- */
/*  Shared bits                                                               */
/* -------------------------------------------------------------------------- */

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

/** Signed number with a real minus sign. */
const signed = (x: number, digits = 2) =>
  `${x < 0 ? "\u2212" : ""}${Math.abs(x).toFixed(digits)}`;
const signedPlus = (x: number, digits = 2) => (x > 0 ? `+${signed(x, digits)}` : signed(x, digits));
const pct = (p: number) => `${Math.round(p * 100)}%`;

const tint = (color: string, percent: number) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;
/** Darkened value color so text stays readable on white. */
const ink = (color: string) => `color-mix(in srgb, ${color} 72%, #000)`;

const fade = (p: number, rise = 8): CSSProperties => ({
  opacity: p,
  transform: `translateY(${(1 - p) * rise}px)`,
});

const WEIGHTS = placeholderProfile.weights;
const SOFTMAX = softmaxSteps(WEIGHTS);
const FOCUS = placeholderCases[FOCUS_ROW];

const MONO = "font-mono text-[10px] uppercase tracking-widest text-gray-400";

/* -------------------------------------------------------------------------- */
/*  Phase A: shared weights, case rows, one expanded row                       */
/* -------------------------------------------------------------------------- */

/** Case label | four value columns | result. Shared by head, rows, and rails. */
const TABLE_COLS = "minmax(3.5rem,1.3fr) repeat(4,minmax(0,1fr)) minmax(5.5rem,2.4fr)";
const TABLE_GAP = "gap-x-1 sm:gap-x-2";

const ROW_H = 40;
const PANEL_H = 116;
const BAR_REGION = 92;
const BAR_BASELINE = 66;
const BAR_PX_PER_UNIT = 120;

function WeightBar({ value, grow }: { value: Value; grow: number }) {
  const { color } = valueMeta(value);
  const h = Math.abs(WEIGHTS[value]) * BAR_PX_PER_UNIT * grow;
  const up = WEIGHTS[value] >= 0;
  return (
    <div className="relative w-full" style={{ height: BAR_REGION }}>
      <div
        className="absolute left-[15%] right-[15%] h-px bg-gray-300"
        style={{ top: BAR_BASELINE }}
      />
      <div
        className="absolute left-1/2 w-5 -translate-x-1/2 rounded-sm"
        style={{ top: up ? BAR_BASELINE - h : BAR_BASELINE, height: h, background: color }}
      />
    </div>
  );
}

function ValueLabel({ value }: { value: Value }) {
  const { label, color, code } = valueMeta(value);
  return (
    <span className="font-medium" style={{ color: ink(color) }}>
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{code}</span>
    </span>
  );
}

/** One value's trade-off in a case: Option 1 minus Option 2. */
function DeltaChip({ value, delta, emphasis }: { value: Value; delta: number; emphasis: number }) {
  const { color } = valueMeta(value);
  const mag = Math.abs(delta);
  return (
    <span
      className="relative z-10 flex h-7 w-full max-w-9 items-center justify-center rounded-md border bg-white font-mono text-[11px] font-medium sm:text-xs"
      style={{
        borderColor: mag === 0 ? "#e5e7eb" : tint(color, 60),
        backgroundColor: mag === 0 ? "#fff" : `color-mix(in srgb, ${color} ${mag * 12}%, white)`,
        color: mag === 0 ? "#9ca3af" : ink(color),
        boxShadow: emphasis > 0 ? `0 0 0 ${2 * emphasis}px ${tint(color, 35)}` : undefined,
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
  progress,
  fill,
  hatch,
  detail,
}: {
  label: ReactNode;
  value: number;
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
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${value * progress * 100}%`,
              background: hatch
                ? `repeating-linear-gradient(135deg, ${fill} 0 3px, color-mix(in srgb, ${fill} 45%, white) 3px 6px)`
                : fill,
            }}
          />
        </div>
        <span className="w-9 text-right font-mono text-xs font-medium text-gray-800">
          {pct(value)}
        </span>
      </div>
      {detail && <div className="mt-0.5 text-[10px] text-gray-400">{detail}</div>}
    </div>
  );
}

/** The opened row: trade-offs × shared weights = predicted probability, beside observed. */
function ExpandedPanel({ p, delta }: { p: TableProgress; delta: Delta }) {
  const z = logit(WEIGHTS, delta);
  const predicted = sigmoid(z);
  const observed = FOCUS.physicianVotesChoice1 / PHYSICIANS_PER_CASE;
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
          gridTemplateRows: "52px 1fr",
        }}
      >
        <div
          className="flex items-center text-[11px] leading-tight text-gray-500"
          style={fade(p.weighted)}
        >
          <span>
            <span className="font-mono text-gray-700">×</span> shared value weights
          </span>
        </div>
        {VALUE_ORDER.map((v) => {
          const { color } = valueMeta(v);
          return (
            <div key={v} className="flex items-center justify-center" style={fade(p.weighted)}>
              <span
                className="relative z-10 rounded-md border bg-white px-0.5 py-1 font-mono text-[10px] font-medium sm:px-1.5 sm:text-xs"
                style={{ borderColor: tint(color, 60), color: ink(color) }}
              >
                {signed(WEIGHTS[v])}
              </span>
            </div>
          );
        })}
        <div className="row-span-2 flex flex-col justify-center gap-3 border-l border-gray-100 pl-2 sm:pl-3">
          <ProbabilityBar
            label={<>= predicted<span className="hidden sm:inline"> choice probability</span></>}
            value={predicted}
            progress={p.predicted}
            fill="#1B2433"
          />
          <ProbabilityBar
            label={<>observed<span className="hidden sm:inline"> frequency</span></>}
            value={observed}
            progress={p.observed}
            fill="#6B7A90"
            hatch
            detail={<>{FOCUS.physicianVotesChoice1} of {PHYSICIANS_PER_CASE}<span className="hidden sm:inline"> chose Option 1</span></>}
          />
        </div>
        <div
          className="-mt-1 self-start pr-2 text-[11px] leading-snug text-gray-500 sm:pr-4"
          style={{ gridColumn: "1 / 6" }}
        >
          {/* Opaque, so the shared-weight rails break around the text instead of striking through it. */}
          <div className="relative z-10 w-fit bg-[#f4f5f7]" style={fade(p.weighted)}>
            The weights are shared. Only this case&rsquo;s trade-offs change the answer.
          </div>
          <div className="relative z-10 mt-1 w-fit bg-[#f4f5f7] font-mono text-gray-700" style={fade(p.predicted)}>
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

function CaseRow({ index, p }: { index: number; p: TableProgress }) {
  const c = placeholderCases[index];
  const delta = deltaOf(c);
  const isFocus = index === FOCUS_ROW;
  const appear = easeOut(clamp01(p.rows * (placeholderCases.length + 1.2) - index));
  const open = isFocus ? p.open : 0;
  return (
    <div
      className="rounded-lg border-b border-gray-100 last:border-b-0"
      style={{
        // Once one case is open, the others recede.
        opacity: isFocus ? appear : appear * (1 - 0.55 * p.open),
        transform: `translateY(${(1 - appear) * 10}px)`,
        backgroundColor: isFocus ? `color-mix(in srgb, #f4f5f7 ${open * 100}%, white)` : undefined,
      }}
    >
      <div
        className={`grid items-center ${TABLE_GAP}`}
        style={{ height: ROW_H, gridTemplateColumns: TABLE_COLS }}
      >
        <div className="truncate pl-1 font-mono text-[11px] text-gray-500">Case {index + 1}</div>
        {VALUE_ORDER.map((v) => (
          <div key={v} className="flex justify-center">
            <DeltaChip
              value={v}
              delta={delta[v]}
              emphasis={isFocus ? p.tradeoffs : 0}
            />
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
      {isFocus && <ExpandedPanel p={p} delta={delta} />}
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
              background: valueMeta(v).color,
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

function TableLayer({ p }: { p: TableProgress }) {
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
            <WeightBar value={v} grow={p.weights} />
            <div className="mt-1" style={{ opacity: p.weights }}>
              <ValueLabel value={v} />
            </div>
            <div className="mb-1 font-mono text-[11px] text-gray-500" style={{ opacity: p.weights }}>
              <span className="hidden sm:inline">w </span>
              {signed(WEIGHTS[v])}
            </div>
          </div>
        ))}
        <div />
      </div>

      <div className="relative mt-0.5">
        <Rails links={p.links} weighted={p.weighted} />
        {placeholderCases.map((c, i) => (
          <CaseRow key={c.id} index={i} p={p} />
        ))}
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
/*  Phase B: fitted weights → softmax → priorities                            */
/* -------------------------------------------------------------------------- */

const FIT_COLS = "minmax(4.25rem,0.8fr) repeat(3,minmax(0,1fr))";
const FIT_GAP = "gap-x-3 sm:gap-x-6";
/** Fitted-weight bars share one signed scale so negative weights have room. */
const W_MIN = -0.2;
const W_MAX = 0.6;

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
        <span className="font-mono text-xs font-medium text-gray-800 sm:w-11 sm:text-right">
          {children}
        </span>
      </div>
      {sub && (
        <div className="mt-0.5 hidden pr-[3.25rem] text-right font-mono text-[10px] text-gray-400 sm:block">
          {sub}
        </div>
      )}
    </div>
  );
}

function ColumnTitle({
  title,
  sub,
  progress,
  strong,
}: {
  title: string;
  sub: string;
  progress: number;
  strong?: number;
}) {
  return (
    <div style={fade(progress, 6)}>
      <div
        className="text-xs font-semibold text-gray-800 sm:text-sm"
        style={{ opacity: 0.55 + 0.45 * (strong ?? 1) }}
      >
        {title}
      </div>
      <div className="mt-0.5 text-[10px] leading-snug text-gray-500 sm:text-[11px]">{sub}</div>
    </div>
  );
}

function FitLayer({
  fit,
  expo,
  norm,
  final,
}: {
  fit: number;
  expo: number;
  norm: number;
  final: number;
}) {
  const maxExp = Math.max(...VALUE_ORDER.map((v) => SOFTMAX.exps[v]));
  const axis = (-W_MIN / (W_MAX - W_MIN)) * 100;
  const earlier = 1 - 0.6 * final; // earlier stages recede once priorities are the result
  const barGrow = easeOut(clamp01((fit - 0.3) / 0.7));
  return (
    <div className="flex h-full flex-col justify-center px-3 sm:px-8" style={{ opacity: fit }}>
      <div className={`grid ${FIT_GAP}`} style={{ gridTemplateColumns: FIT_COLS }}>
        <div />
        <div style={{ opacity: earlier }}>
          <ColumnTitle
            title="Fitted weights"
            sub={"w, one per value. Can be negative."}
            progress={1}
          />
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
          sub={"Divide by the sum. Nonnegative, total 100%."}
          progress={norm}
          strong={1}
        />
      </div>

      <div className="mt-3 border-t border-gray-100" />

      {VALUE_ORDER.map((v) => {
        const { color } = valueMeta(v);
        const w = WEIGHTS[v];
        const wWidth = (Math.abs(w) / (W_MAX - W_MIN)) * 100 * barGrow;
        const wLeft = w >= 0 ? axis : axis - (Math.abs(w) / (W_MAX - W_MIN)) * 100 * barGrow;
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
                      style={{ left: `${wLeft}%`, width: `${wWidth}%`, background: color }}
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
                      width: `${(SOFTMAX.exps[v] / maxExp) * 100 * expo}%`,
                      background: color,
                    }}
                  />
                }
              >
                {SOFTMAX.exps[v].toFixed(2)}
              </BarCell>
            </div>

            <div style={{ opacity: norm }}>
              <BarCell
                trackChildren={
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${SOFTMAX.priorities[v] * 100 * norm}%`,
                      background: color,
                    }}
                  />
                }
                sub={`${SOFTMAX.exps[v].toFixed(2)} \u00F7 ${SOFTMAX.sum.toFixed(2)}`}
              >
                {pct(SOFTMAX.priorities[v])}
              </BarCell>
            </div>
          </div>
        );
      })}

      <div className={`mt-2 grid font-mono text-[11px] text-gray-500 ${FIT_GAP}`} style={{ gridTemplateColumns: FIT_COLS }}>
        <div />
        <div />
        <div className="whitespace-nowrap text-left sm:pr-[3.25rem] sm:text-right" style={{ opacity: expo * earlier }}>
          {"\u03A3 = "}
          {SOFTMAX.sum.toFixed(2)}
        </div>
        <div className="whitespace-nowrap text-left sm:pr-[3.25rem] sm:text-right" style={{ opacity: clamp01((norm - 0.7) / 0.3) }}>
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
    <span style={{ color: ink(valueMeta(value).color) }}>
      <i>w</i>
      <sub>{value}</sub>
      {"\u00B7\u0394"}
      <sub>{value}</sub>
    </span>
  );
}

function EquationStrip({ model, softmax }: { model: number; softmax: number }) {
  return (
    <div className="relative mx-auto h-[4.5rem] w-full max-w-3xl shrink-0 text-center">
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ opacity: model * (1 - softmax), transform: `translateY(${(1 - model) * 8}px)` }}
      >
        <div className="font-serif text-base sm:text-2xl">
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
          {"\u0394 = Option 1 minus Option 2 on each value \u00B7 the same w for every case"}
        </div>
      </div>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ opacity: softmax, transform: `translateY(${(1 - softmax) * 8}px)` }}
      >
        <div className="font-serif text-base sm:text-2xl">
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

export function RegressionScene({ elapsedMs: t }: { elapsedMs: number }) {
  const table: TableProgress = {
    rows: segment(t, "rows", 1800),
    weights: motionAt(t, "weights", 1400),
    links: motionAt(t, "links", 1600),
    open: motionAt(t, "expand", 900),
    tradeoffs: motionAt(t, "tradeoffs", 600),
    weighted: motionAt(t, "weighted", 700),
    predicted: motionAt(t, "predicted", 900),
    observed: motionAt(t, "observed", 900),
  };
  const equation = motionAt(t, "equation", 800);
  const fit = motionAt(t, "fit", 1200);
  const expo = motionAt(t, "exponentiate", 1600);
  const norm = motionAt(t, "normalize", 1600);
  const final = motionAt(t, "priorities", 900);

  const tableOpacity = 1 - clamp01(fit * 1.8);

  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex shrink-0 items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight text-gray-900">Estimating value weights</h2>
        <span className="font-mono text-[10px] uppercase tracking-widest text-gray-400 sm:text-xs">
          Regression {"\u00B7"} placeholder data
        </span>
      </header>
      <p className="mt-2 h-10 shrink-0 text-sm leading-snug text-gray-600 sm:h-7 sm:text-base">
        {captionAt(t)}
      </p>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 py-3">
        <section
          className="relative mx-auto h-[31rem] max-h-full w-full max-w-4xl shrink overflow-y-auto overflow-x-hidden border border-line bg-white"
          style={{
            borderRadius: 20,
            boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 12px 32px -12px rgba(16,24,40,0.10)",
          }}
        >
          <div
            className="h-full"
            style={{ opacity: tableOpacity, visibility: tableOpacity <= 0 ? "hidden" : "visible" }}
          >
            <TableLayer p={table} />
          </div>
          {fit > 0 && (
            <div className="absolute inset-0">
              <FitLayer fit={fit} expo={expo} norm={norm} final={final} />
            </div>
          )}
        </section>

        <EquationStrip model={equation} softmax={expo} />
      </div>
    </div>
  );
}

export const regressionChapter: Chapter = {
  id: "regression",
  beats: regressionBeats,
  render: (ctx) => <RegressionScene elapsedMs={ctx.elapsedMs} />,
};
