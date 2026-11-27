import type { CSSProperties } from "react";
import type { Tag, Value } from "../study/types";
import { NEUTRAL, TAGS, TagGlyph, VALUES, VALUE_COLORS, valueInk, valueTint } from "../design";

export interface ValueBadgeProps {
  value: Value;
  /**
   * How the thing being annotated relates to this value.
   * Omitted = identity only (no tag shown). It is NOT treated as neutral:
   * pass `0` explicitly for a neutral tag.
   */
  tag?: Tag;
  /** `name` shows "Autonomy"; `letter` shows "A". The tag cues are always shown. */
  display?: "name" | "letter";
  className?: string;
}

/**
 * Chip styling per state. Every state has the same 1.5px border and fixed
 * height, so switching tag never moves surrounding layout.
 *
 * - identity: white, light value border, value dot
 * - +1:       SOLID value fill, white text
 * - -1:       OUTLINED: white fill, value border, value-ink text
 * - 0:        faint gray chip, gray text
 */
function chipStyle(value: Value, tag: Tag | undefined): CSSProperties {
  const color = VALUE_COLORS[value];
  if (tag === undefined) {
    return { backgroundColor: NEUTRAL.surface, borderColor: valueTint(value, 45), color: valueInk(value) };
  }
  switch (TAGS[tag].chip) {
    case "solid":
      return { backgroundColor: color, borderColor: color, color: "#FFFFFF" };
    case "outlined":
      return { backgroundColor: NEUTRAL.surface, borderColor: color, color: valueInk(value) };
    case "faint":
      return { backgroundColor: "transparent", borderColor: NEUTRAL.line, color: NEUTRAL.inkMuted };
  }
}

/**
 * Noninteractive chip for one value, optionally carrying a tag.
 *
 * Tag encoding is redundant on purpose (fill, glyph, and text all say the same thing):
 *   promotes  solid chip    + up arrow   + "+1"
 *   violates  outlined chip + down arrow + "-1"
 *   neutral   faint chip    + dash       + "0"
 */
export default function ValueBadge({
  value,
  tag,
  display = "name",
  className = "",
}: ValueBadgeProps) {
  const meta = VALUES[value];
  const tagMeta = tag === undefined ? undefined : TAGS[tag];
  const text = display === "letter" ? meta.letter : meta.name;

  const ariaLabel =
    tagMeta === undefined ? meta.name : `${meta.name}: ${tagMeta.word} (${tagMeta.code})`;

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      data-value={value}
      data-tag={tag}
      style={chipStyle(value, tag)}
      className={`inline-flex h-7 w-fit shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-2.5 align-middle text-xs font-semibold leading-none ${className}`.trim()}
    >
      {tagMeta === undefined && (
        <span
          aria-hidden="true"
          className="inline-block size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: VALUE_COLORS[value] }}
        />
      )}
      <span aria-hidden="true">{text}</span>
      {tagMeta !== undefined && (
        <>
          <TagGlyph glyph={tagMeta.glyph} />
          <span aria-hidden="true" className="font-mono tabular-nums">
            {tagMeta.code}
          </span>
        </>
      )}
    </span>
  );
}
