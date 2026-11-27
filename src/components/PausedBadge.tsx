import { AnimatePresence, motion } from "framer-motion";

/**
 * Positioning
 * - md+ : centered at the top of the viewport, with the keyboard hint.
 * - <md : compact "PAUSED" pill, right-aligned and sitting just above the
 *   bottom-right HUD (fixed, bottom-5 right-5, ~4.5rem tall). Top-of-screen is
 *   reserved for the title/header on narrow screens, so the badge lives here.
 *   bottom = HUD offset (1.25rem) + HUD height (4.5rem) + gap (0.5rem).
 * The badge is `fixed`, so showing/hiding it never affects document flow.
 */
export default function PausedBadge({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.07 }}
          className="pointer-events-none fixed bottom-[6.25rem] right-5 z-50 md:bottom-auto md:left-1/2 md:right-auto md:top-4 md:-translate-x-1/2"
        >
          <div className="rounded-full border border-line bg-white/80 px-3 py-1 font-mono text-[11px] font-medium tracking-wide text-gray-600 shadow-sm backdrop-blur md:px-4 md:py-1.5">
            PAUSED
            <span className="hidden md:inline"> — press Space to continue</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
