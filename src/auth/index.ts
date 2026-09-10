import type { AuthProvider } from './types';
import { LocalAuthProvider } from './localProvider';
import { GoogleAuthProvider } from './googleProvider';

export * from './types';
export * from './localProvider';
export * from './googleProvider';

/**
 * The sign-in options, with the no-account path always present.
 *
 * Google is listed even when it is not configured, so the rider is told the
 * feature exists and why it is off here, rather than silently seeing nothing.
 */
export function authProviders(): AuthProvider[] {
  return [new GoogleAuthProvider(), new LocalAuthProvider()];
}

export function createAuthProvider(id: 'local' | 'google'): AuthProvider {
  return id === 'google' ? new GoogleAuthProvider() : new LocalAuthProvider();
}
