import { useLayoutEffect, useState, type RefObject } from "react";
import { motion } from "framer-motion";
import { openingFrame } from "../../data/demoData";
import { VALUES, VALUE_ORDER, valueInk } from "../../design";
import ProviderIcon from "../../components/ProviderIcon";
import type { Profile } from "../../study/types";
import { modelLogo } from "./icons";

export const SPRING = { type: "spring", stiffness: 420, damping: 34, mass: 0.7 } as const;

export const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Live content-box size of an element. */
export function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** Docked project title (same `layoutId` as the rest of the demo, so it carries over) + chapter label. */
export function EndingHeader({ label }: { label: string }) {
  return (
    <header className="flex items-center justify-between">
      <motion.h1
        layoutId="project-title"
        transition={SPRING}
        className="text-xl font-semibold tracking-tight text-gray-900"
      >
        {openingFrame.projectName}
      </motion.h1>
      <span className="font-mono text-xs uppercase tracking-widest text-gray-400">{label}</span>
    </header>
  );
}


/** Axis key for the compact radars, whose labels are single letters. */
export function Legend() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-gray-500">
      {VALUE_ORDER.map((v) => (
        <li key={v} className="flex items-center gap-1.5">
          <span className="font-mono font-semibold" style={{ color: valueInk(v) }}>
            {v}
          </span>
          {VALUES[v].name}
        </li>
      ))}
    </ul>
  );
}

/** Round provider icon + display name (never a version label). */
export function ModelLabel({
  profile,
  iconSize = 32,
  large = false,
  stacked = false,
  iconSlot = false,
}: {
  profile: Profile;
  iconSize?: number;
  large?: boolean;
  /** Icon above the name, for narrow columns. */
  stacked?: boolean;
  /** The stage draws this icon itself; leave an invisible slot for it to land on. */
  iconSlot?: boolean;
}) {
  const logo = modelLogo(profile);
  return (
    <div className={`flex items-center ${stacked ? "flex-col gap-1.5" : "gap-2.5"}`}>
      {iconSlot ? (
        <span
          data-anchor="icon-label"
          className="inline-block shrink-0"
          style={{ width: iconSize, height: iconSize, visibility: "hidden" }}
        />
      ) : (
        <ProviderIcon src={logo.src} alt={logo.alt} size={iconSize} />
      )}
      <span className={large ? "text-xl font-semibold text-[#1B2433]" : "text-sm font-semibold text-[#1B2433]"}>
        {profile.displayName}
      </span>
    </div>
  );
}
