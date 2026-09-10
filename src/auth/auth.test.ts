import { describe, expect, it } from 'vitest';
import { AUTH_MESSAGES, AuthError, GoogleAuthProvider, LocalAuthProvider, authProviders, createAuthProvider, googleClientId, readIdTokenClaims } from './index';

describe('identità locale', () => {
  it('è sempre disponibile e non richiede nulla', async () => {
    const provider = new LocalAuthProvider();
    expect(provider.isAvailable()).toBe(true);
    expect(provider.unavailableReason()).toBeNull();

    const account = await provider.signIn();
    expect(account.provider).toBe('local');
    expect(account.id).toMatch(/^local_/);
    expect(account.email).toBeUndefined();
  });

  it('genera identificativi distinti', async () => {
    const provider = new LocalAuthProvider();
    const [a, b] = [await provider.signIn(), await provider.signIn()];
    expect(a.id).not.toBe(b.id);
  });
});

describe('accesso con Google', () => {
  it('si dichiara non disponibile senza client ID configurato', () => {
    expect(googleClientId()).toBeNull();
    const provider = new GoogleAuthProvider();
    expect(provider.isAvailable()).toBe(false);
    expect(provider.unavailableReason()).toMatch(/client id/i);
  });

  it('rifiuta l’accesso invece di tentare una chiamata destinata a fallire', async () => {
    await expect(new GoogleAuthProvider().signIn()).rejects.toMatchObject({
      code: 'not-configured',
    });
  });

  it('estrae le informazioni di identità dal token', () => {
    const payload = { sub: '123', name: 'Jack', email: 'jack@example.com' };
    const token = ['header', btoa(JSON.stringify(payload)), 'signature'].join('.');
    expect(readIdTokenClaims(token)).toMatchObject(payload);
  });

  it('rifiuta un token malformato', () => {
    expect(() => readIdTokenClaims('non-un-token')).toThrow(AuthError);
  });
});

describe('scelta del provider', () => {
  it('elenca Google e il percorso senza account', () => {
    expect(authProviders().map((p) => p.id)).toEqual(['google', 'local']);
  });

  it('costruisce il provider richiesto', () => {
    expect(createAuthProvider('local').id).toBe('local');
    expect(createAuthProvider('google').id).toBe('google');
  });

  it('ha un messaggio comprensibile per ogni errore', () => {
    for (const code of ['not-configured', 'blocked', 'cancelled', 'failed'] as const) {
      expect(AUTH_MESSAGES[code].title.length).toBeGreaterThan(5);
      expect(AUTH_MESSAGES[code].body.length).toBeGreaterThan(20);
    }
    // Every failure path must leave the rider a way forward.
    expect(AUTH_MESSAGES['not-configured'].body).toMatch(/senza account/i);
  });
});
