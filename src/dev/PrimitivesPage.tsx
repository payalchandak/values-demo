import { useState } from "react";
import type { ReactNode } from "react";
import PrinciplistFramework from "../components/PrinciplistFramework";
import ValueBadge from "../components/ValueBadge";
import { NEUTRAL, RECOMMENDATION_COLORS, TAGS, TAG_ORDER, VALUES, VALUE_COLORS, VALUE_ORDER } from "../design";
import type { Tag } from "../study/types";

/** Dev page for the design primitives: #/dev/primitives */
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

export default function PrimitivesPage() {
  const [gray, setGray] = useState(false);

  return (
    <div className="h-full overflow-y-auto bg-canvas" style={{ color: NEUTRAL.ink }}>
      <main className="mx-auto max-w-5xl px-5 pb-16 pt-8">
        <h1 className="text-2xl font-semibold tracking-tight">Design primitives</h1>
        <p className="mt-1 text-sm text-slate-600">
          <code>src/design</code>, <code>ValueBadge</code>, <code>PrinciplistFramework</code>
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
      </main>
    </div>
  );
}
