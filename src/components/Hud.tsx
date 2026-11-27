import type { ReactNode } from "react";

interface HudProps {
  count: number;
  currentStep: number;
  progress: number;
  isPaused: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggle: () => void;
  onRestart: () => void;
  onSeek: (index: number) => void;
}

const icon = "h-4 w-4";

function HudButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()} // keep focus off buttons so Space stays global
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-900/5 hover:text-gray-900 active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

export default function Hud({
  count,
  currentStep,
  progress,
  isPaused,
  onPrev,
  onNext,
  onToggle,
  onRestart,
  onSeek,
}: HudProps) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 rounded-2xl border border-line bg-white/70 p-2 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md">
      <div className="flex items-center gap-1">
        <HudButton label="Previous (←)" onClick={onPrev} disabled={currentStep === 0}>
          <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </HudButton>
        <HudButton label={isPaused ? "Play (Space)" : "Pause (Space)"} onClick={onToggle}>
          {isPaused ? (
            <svg className={icon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
            </svg>
          ) : (
            <svg className={icon} viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          )}
        </HudButton>
        <HudButton label="Next (→)" onClick={onNext} disabled={currentStep === count - 1}>
          <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </HudButton>
        <div className="mx-1 h-4 w-px bg-line" />
        <HudButton label="Restart" onClick={onRestart}>
          <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
        </HudButton>
        <span className="ml-1 mr-2 font-mono text-[11px] tabular-nums text-gray-500">
          {String(currentStep + 1).padStart(2, "0")}/{String(count).padStart(2, "0")}
        </span>
      </div>

      {/* Segmented step progress bar (click a segment to jump) */}
      <div className="flex gap-1 px-1 pb-0.5">
        {Array.from({ length: count }, (_, i) => {
          const fill = i < currentStep ? 1 : i === currentStep ? progress : 0;
          return (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              aria-label={`Go to step ${i + 1}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSeek(i)}
              className="group h-3 flex-1 cursor-pointer py-1"
            >
              <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200 transition-colors group-hover:bg-gray-300">
                <div
                  className="h-full rounded-full bg-gray-900"
                  style={{ width: `${fill * 100}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
