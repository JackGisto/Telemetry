import type { BikeConfig, CalibrationResult, RawSample } from '@/types';

/**
 * ADC -> millimetres adapter.
 *
 * This is deliberately the ONLY place that knows about raw sensor counts. The
 * analysis engine consumes millimetres and never sees this module, so swapping
 * the sensor or the firmware's encoding changes nothing downstream.
 *
 * FIRMWARE TBD: `fullScaleRaw` is the count the device reports at full sensor
 * extension. Until the firmware freezes its ADC resolution and scaling, it is
 * read from the calibration result or falls back to `DEFAULT_FULL_SCALE_RAW`.
 */
export const DEFAULT_FULL_SCALE_RAW = 4095;

export interface ChannelCalibration {
  /** Raw counts at full extension (0 mm of travel used). */
  zeroRaw: number;
  /** Raw counts at full compression. */
  fullRaw: number;
  /** Configured stroke of the unit, in mm. */
  totalTravelMm: number;
}

export interface DecodeCalibration {
  front: ChannelCalibration;
  rear: ChannelCalibration | null;
}

/** normalized 0..1 -> mm, per section 17 of the spec. */
export function positionMm(normalized: number, totalTravelMm: number): number {
  return normalized * totalTravelMm;
}

export function travelPercentage(positionMm: number, totalTravelMm: number): number {
  if (totalTravelMm <= 0) return 0;
  return (positionMm / totalTravelMm) * 100;
}

/** Raw ADC counts -> normalised 0..1, clamped to the calibrated range. */
export function normalizeRaw(raw: number, cal: ChannelCalibration): number {
  const span = cal.fullRaw - cal.zeroRaw;
  if (span === 0) return 0;
  const n = (raw - cal.zeroRaw) / span;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

export function decodeSample(
  t: number,
  frontRaw: number,
  rearRaw: number | null,
  cal: DecodeCalibration,
): RawSample {
  return {
    t,
    frontMm: positionMm(normalizeRaw(frontRaw, cal.front), cal.front.totalTravelMm),
    rearMm:
      rearRaw !== null && cal.rear
        ? positionMm(normalizeRaw(rearRaw, cal.rear), cal.rear.totalTravelMm)
        : null,
  };
}

/** Build the decode calibration from the stored calibration and the bike setup. */
export function calibrationFor(
  bike: BikeConfig,
  calibration: CalibrationResult | null,
): DecodeCalibration {
  const channel = (component: 'front' | 'rear', totalTravelMm: number): ChannelCalibration => {
    const found = calibration?.channels.find((c) => c.component === component);
    return {
      zeroRaw: found?.zeroRaw ?? 0,
      fullRaw: found?.fullRaw ?? DEFAULT_FULL_SCALE_RAW,
      totalTravelMm,
    };
  };
  return {
    front: channel('front', bike.frontSuspension.totalTravelMm),
    rear: bike.rearSuspension.present
      ? channel('rear', bike.rearSuspension.totalTravelMm)
      : null,
  };
}
