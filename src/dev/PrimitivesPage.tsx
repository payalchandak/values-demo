import { useState } from "react";
import type { ReactNode } from "react";
import { animate, useMotionValue } from "framer-motion";
import PrinciplistFramework from "../components/PrinciplistFramework";
import RadarChart from "../components/RadarChart";
import ValueBadge from "../components/ValueBadge";
import { NEUTRAL, RECOMMENDATION_COLORS, TAGS, TAG_ORDER, VALUES, VALUE_COLORS, VALUE_ORDER } from "../design";
import type { Tag, Value } from "../study/types";

/**
 * Dev page for the design primitives: #/dev/primitives
 *
 * Profile numbers are the published normalized priorities, softmax(weights / 0.262),
 * copied from `PAPER_LLMS` in value-prism/scripts/check_attribution.py (the paper table).
 * Order is A, B, N, J; each row sums to 1.
 */
const PROFILES: readonly { key: string; name: string; priorities: Record<Value, number> }[] = [
  { key: "openai/gpt-5.2", name: "GPT 5.2", priorities: { A: 0.061, B: 0.676, N: 0.121, J: 0.142 } },
  { key: "anthropic/claude-opus-4.5", name: "Claude Opus 4.5", priorities: { A: 0.205, B: 0.218, N: 0.526, J: 0.051 } },
  { key: "google/gemini-3-pro-preview", name: "Gemini 3 Pro", priorities: { A: 0.312, B: 0.355, N: 0.222, J: 0.111 } },
];

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-8">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {note !== undefined && <p className="mt-1 max-w-2xl text-sm text-slate-600">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Swatch({ label, sub, color }: { label: string; sub: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="size-10 rounded-lg" style={{ backgroundColor: color }} aria-hidden="true" />
      <div className="text-sm leading-tight">
        <div className="font-semibold">{label}</div>
        <div className="font-mono text-xs text-slate-500">
          {sub} {color}
        </div>
      </div>
    </div>
  );
}

function ProfileLegend({ priorities }: { priorities: Record<Value, number> }) {
  return (
    <dl className="mt-2 grid grid-cols-4 gap-1 text-center text-xs">
      {VALUE_ORDER.map((v) => (
        <div key={v}>
          <dt className="font-semibold" style={{ color: VALUE_COLORS[v] }}>
            {v}
          </dt>
          <dd className="font-mono tabular-nums text-slate-700">{pct(priorities[v])}</dd>
        </div>
      ))}
    </dl>
  );
}

function AnimatedRadar() {
  const a = useMotionValue(0);
  const b = useMotionValue(0);
  const n = useMotionValue(0);
  const j = useMotionValue(0);
  const [active, setActive] = useState<string | null>(null);

  const go = (key: string | null, target: Record<Value, number>) => {
    setActive(key);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const options = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 90, damping: 11 };
    animate(a, target.A, options);
    animate(b, target.B, options);
    animate(n, target.N, options);
    animate(j, target.J, options);
  };

  const buttonClass = (on: boolean) =>
    `rounded-md border px-3 py-1.5 text-sm font-medium ${
      on ? "border-slate-700 bg-slate-700 text-white" : "border-line bg-white text-slate-700 hover:bg-slate-50"
    }`;

  return (
    <div className="flex flex-col items-start gap-4 md:flex-row md:items-center">
      <div className="w-full max-w-md">
        <RadarChart
          priorities={{ A: a, B: b, N: n, J: j }}
          title="Animated priorities"
          description="Each axis length is driven by its own MotionValue."
        />
      </div>
      <div className="flex flex-wrap gap-2 md:flex-col">
        {PROFILES.map((p) => (
          <button key={p.key} type="button" className={buttonClass(active === p.key)} onClick={() => go(p.key, p.priorities)}>
            {p.name}
          </button>
        ))}
        <button type="button" className={buttonClass(active === "zero")} onClick={() => go("zero", { A: 0, B: 0, N: 0, J: 0 })}>
          Zero
        </button>
        <button
          type="button"
          className={buttonClass(active === "over")}
          onClick={() => go("over", { A: 1, B: 1, N: 1, J: 1 })}
        >
          All at 1 (outer ring)
        </button>
      </div>
    </div>
  );
}

