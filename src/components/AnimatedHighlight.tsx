import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface AnimatedHighlightProps {
  children: ReactNode;
  /** Seconds before the sweep begins. */
  delay?: number;
  /** Sweep duration in seconds. */
  duration?: number;
  /** Highlight color (any CSS color). */
  color?: string;
  className?: string;
}

/** Sweeps a color behind inline text, left to right (works across line wraps). */
export default function AnimatedHighlight({
  children,
  delay = 0,
  duration = 0.7,
  color = "#FDE68A",
  className = "",
}: AnimatedHighlightProps) {
  return (
    <motion.span
      className={`rounded-sm px-1 [box-decoration-break:clone] [-webkit-box-decoration-break:clone] ${className}`}
      style={{
        backgroundImage: `linear-gradient(${color}, ${color})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "0 90%",
      }}
      initial={{ backgroundSize: "0% 85%" }}
      animate={{ backgroundSize: "100% 85%" }}
      exit={{ backgroundSize: "0% 85%", transition: { duration: 0.07 } }}
      transition={{ delay, duration, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.span>
  );
}
