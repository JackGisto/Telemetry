import type { HealthProvider } from './provider';
import { ManualHealthProvider } from './manualProvider';
import { NativeHealthProvider } from './nativeBridge';

export * from './provider';
export * from './manualProvider';
export * from './nativeBridge';

/**
 * Every way the profile can be filled, in the order the UI shows them.
 *
 * The native ones are listed even where they cannot run, because telling the
 * rider "this needs the app" is more useful than hiding the option and leaving
 * them wondering whether the feature exists.
 */
export function healthProviders(): HealthProvider[] {
  return [
    new NativeHealthProvider('apple-health', 'Salute di Apple'),
    new NativeHealthProvider('health-connect', 'Health Connect'),
    new ManualHealthProvider(),
  ];
}
