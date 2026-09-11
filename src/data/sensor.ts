/**
 * Sensor transfer function: raw signal to fractional position.
 *
 * The sensors are linear potentiometers — variable resistances driven by the
 * suspension's movement — and how they are wired decides the shape of the
 * response. Getting this wrong does not produce an obviously broken app: it
 * produces plausible numbers that are quietly wrong in the middle of the
 * stroke, which would then be wrong in every metric, diagnosis and
 * recommendation downstream. So it is modelled explicitly rather than assumed.
 *
 * Two wirings matter:
 *
 *  - **Ratiometric (three wires).** The wiper sits between supply and ground,
 *    so its voltage is proportional to position. The ADC reading is linear in
 *    travel and the two calibration endpoints describe the whole range. This is
 *    the normal way to wire a position potentiometer and the default here.
 *
 *  - **Rheostat (two wires).** Only two terminals are used and a fixed resistor
 *    completes the divider. Voltage is then a ratio of resistances, not of
 *    position, so the response is hyperbolic: calibrating the two endpoints
 *    leaves the middle of the stroke off by several percent. Inverting it needs
 *    the fixed resistor's value and the potentiometer's end-to-end resistance.
 *
 * HARDWARE TBD — which wiring the acquisition unit uses, and the resistor
 * values if it is the second, are for the electronics side to confirm. The app
 * defaults to ratiometric and switches on a stored sensor model, so the answer
 * changes one config object and nothing else.
 */

export type SensorModel =
  | {
      /** Wiper voltage proportional to position: linear in travel. */
      kind: 'ratiometric';
    }
  | {
      /** Two-wire potentiometer in a divider with a fixed resistor. */
      kind: 'rheostat';
      /** Fixed resistor completing the divider, in ohms. */
      fixedOhm: number;
      /** Potentiometer resistance at full extension, in ohms. */
      minOhm: number;
      /** Potentiometer resistance at full compression, in ohms. */
      maxOhm: number;
      /** Highest value the ADC can report, e.g. 4095 for 12-bit. */
      adcFullScale: number;
      /**
       * True when the potentiometer sits between supply and the ADC node, so
       * the reading falls as resistance rises. False when the fixed resistor is
       * on the supply side.
       */
      potOnHighSide: boolean;
    };

export const DEFAULT_SENSOR_MODEL: SensorModel = { kind: 'ratiometric' };

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Resistance implied by an ADC reading in a two-resistor divider.
 *
 * Returns null where the reading sits at a rail: the divider cannot be
 * inverted there, and extrapolating would invent a position.
 */
export function resistanceFromAdc(
  raw: number,
  model: Extract<SensorModel, { kind: 'rheostat' }>,
): number | null {
  const ratio = raw / model.adcFullScale;
  if (!(ratio > 0) || !(ratio < 1)) return null;

  // Vout/Vcc = Rpot / (Rpot + Rfixed)  when the pot is on the high side,
  // Vout/Vcc = Rfixed / (Rpot + Rfixed) when the fixed resistor is.
  return model.potOnHighSide
    ? (model.fixedOhm * ratio) / (1 - ratio)
    : model.fixedOhm * (1 / ratio - 1);
}

/**
 * Raw signal to fractional position, 0 at full extension and 1 at full
 * compression.
 *
 * `zeroRaw` and `fullRaw` come from calibration and are used by the linear
 * path. The rheostat path goes through resistance instead, because its
 * endpoints alone do not describe the curve between them.
 */
export function positionFraction(
  raw: number,
  calibration: { zeroRaw: number; fullRaw: number },
  model: SensorModel = DEFAULT_SENSOR_MODEL,
): number {
  if (model.kind === 'ratiometric') {
    const span = calibration.fullRaw - calibration.zeroRaw;
    if (span === 0) return 0;
    return clamp01((raw - calibration.zeroRaw) / span);
  }

  const resistance = resistanceFromAdc(raw, model);
  if (resistance === null) {
    // At a rail, fall back to whichever end the reading is pinned against.
    const ratio = raw / model.adcFullScale;
    const atTop = model.potOnHighSide ? ratio >= 1 : ratio <= 0;
    return atTop ? 1 : 0;
  }

  const span = model.maxOhm - model.minOhm;
  if (span === 0) return 0;
  return clamp01((resistance - model.minOhm) / span);
}
