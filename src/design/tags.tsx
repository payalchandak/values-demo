import type { Tag } from "../study/types";

/**
 * Tag encoding. Every tag is carried by THREE redundant cues, so no single
 * cue (color, fill, shape) is ever required to read it:
 *
 *   promotes (+1)  solid chip     + up arrow   + "+1"
 *   violates (-1)  outlined chip  + down arrow + "-1"
 *   neutral  ( 0)  faint chip     + dash       + "0"
 */
export interface TagMeta {
  tag: Tag;
  /** Text shown next to the glyph. */
  code: "+1" | "-1" | "0";
  /** Word used in accessible names, e.g. "Autonomy: promotes (+1)". */
  word: "promotes" | "violates" | "neutral";
  /** Chip treatment. */
  chip: "solid" | "outlined" | "faint";
  glyph: "up" | "down" | "dash";
}

export const TAGS: Readonly<Record<Tag, TagMeta>> = {
  1: { tag: 1, code: "+1", word: "promotes", chip: "solid", glyph: "up" },
  [-1]: { tag: -1, code: "-1", word: "violates", chip: "outlined", glyph: "down" },
  0: { tag: 0, code: "0", word: "neutral", chip: "faint", glyph: "dash" },
};

/** Tags in display order: promotes, neutral, violates. */
export const TAG_ORDER: readonly Tag[] = [1, 0, -1];

/**
 * Arrow / dash glyph drawn as SVG so it renders identically in every font and
 * inherits the chip's text color. Decorative: the chip carries the label.
 */
export function TagGlyph({ glyph, size = 12 }: { glyph: TagMeta["glyph"]; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {glyph === "up" && <path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" />}
      {glyph === "down" && <path d="M6 2v8M2.5 6.5 6 10l3.5-3.5" />}
      {glyph === "dash" && <path d="M2.5 6h7" />}
    </svg>
  );
}
