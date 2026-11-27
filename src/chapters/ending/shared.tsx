import { useLayoutEffect, useState, type RefObject } from "react";
import { motion } from "framer-motion";
import { openingFrame } from "../../data/demoData";
import ProviderIcon from "../../components/ProviderIcon";
import type { Profile } from "../../study/types";
import { modelLogo } from "./icons";

export const SPRING = { type: "spring", stiffness: 780, damping: 46, mass: 0.55 } as const;

export { clamp01, easeInOut } from "./beats";

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


/** The provider mark, or an invisible slot the stage's persistent icon lands on. */
export function ModelMark({
  profile,
  size,
  slot = false,
}: {
  profile: Profile;
  size: number;
  /** The stage draws this icon itself; leave an invisible slot for it to land on. */
  slot?: boolean;
}) {
  if (slot) {
    return (
      <span
        data-anchor="icon-label"
        className="block shrink-0"
        style={{ width: size, height: size, visibility: "hidden" }}
      />
    );
  }
  const logo = modelLogo(profile);
  return <ProviderIcon src={logo.src} alt={logo.alt} size={size} />;
}

/** Display name under a hero donut (never a version label). */
export function ModelName({ profile, large = false }: { profile: Profile; large?: boolean }) {
  return (
    <span className={large ? "text-xl font-semibold text-[#1B2433]" : "text-sm font-semibold text-[#1B2433]"}>
      {profile.displayName}
    </span>
  );
}
