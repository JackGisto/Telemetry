import { AuthError, type Account, type AuthProvider } from './types';

/**
 * Sign in with Google, through Google Identity Services.
 *
 * WHAT THIS DOES AND DOES NOT DO, because the distinction matters:
 *
 * It establishes *who the rider is* in the browser. Google returns a signed ID
 * token, this reads the name and email out of it, and the app labels the local
 * profile with them.
 *
 * It does NOT protect anything and does NOT sync anything. Verifying that token
 * requires a server, and there is no server: the run data still lives only in
 * this browser's IndexedDB. Treat the identity as a convenience label until a
 * backend exists to validate the token and hold the data. The claims below are
 * read without signature verification for exactly that reason — they are used
 * for display, never for access control.
 *
 * Configure with `VITE_GOOGLE_CLIENT_ID` at build time. Without it the provider
 * reports itself unavailable rather than failing at the first click.
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client';

interface CredentialResponse {
  credential?: string;
}

interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (response: CredentialResponse) => void;
      }): void;
      prompt(listener?: (notification: { isNotDisplayed(): boolean }) => void): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

export function googleClientId(): string | null {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  return id && id.length > 0 ? id : null;
}

/** Load the Google script once, and surface a blocked load as such. */
function loadGis(): Promise<GoogleIdentityServices> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    const script = existing ?? document.createElement('script');

    const onLoad = () => {
      if (window.google?.accounts?.id) resolve(window.google);
      else reject(new AuthError('blocked', 'Servizio di accesso non inizializzato'));
    };

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener(
      'error',
      // A content-security policy or a blocker stops the script; that is not a
      // failure of the rider's credentials and should not be reported as one.
      () => reject(new AuthError('blocked', 'Caricamento del servizio di accesso impedito')),
      { once: true },
    );

    if (!existing) {
      script.src = GIS_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

/**
 * Read the claims out of a JWT payload without verifying the signature.
 *
 * Display only. Anything that grants access must verify server-side.
 */
export function readIdTokenClaims(token: string): {
  sub?: string;
  name?: string;
  email?: string;
  picture?: string;
} {
  const [, payload] = token.split('.');
  if (!payload) throw new AuthError('failed', 'Token non valido');
  const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(decodeURIComponent(escape(json))) as Record<string, string>;
}

export class GoogleAuthProvider implements AuthProvider {
  readonly id = 'google' as const;
  readonly label = 'Accedi con Google';

  isAvailable(): boolean {
    return googleClientId() !== null && typeof window !== 'undefined';
  }

  unavailableReason(): string | null {
    if (this.isAvailable()) return null;
    return 'Accesso con Google non configurato in questa installazione: manca il client ID.';
  }

  async signIn(): Promise<Account> {
    const clientId = googleClientId();
    if (!clientId) throw new AuthError('not-configured');

    const gis = await loadGis();

    const credential = await new Promise<string>((resolve, reject) => {
      gis.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) resolve(response.credential);
          else reject(new AuthError('cancelled'));
        },
      });
      gis.accounts.id.prompt((notification) => {
        // The prompt can be suppressed by browser settings or a prior dismissal.
        if (notification.isNotDisplayed()) reject(new AuthError('blocked'));
      });
    });

    const claims = readIdTokenClaims(credential);
    if (!claims.sub) throw new AuthError('failed', 'Identità non presente nel token');

    return {
      provider: 'google',
      id: claims.sub,
      displayName: claims.name,
      email: claims.email,
      pictureUrl: claims.picture,
      signedInAt: new Date().toISOString(),
    };
  }

  async signOut(): Promise<void> {
    // Only the local session is dropped. Revoking the Google grant is done from
    // the rider's Google account, and pretending otherwise would be misleading.
  }
}
