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
/** The widest the pitch (one dot's width plus the gap after it) ever gets, in em. */
const PITCH_MAX_EM = 1.15;
/** Share of the pitch the dot itself takes. */
const DOT_SHARE = 0.61;

/** Width of one option column: half the column, less the gap between the two. */
const COLUMN = `((min(46em, 100cqw) - ${COLUMN_GAP}) / 2)`;

/**
 * The pitch is as wide as it can be (the same as the opening's dots always were),
 * but never wider than lets the fullest row fit: edge, icon, gap, then every dot.
 * It reads the scene's width, so a narrow screen tightens the dots instead of
 * pushing them into the other column.
 */
const PITCH = `min(${PITCH_MAX_EM}em, (${COLUMN} - ${0.9 + ICON_EM + 0.7}em) / ${openingRows.maxDotsPerSide})`;

/** Custom properties for the scene column. Rows read `--dot` and `--dot-gap`. */
export const ROW_VARS = {
  "--pitch": PITCH,
  "--dot": `calc(var(--pitch) * ${DOT_SHARE})`,
  "--dot-gap": `calc(var(--pitch) * ${1 - DOT_SHARE})`,
} as CSSProperties;

/** What a row's dot reads when the scene did not set the variables. */
export const DOT_SIZE = "var(--dot, 0.7em)";
export const DOT_GAP = "var(--dot-gap, 0.45em)";
