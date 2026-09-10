import type { Account, AuthProvider } from './types';
import { newId } from '@/data/defaults';

/**
 * The no-account identity, and the default.
 *
 * It exists so the rest of the app can always assume an account object without
 * every screen needing a null branch, while nothing leaves the device and
 * nothing is asked of the rider.
 */
export class LocalAuthProvider implements AuthProvider {
  readonly id = 'local' as const;
  readonly label = 'Continua senza account';

  isAvailable(): boolean {
    return true;
  }

  unavailableReason(): string | null {
    return null;
  }

  async signIn(): Promise<Account> {
    return {
      provider: 'local',
      id: newId('local'),
      signedInAt: new Date().toISOString(),
    };
  }

  async signOut(): Promise<void> {
    // Nothing to revoke: there was never a remote session.
  }
}
