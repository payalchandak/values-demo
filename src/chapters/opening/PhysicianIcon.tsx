import { CHARCOAL } from "./charcoal";

const FILL = "#F4F5F7";

/**
 * A person in a white coat: lapels, a stethoscope, charcoal outline, light fill.
 * Sized in em (1em wide) so it scales with the scene's font. No value colors.
 */
export default function PhysicianIcon({ style }: { style?: React.CSSProperties }) {
  const line = { stroke: CHARCOAL, strokeWidth: 1.4, strokeLinejoin: "round", strokeLinecap: "round" } as const;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 34"
      focusable="false"
      style={{ width: "1em", height: "1.4167em", display: "block", overflow: "visible", ...style }}
    >
      {/* coat */}
      <path d="M4 33 V20 C4 16.5 7 14.5 12 14.5 C17 14.5 20 16.5 20 20 V33 Z" fill={FILL} {...line} />
      {/* lapels and opening */}
      <path d="M12 14.5 L8.2 21 L12 25 L15.8 21 Z" fill="#FFFFFF" {...line} />
      <path d="M12 25 V33" fill="none" {...line} />
      {/* stethoscope */}
      <path d="M8.2 15.2 C7 20 8 23 10.3 23" fill="none" {...line} />
      <circle cx="10.9" cy="23" r="1.1" fill={FILL} {...line} />
      {/* head */}
      <circle cx="12" cy="7.5" r="5" fill={FILL} {...line} />
    </svg>
  );
}
