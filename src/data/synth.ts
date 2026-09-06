import type { RawSample } from '@/types';

/**
 * Deterministic run generator used by the mock device and the test datasets.
 *
 * The datasets in `src/data/fixtures` are stored as generator descriptors plus a
 * seed rather than as multi-megabyte sample dumps: the same seed always yields
 * exactly the same trace, so engine tests stay reproducible and the repository
 * stays small. Replace `generateRun` with a real recorded trace whenever one is
 * available; nothing downstream depends on how the samples were produced.
 */

/** Mulberry32: small, fast, fully deterministic. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ChannelProfile {
  /** Stroke of the unit, in mm. */
  totalTravelMm: number;
  /** Sag: where the unit sits under the rider, as a fraction of stroke. */
  sag: number;
  /**
   * Spring stiffness factor: 1 is neutral, >1 resists compression (stiff
   * setup, uses less travel), <1 gives away travel easily.
   */
  stiffness: number;
  /**
   * Rebound damping factor: 1 is neutral, <1 returns faster (bouncy), >1
   * returns slower (packs down).
   */
  reboundDamping: number;
  /** Sensor noise, in mm RMS. */
  noiseMm: number;
}

export interface RunProfile {
  durationSec: number;
  sampleRateHz: number;
  /** Mean number of terrain hits per second. */
  hitsPerSec: number;
  /** Size of a typical hit as a fraction of stroke, before stiffness. */
  hitSizeMean: number;
  /** Shape of the hit-size distribution: higher means rarer big hits. */
  hitSizeSpread: number;
  front: ChannelProfile;
  rear: ChannelProfile | null;
  seed: number;
}

interface Hit {
  atSec: number;
  amplitude: number;
  riseSec: number;
}

/**
 * Hits are spaced along the run rather than dropped at uniformly random times:
 * random times cluster, and clustered hits superimpose into a trace that sits
 * permanently at the bottom of the stroke, which no real trail produces.
 * Sizes follow a skewed distribution so most hits are small and a few are big.
 */
function planHits(profile: RunProfile, rng: () => number): Hit[] {
  const hits: Hit[] = [];
  const meanGapSec = 1 / Math.max(profile.hitsPerSec, 0.01);
  let t = meanGapSec * rng();

  while (t < profile.durationSec) {
    const size = rng() ** profile.hitSizeSpread;
    const amplitude = Math.max(0.02, profile.hitSizeMean * (0.35 + size * 2.4));
    hits.push({
      atSec: t,
      amplitude,
      // Bigger hits load the suspension over a slightly longer ramp.
      riseSec: 0.05 + amplitude * 0.25 + rng() * 0.04,
    });
    // Jitter the spacing by +/-45% so the trace does not look metronomic.
    t += meanGapSec * (0.55 + rng() * 0.9);
  }
  return hits;
}

/**
 * Travel response of one channel: sag plus the sum of the hits, each modelled
 * as a fast asymmetric ramp up and a damped exponential return.
 */
function channelTrace(
  channel: ChannelProfile,
  hits: Hit[],
  profile: RunProfile,
  rng: () => number,
  /** Rear hits land slightly after front hits, as the wheel arrives later. */
  delaySec: number,
): number[] {
  const n = Math.round(profile.durationSec * profile.sampleRateHz);
  const out = new Array<number>(n);
  const base = channel.sag * channel.totalTravelMm;

  for (let i = 0; i < n; i++) {
    const t = i / profile.sampleRateHz;
    let travel = base;

    for (const hit of hits) {
      const at = hit.atSec + delaySec;
      const dt = t - at;
      if (dt < -hit.riseSec || dt > 1.5) continue;
      const amplitude = (hit.amplitude / channel.stiffness) * channel.totalTravelMm;

      if (dt < 0) {
        // Compression ramp: linear rise into the peak.
        travel += amplitude * (1 + dt / hit.riseSec);
      } else {
        // Rebound: exponential return, slowed by the damping factor.
        // Neutral damping (1.0) recovers to 25% of the hit in ~0.28 s, the
        // middle of the "balanced" target band in the engine tunables.
        const tau = 0.2 * channel.reboundDamping;
        const decay = Math.exp(-dt / tau);
        // A fast rebound overshoots back towards the top of the stroke.
        const overshoot =
          channel.reboundDamping < 0.85
            ? -0.22 * amplitude * Math.exp(-dt / (tau * 2.2)) * Math.sin(dt / tau)
            : 0;
        travel += amplitude * decay + overshoot;
      }
    }

    travel += (rng() - 0.5) * 2 * channel.noiseMm;
    out[i] = Math.min(channel.totalTravelMm, Math.max(0, travel));
  }
  return out;
}

/** Generate a full run. Same profile + seed always gives the same samples. */
export function generateRun(profile: RunProfile): RawSample[] {
  const rng = createRng(profile.seed);
  const hits = planHits(profile, rng);
  const front = channelTrace(profile.front, hits, profile, rng, 0);
  const rear = profile.rear ? channelTrace(profile.rear, hits, profile, rng, 0.05) : null;

  const stepMs = 1000 / profile.sampleRateHz;
  return front.map((frontMm, i) => ({
    t: Math.round(i * stepMs),
    frontMm,
    rearMm: rear ? rear[i] : null,
  }));
}
