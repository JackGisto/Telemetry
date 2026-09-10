/**
 * Bike & suspension configuration.
 *
 * Every adjuster is optional and carries an explicit `available` flag: the
 * recommendation engine must never propose an adjustment the user's suspension
 * does not physically have (see `src/analysis/recommendations`).
 */

export type SuspensionSpringType = 'air' | 'coil';

/** A click-based adjuster (rebound / compression). */
export interface ClickAdjuster {
  available: boolean;
  /** Current setting, counted in clicks from fully closed. */
  clicks?: number;
  /** Total clicks of adjustment range, when the user knows it. */
  totalClicks?: number;
}

export interface SuspensionConfig {
  /** Stroke of the unit in mm (fork: axle travel; shock: shock stroke). */
  totalTravelMm: number;
  springType: SuspensionSpringType;
  /** Air pressure in PSI. Only meaningful when springType === 'air'. */
  pressurePsi?: number;
  /** Coil rate in lb/in. Only meaningful when springType === 'coil'. */
  springRateLbIn?: number;
  /** Preload turns. Typically only meaningful on coil units. */
  preload?: { available: boolean; turns?: number };
  rebound: ClickAdjuster;
  compression: ClickAdjuster;
  /** Low-speed / high-speed split, when the unit offers it. */
  highSpeedCompression?: ClickAdjuster;
  highSpeedRebound?: ClickAdjuster;
}

export interface RearSuspensionConfig extends SuspensionConfig {
  /**
   * Average leverage ratio (wheel travel / shock stroke). Optional: when
   * absent, rear analysis is expressed purely in shock-stroke percentage.
   */
  leverageRatio?: number;
}

export type RidingStyle = 'comfort' | 'balanced' | 'aggressive';
export type RiderLevel = 'base' | 'intermediate' | 'advanced';

export interface RiderProfile {
  style: RidingStyle;
  level?: RiderLevel;
  /**
   * Rider weight in kg.
   *
   * Kept for the run snapshot, so an exported run records the weight it was
   * ridden at, but it is not editable per bike: the editable value lives in the
   * rider profile (`RiderHealthProfile`), because the same person on two bikes
   * weighs the same and two copies would drift apart.
   */
  weightKg?: number;
}

export interface BikeConfig {
  id: string;
  name: string;
  frontSuspension: SuspensionConfig;
  /** `present: false` hides the whole rear branch of the UI and the analysis. */
  rearSuspension: { present: false } | ({ present: true } & RearSuspensionConfig);
  rider: RiderProfile;
  createdAt: string;
  updatedAt: string;
}

export type SuspensionComponent = 'front' | 'rear';
