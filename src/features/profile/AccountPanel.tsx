import { useState } from 'react';
import type { AuthProviderId } from '@/auth';
import { AUTH_MESSAGES, googleClientId } from '@/auth';
import { Button, Card, StatusIndicator, useToast } from '@/design-system';
import { useAccountStore } from '@/app/store';

/**
 * Sign-in.
 *
 * The no-account path is a first-class option, not a fallback: the product's
 * promise is that it works offline with nothing to register, and the screen
 * says so plainly instead of nudging towards an account.
 */
export function AccountPanel({ onDone }: { onDone?: () => void }) {
  const { account, signingIn, signIn, signOut, providers } = useAccountStore();
  const [confirmingOut, setConfirmingOut] = useState(false);
  const toast = useToast();

  const attempt = async (id: AuthProviderId) => {
    try {
      await signIn(id);
      toast.push({
        tone: 'ok',
        title: id === 'google' ? 'Accesso effettuato' : 'Puoi iniziare',
      });
      onDone?.();
    } catch {
      const code = useAccountStore.getState().lastError ?? 'failed';
      const message = AUTH_MESSAGES[code];
      toast.push({ tone: code === 'cancelled' ? 'info' : 'danger', ...{ title: message.title, body: message.body } });
    }
  };

  if (account) {
    return (
      <Card className="stack stack--4">
        <div className="row row--between">
          <div className="stack stack--1">
            <strong>{account.displayName ?? 'Account locale'}</strong>
            <span className="text-xs faint">
              {account.email ?? 'Nessun account: i dati restano su questo dispositivo.'}
            </span>
          </div>
          <StatusIndicator
            tone={account.provider === 'google' ? 'ok' : 'neutral'}
            label={account.provider === 'google' ? 'Google' : 'Locale'}
          />
        </div>

        {account.provider === 'google' && (
          <p className="text-xs faint">
            L’accesso identifica te, ma non sincronizza nulla: le run restano su questo
            dispositivo finché non esiste un servizio che le conservi.
          </p>
        )}

        {confirmingOut ? (
          <div className="stack stack--3">
            <p className="text-sm muted">
              Uscendo resti sull’app senza account. Le tue run, le bici e il profilo non vengono
              eliminati.
            </p>
            <div className="row" style={{ gap: 'var(--s-2)' }}>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingOut(false)}>
                Annulla
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  void signOut();
                  setConfirmingOut(false);
                }}
              >
                Esci
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirmingOut(true)}>
            Esci dall’account
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className="stack stack--3">
      {providers().map((provider) => {
        const reason = provider.unavailableReason();
        const isLocal = provider.id === 'local';
        return (
          <Card key={provider.id} className="stack stack--3">
            <div className="row row--between">
              <strong>{provider.label}</strong>
              {isLocal && <span className="badge badge--info">Consigliato</span>}
            </div>

            <p className="text-sm muted">
              {isLocal
                ? 'Nessuna registrazione. Tutto resta sul telefono e l’app funziona anche offline.'
                : 'Usa il tuo account Google per identificarti, senza creare una password.'}
            </p>

            {reason && (
              <p className="text-sm" style={{ color: 'var(--c-warn)' }}>
                {reason}
              </p>
            )}

            <Button
              variant={isLocal ? 'primary' : 'secondary'}
              block
              disabled={!provider.isAvailable()}
              loading={signingIn === provider.id}
              onClick={() => void attempt(provider.id)}
            >
              {isLocal ? 'Continua senza account' : provider.label}
            </Button>
          </Card>
        );
      })}

      {googleClientId() === null && (
        <p className="text-xs faint">
          Per attivare l’accesso con Google serve un client ID Google, impostato come
          <span className="ds-mono"> VITE_GOOGLE_CLIENT_ID </span>
          al momento della build.
        </p>
      )}
    </div>
  );
}
