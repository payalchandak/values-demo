/**
 * How long a change takes once it starts. These are the shortest durations
 * that still read as motion: any shorter and the change is a cut. Time spent
 * reading a settled frame lives in the beat lists, not here.
 */
/** Opacity, color, and cross-fades. */
export const FADE_MS = 80;
/** A position, scale, or shape change. */
export const MOVE_MS = 150;
/** Gap between steps in a staggered sequence (dots, underlines, physicians). */
export const STAGGER_MS = 55;
