import type { BikeConfig, CalibrationResult, RawSample } from '@/types';
import { DEFAULT_SENSOR_MODEL, positionFraction, type SensorModel } from './sensor';

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
 *
 * The sensors are linear potentiometers, so the raw-to-position curve depends
 * on how they are wired; that shape lives in `sensor.ts` and is selected by the
 * `SensorModel` passed in here.
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
  /** How the potentiometer's signal maps to position. Defaults to linear. */
  sensorModel?: SensorModel;
}

/** normalized 0..1 -> mm, per section 17 of the spec. */
export function positionMm(normalized: number, totalTravelMm: number): number {
  return normalized * totalTravelMm;
}

export function travelPercentage(positionMm: number, totalTravelMm: number): number {
  if (totalTravelMm <= 0) return 0;
  return (positionMm / totalTravelMm) * 100;
}

/**
 * Raw ADC counts -> normalised 0..1, clamped to the calibrated range.
 *
 * Delegates the curve to the sensor model so a two-wire wiring, whose response
 * is not linear in position, is handled properly instead of being approximated
 * by its endpoints.
 */
export function normalizeRaw(
  raw: number,
  cal: ChannelCalibration,
  model: SensorModel = DEFAULT_SENSOR_MODEL,
): number {
  return positionFraction(raw, cal, model);
}

export function decodeSample(
  t: number,
  frontRaw: number,
  rearRaw: number | null,
  cal: DecodeCalibration,
): RawSample {
  const model = cal.sensorModel ?? DEFAULT_SENSOR_MODEL;
  return {
    t,
    frontMm: positionMm(normalizeRaw(frontRaw, cal.front, model), cal.front.totalTravelMm),
    rearMm:
      rearRaw !== null && cal.rear
        ? positionMm(normalizeRaw(rearRaw, cal.rear, model), cal.rear.totalTravelMm)
        : null,
  };
}

/** Build the decode calibration from the stored calibration and the bike setup. */
export function calibrationFor(
  bike: BikeConfig,
  calibration: CalibrationResult | null,
  sensorModel: SensorModel = DEFAULT_SENSOR_MODEL,
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
    sensorModel,
  };
}
