import { motion } from "framer-motion";

interface TypewriterTextProps {
  text: string;
  /** Playback time in ms (e.g. `ctx.elapsedMs`). Typing is a pure function of it. */
  elapsedMs: number;
  /** Milliseconds per character. */
  speed?: number;
  /** Playback time at which typing starts. */
  delayMs?: number;
  className?: string;
  showCursor?: boolean;
}

/** Cursor blink period once typing is done, in ms. */
const BLINK_MS = 1000;

/**
 * Typewriter effect driven entirely by `elapsedMs`, so it pauses, seeks, and
 * restarts with the playback clock. No timers live here.
 */
export default function TypewriterText({
  text,
  elapsedMs,
  speed = 28,
  delayMs = 0,
  className = "",
  showCursor = true,
}: TypewriterTextProps) {
  const typed = speed > 0 ? Math.floor((elapsedMs - delayMs) / speed) : text.length;
  const count = Math.min(Math.max(typed, 0), text.length);
  const done = count >= text.length;
  const cursorOpacity = done && (elapsedMs % BLINK_MS) / BLINK_MS >= 0.5 ? 0 : 1;

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden>{text.slice(0, count)}</span>
      {showCursor && (
        <motion.span
          aria-hidden
          className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] bg-gray-900"
          style={{ opacity: cursorOpacity }}
        />
      )}
    </span>
  );
}
