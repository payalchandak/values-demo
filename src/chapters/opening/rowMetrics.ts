import type { CSSProperties } from "react";
import { openingRows } from "./openingRows";

/**
 * Geometry shared by GPT's row (OpeningResponse) and the rows under it, so
 * every row lines up: same height, same columns as the option buttons, the same
 * icon slot, and one dot pitch for the model dots and the physician squares.
 * All in em, so it scales with the scene's font size.
 */

/** Height of one row. The icon is 36px at the base size, which is 2.25em. */
export const ROW_HEIGHT = "2.25em";
/** Space between the columns. Matches the option buttons' grid. */
export const COLUMN_GAP = "0.6em";
/** From a column's outer edge to its first dot. */
export const EDGE_PAD = "0.9em";
/** Icon slot to first dot. */
export const ICON_GAP = "0.7em";
/** The icon slot's width, in em. */
const ICON_EM = 2.25;
/** Edge, icon, and the gap before the first dot. Both gutters use this width, so a full row is centered on the choice. */
const ICON_BLOCK_EM = 0.9 + ICON_EM + 0.7;
export const ICON_BLOCK = `${ICON_BLOCK_EM}em`;
/** The widest the packed pitch (one dot's width plus the gap after it) gets before a row starts to spread, in em. */
const PITCH_MAX_EM = 1.15;
/** Share of that packed pitch the dot itself takes. The dot stays this size when the row spreads. */
const DOT_SHARE = 0.61;

const DOTS = openingRows.maxDotsPerSide;
const DOT_EM = PITCH_MAX_EM * DOT_SHARE;

/**
 * Dot size and gap for a row whose two columns sit in `outer` (the scene, or a
 * card). A full row of dots is centered on the choice: equal gutters, the left
 * one the icon block. The gap opens so those dots fill the middle. On a narrow
 * column the gap tightens, and the dot shrinks, so the row still fits after the icon.
 */
export function dotRowVars(outer: string): CSSProperties {
  const column = `((${outer} - ${COLUMN_GAP}) / 2)`;
  const fitPitch = `min(${PITCH_MAX_EM}em, (${column} - ${ICON_BLOCK}) / ${DOTS})`;
  const spreadGap = `((${column} - ${ICON_BLOCK_EM * 2}em - ${DOTS * DOT_EM}em) / ${Math.max(1, DOTS - 1)})`;
  return {
    "--dot": `min(${DOT_EM}em, calc((${fitPitch}) * ${DOT_SHARE}))`,
    "--dot-gap": `max(calc((${fitPitch}) * ${1 - DOT_SHARE}), ${spreadGap})`,
  } as CSSProperties;
}

/** Custom properties for the scene column. Rows read `--dot` and `--dot-gap`. */
export const ROW_VARS = dotRowVars("min(46em, 100cqw)");

/** What a row's dot reads when the scene did not set the variables. */
export const DOT_SIZE = "var(--dot, 0.7em)";
export const DOT_GAP = "var(--dot-gap, 0.45em)";
