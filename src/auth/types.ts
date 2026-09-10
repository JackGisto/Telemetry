/**
 * Accounts.
 *
 * The product's promise is that it works with no account at all, and that stays
 * true: `local` is the default identity and every screen works under it. An
 * account is something the rider opts into, not a gate in front of the app.
 */

export type AuthProviderId = 'local' | 'google';

export interface Account {
  provider: AuthProviderId;
  /** Stable identifier. For `local` it is generated on the device. */
  id: string;
  displayName?: string;
  email?: string;
  pictureUrl?: string;
  signedInAt: string;
}

export interface AuthProvider {
  readonly id: AuthProviderId;
  readonly label: string;
  isAvailable(): boolean;
  /** Why the provider cannot be used here, for the UI to show. */
  unavailableReason(): string | null;
  signIn(): Promise<Account>;
  signOut(): Promise<void>;
}

export class AuthError extends Error {
  constructor(
    readonly code: 'not-configured' | 'blocked' | 'cancelled' | 'failed',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'AuthError';
  }
}

export const AUTH_MESSAGES: Record<AuthError['code'], { title: string; body: string }> = {
  'not-configured': {
    title: 'Accesso non configurato',
    body: 'Questa installazione non ha le credenziali per l’accesso con Google. Puoi continuare senza account.',
  },
  blocked: {
    title: 'Accesso bloccato dal browser',
    body: 'Il browser ha impedito il caricamento del servizio di accesso. Puoi continuare senza account.',
  },
  cancelled: {
    title: 'Accesso annullato',
    body: 'Nessun problema: l’app funziona anche senza account.',
  },
  failed: {
    title: 'Accesso non riuscito',
    body: 'Riprova, oppure continua senza account.',
  },
};
