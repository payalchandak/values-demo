import RadarChart, { type RadarChartMode } from "../../components/RadarChart";
import type { Profile } from "../../study/types";

/*
 * Thin adapter over the shared RadarChart. Every radar in the ending goes
 * through here, so axes (A top, B right, N bottom, J left), order and the
 * fixed 0 to 1 scale are the chart's own and identical everywhere. Data is
 * passed through untouched: never renormalized, rescaled, or reordered.
 */

/** viewBox aspect (height / width) of each mode, from the chart's fixed geometry. */
export const RADAR_ASPECT: Record<RadarChartMode, number> = {
  full: 270 / 416,
  compact: 126 / 120,
};

/** Plot radius as a fraction of the chart's rendered width, per mode. */
export const PLOT_RADIUS_PER_WIDTH: Record<RadarChartMode, number> = {
  full: 104 / 416,
  compact: 38 / 120,
};

export default function Radar({
  profile,
  width,
  mode,
}: {
  profile: Profile;
  /** Rendered width in px; the chart scales with its container. */
  width: number;
  mode: RadarChartMode;
}) {
  return (
    <div style={{ width }}>
      <RadarChart
        priorities={profile.priorities}
        mode={mode}
        title={`${profile.displayName} priorities`}
        description={`Priorities of ${profile.displayName} across autonomy, beneficence, nonmaleficence and justice, on a fixed scale from 0 to 1.`}
      />
    </div>
  );
}
