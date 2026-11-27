import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface TypewriterTextProps {
  text: string;
  /** Milliseconds per character. */
  speed?: number;
  /** Milliseconds to wait before typing starts. */
  delayMs?: number;
  className?: string;
  showCursor?: boolean;
  onDone?: () => void;
}

export default function TypewriterText({
  text,
  speed = 28,
  delayMs = 0,
  className = "",
  showCursor = true,
  onDone,
}: TypewriterTextProps) {
  const [count, setCount] = useState(0);
  const done = count >= text.length;

  useEffect(() => {
    setCount(0);
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      let i = 0;
      interval = setInterval(() => {
        i += 1;
        setCount(i);
        if (i >= text.length) {
          clearInterval(interval);
          onDone?.();
        }
      }, speed);
    }, delayMs);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed, delayMs]);

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden>{text.slice(0, count)}</span>
      {showCursor && (
        <motion.span
          aria-hidden
          className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] bg-gray-900"
          animate={{ opacity: done ? [1, 0, 1] : 1 }}
          transition={done ? { duration: 1, repeat: Infinity } : { duration: 0 }}
        />
      )}
    </span>
  );
}
