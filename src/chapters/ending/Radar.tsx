import RadarChart, { radarMetrics, type RadarChartMode } from "../../components/RadarChart";
import type { Profile } from "../../study/types";

/*
 * Thin adapter over the shared RadarChart. Every radar in the ending goes
 * through here, so axes (A top, B right, N bottom, J left), order and the
 * fixed 0 to 1 scale are the chart's own and identical everywhere. Data is
 * passed through untouched: never renormalized, rescaled, or reordered.
 */

/** viewBox aspect (height / width) of each mode, from the chart's fixed geometry. */
export const RADAR_ASPECT: Record<RadarChartMode, number> = {
  full: radarMetrics.full.height / radarMetrics.full.width,
  compact: radarMetrics.compact.height / radarMetrics.compact.width,
};

/** Plot radius as a fraction of the chart's rendered width, per mode. */
export const PLOT_RADIUS_PER_WIDTH: Record<RadarChartMode, number> = {
  full: radarMetrics.full.radius / radarMetrics.full.width,
  compact: radarMetrics.compact.radius / radarMetrics.compact.width,
};

export default function Radar({
  profile,
  width,
  mode,
  progress = 1,
}: {
  profile: Profile;
  /** Rendered width in px; the chart scales with its container. */
  width: number;
  mode: RadarChartMode;
  /** Entrance, 0 to 1. Omitted charts are the settled frame. */
  progress?: number;
}) {
  return (
    <div style={{ width }}>
      <RadarChart
        priorities={profile.priorities}
        mode={mode}
        progress={progress}
        title={`${profile.displayName} priorities`}
        description={`Priorities of ${profile.displayName} across autonomy, beneficence, nonmaleficence and justice, on a fixed scale from 0 to 1.`}
      />
    </div>
  );
}
