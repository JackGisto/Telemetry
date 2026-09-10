import type { HealthImportResult, HealthSample } from '@/types';
import { HealthProviderError, type HealthProvider } from './provider';

/**
 * Bridge to a phone's health app.
 *
 * NATIVE ONLY — this cannot work in a browser, and that is a platform fact
 * rather than something left unfinished:
 *
 *  - Apple Health is reachable only through HealthKit, an iOS framework. There
 *    is no web API and Safari cannot read it.
 *  - Android's Health Connect is likewise an on-device Android API. The old
 *    Google Fit REST API, which was reachable from the web, has been retired.
 *
 * So the import works once the app is wrapped in a native shell, which is the
 * plan the architecture already assumes. Until then this provider reports
 * itself unavailable and says why.
 *
 * The shell is expected to expose the object described by `NativeHealthBridge`
 * on `window`. Nothing else in the app needs to change when it appears.
 */
export interface NativeHealthBridge {
  /** Which health store the shell is talking to. */
  platform: 'apple-health' | 'health-connect';
  requestPermission(): Promise<boolean>;
  /** Returns only the fields the rider authorised. */
  readProfile(): Promise<HealthSample[]>;
}

declare global {
  interface Window {
    /** Injected by the native shell. Absent in every browser. */
    mtbHealthBridge?: NativeHealthBridge;
  }
}

export function nativeBridge(): NativeHealthBridge | null {
  if (typeof window === 'undefined') return null;
  return window.mtbHealthBridge ?? null;
}

/** True when running inside a native shell that offers health data. */
export function hasNativeHealth(): boolean {
  return nativeBridge() !== null;
}

export class NativeHealthProvider implements HealthProvider {
  constructor(
    readonly source: 'apple-health' | 'health-connect',
    readonly label: string,
  ) {}

  isAvailable(): boolean {
    const bridge = nativeBridge();
    return bridge !== null && bridge.platform === this.source;
  }

  unavailableReason(): string | null {
    if (this.isAvailable()) return null;
    return `L’accesso a ${this.label} è possibile solo dall’app installata: un browser non può leggere i dati sanitari del telefono. Per ora inserisci i valori a mano.`;
  }

  async requestPermission(): Promise<boolean> {
    const bridge = nativeBridge();
    if (!bridge) throw new HealthProviderError('not-available');
    return bridge.requestPermission();
  }

  async read(): Promise<HealthImportResult> {
    const bridge = nativeBridge();
    if (!bridge) throw new HealthProviderError('not-available');

    const granted = await bridge.requestPermission();
    if (!granted) throw new HealthProviderError('permission-denied');

    const samples = await bridge.readProfile();
    if (samples.length === 0) throw new HealthProviderError('no-data');
    return { source: this.source, samples };
  }
}