export default function PrimitivesPage() {
  const [gray, setGray] = useState(false);

  return (
    <div className="h-full overflow-y-auto bg-canvas" style={{ color: NEUTRAL.ink }}>
      <main className="mx-auto max-w-5xl px-5 pb-16 pt-8">
        <h1 className="text-2xl font-semibold tracking-tight">Design primitives</h1>
        <p className="mt-1 text-sm text-slate-600">
          <code>src/design</code>, <code>ValueBadge</code>, <code>PrinciplistFramework</code>, <code>RadarChart</code>
        </p>

        <Section
          title="Colors"
          note="Value colors identify a value and nothing else. The two recommendations use separate hues that never overlap them."
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-3">
            {VALUE_ORDER.map((v) => (
              <Swatch key={v} label={`${v} ${VALUES[v].name}`} sub="value" color={VALUE_COLORS[v]} />
            ))}
            <Swatch label="Option 1" sub="recommendation" color={RECOMMENDATION_COLORS.option1} />
            <Swatch label="Option 2" sub="recommendation" color={RECOMMENDATION_COLORS.option2} />
          </div>
        </Section>

        <Section
          title="ValueBadge tag encoding"
          note="promotes = solid chip + up arrow + +1. violates = outlined chip + down arrow + -1. neutral = dash + 0. Turn on grayscale to confirm no tag depends on color."
        >
          <label className="mb-4 flex w-fit items-center gap-2 text-sm">
            <input type="checkbox" checked={gray} onChange={(e) => setGray(e.target.checked)} />
            Grayscale
          </label>
          <div style={{ filter: gray ? "grayscale(1)" : undefined }} className="overflow-x-auto">
            <table className="border-separate border-spacing-x-4 border-spacing-y-2 text-left text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="font-semibold">Value</th>
                  <th className="font-semibold">Identity</th>
                  {TAG_ORDER.map((t) => (
                    <th key={t} className="font-semibold">
                      {TAGS[t].word}
                    </th>
                  ))}
                  <th className="font-semibold">Letter form</th>
                </tr>
              </thead>
              <tbody>
                {VALUE_ORDER.map((v) => (
                  <tr key={v}>
                    <td className="font-mono text-slate-600">{v}</td>
                    <td>
                      <ValueBadge value={v} />
                    </td>
                    {TAG_ORDER.map((t) => (
                      <td key={t}>
                        <ValueBadge value={v} tag={t} />
                      </td>
                    ))}
                    <td>
                      <span className="flex gap-1.5">
                        {TAG_ORDER.map((t: Tag) => (
                          <ValueBadge key={t} value={v} tag={t} display="letter" />
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="PrinciplistFramework">
          <PrinciplistFramework description="Each principle asks a different question of a clinical decision." />
        </Section>

        <Section
          title="RadarChart: three models"
          note="Fixed axes A, B, N, J. Same 0 to 1 scale and plot position every time, so shapes compare directly. Priorities are the published paper profiles."
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {PROFILES.map((p) => (
              <figure key={p.key} className="rounded-xl border border-line bg-white p-3">
                <figcaption className="mb-1 text-sm font-semibold">{p.name}</figcaption>
                <RadarChart
                  priorities={p.priorities}
                  title={`${p.name} priorities`}
                  description={`Normalized value priorities for ${p.name}.`}
                />
                <ProfileLegend priorities={p.priorities} />
              </figure>
            ))}
          </div>
          <h3 className="mb-3 mt-8 text-sm font-semibold">Compact mode</h3>
          <div className="flex flex-wrap gap-6">
            {PROFILES.map((p) => (
              <figure key={p.key} className="w-40">
                <RadarChart
                  mode="compact"
                  priorities={p.priorities}
                  title={`${p.name} priorities`}
                  description={`Normalized value priorities for ${p.name}.`}
                />
                <figcaption className="text-center text-xs text-slate-600">{p.name}</figcaption>
              </figure>
            ))}
          </div>
          <h3 className="mb-3 mt-8 text-sm font-semibold">Invalid data (not drawn, not clamped)</h3>
          <div className="w-40">
            <RadarChart
              mode="compact"
              priorities={{ A: 1.4, B: 0.2, N: 0.2, J: 0.2 }}
              title="Invalid example"
              description="Autonomy is outside the 0 to 1 scale."
            />
          </div>
        </Section>

        <Section
          title="RadarChart: animatable"
          note="Each radial length is a MotionValue. The polygon and dots update per frame without React re-renders. The spring overshoots on purpose; drawing stops at the outer ring."
        >
          <AnimatedRadar />
        </Section>
      </main>
    </div>
  );
}
