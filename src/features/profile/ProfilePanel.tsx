import type { RiderSex } from '@/types';
import { HealthProviderError } from '@/health';
import { Button, Card, Choice, Field, useToast } from '@/design-system';
import { useRiderStore } from '@/app/store';
import { TermInfo } from '@/features/help/TermInfo';

const SEX_OPTIONS: Array<{ value: RiderSex; label: string }> = [
  { value: 'male', label: 'Uomo' },
  { value: 'female', label: 'Donna' },
  { value: 'other', label: 'Altro' },
  { value: 'undisclosed', label: 'Non dichiaro' },
];

/**
 * Rider profile.
 *
 * These are health data, so the screen leads with consent and stores nothing
 * until it is given. Withdrawing it deletes the values rather than hiding them.
 */
export function ProfilePanel() {
  const { profile, importing, giveConsent, withdrawConsent, update, importFrom, providers } =
    useRiderStore();
  const toast = useToast();

  if (!profile) return <ConsentGate onAccept={() => void giveConsent()} />;

  const runImport = async (index: number) => {
    const provider = providers()[index];
    try {
      const samples = await importFrom(provider);
      toast.push({
        tone: 'ok',
        title: 'Dati importati',
        body: `${samples.length} valori da ${provider.label}.`,
      });
    } catch (error) {
      const code = error instanceof HealthProviderError ? error.code : 'not-available';
      toast.push({
        tone: 'warn',
        title: 'Import non riuscito',
        body:
          code === 'permission-denied'
            ? 'Permesso negato dall’app di salute.'
            : code === 'no-data'
              ? 'L’app di salute non ha restituito alcun valore.'
              : (provider.unavailableReason() ?? 'Origine non disponibile.'),
      });
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="stack stack--4">
      <Card className="stack stack--5">
        <div className="stack stack--2">
          <span className="ds-label">Profilo rider</span>
          <p className="text-sm muted">
            Servono per interpretare meglio l’assetto. Restano su questo dispositivo e puoi
            eliminarli in qualsiasi momento.
          </p>
        </div>

        <div className="stack stack--2">
          <span className="field__label">Sesso</span>
          {/*
            Two columns: four full-width cards for one short single choice eat
            most of a phone screen for no added clarity.
          */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 'var(--s-2)',
            }}
          >
            {SEX_OPTIONS.map((option) => (
              <Choice
                key={option.value}
                selected={profile.sex === option.value}
                title={option.label}
                onClick={() => void update({ sex: option.value, source: 'manual' })}
              />
            ))}
          </div>
        </div>

        <Field label="Altezza (cm)" htmlFor="rider-height">
          <input
            id="rider-height"
            className="input"
            type="number"
            inputMode="numeric"
            min={100}
            max={230}
            value={profile.heightCm ?? ''}
            onChange={(e) =>
              void update({
                heightCm: e.target.value === '' ? undefined : Number(e.target.value),
                source: 'manual',
              })
            }
          />
        </Field>

        <Field
          label="Peso (kg)"
          hint="Con l’attrezzatura che usi normalmente, come per la misura del sag."
          htmlFor="rider-weight"
          info={<TermInfo id="sag" />}
        >
          <input
            id="rider-weight"
            className="input"
            type="number"
            inputMode="decimal"
            min={30}
            max={200}
            value={profile.weightKg ?? ''}
            onChange={(e) =>
              void update({
                weightKg: e.target.value === '' ? undefined : Number(e.target.value),
                source: 'manual',
              })
            }
          />
        </Field>

        <Field label="Anno di nascita" htmlFor="rider-birth">
          <input
            id="rider-birth"
            className="input"
            type="number"
            inputMode="numeric"
            min={1920}
            max={currentYear}
            value={profile.birthYear ?? ''}
            onChange={(e) =>
              void update({
                birthYear: e.target.value === '' ? undefined : Number(e.target.value),
                source: 'manual',
              })
            }
          />
        </Field>
      </Card>

      <Card className="stack stack--3">
        <span className="ds-label">Importa da un’app di salute</span>
        <p className="text-sm muted">
          Se hai già questi dati altrove, l’app può leggerli invece di fartelo riscrivere.
        </p>

        {providers()
          .filter((provider) => provider.source !== 'manual')
          .map((provider, index) => {
            const reason = provider.unavailableReason();
            return (
              <div key={provider.source} className="stack stack--2">
                <div className="row row--between">
                  <strong className="text-sm">{provider.label}</strong>
                  <Button
                    size="sm"
                    disabled={!provider.isAvailable()}
                    loading={importing === provider.source}
                    onClick={() => void runImport(index)}
                  >
                    Importa
                  </Button>
                </div>
                {reason && <p className="text-xs faint">{reason}</p>}
              </div>
            );
          })}

        {profile.source !== 'manual' && (
          <p className="text-xs" style={{ color: 'var(--c-ok)' }}>
            ✓ Ultimo aggiornamento da{' '}
            {profile.source === 'apple-health' ? 'Salute di Apple' : 'Health Connect'}.
          </p>
        )}
      </Card>

      <Card className="stack stack--3">
        <span className="ds-label">I tuoi dati</span>
        <p className="text-sm muted">
          Il profilo è salvato solo su questo dispositivo. Non viene inviato ad alcun servizio.
        </p>
        <Button variant="danger" block onClick={() => void withdrawConsent()}>
          Revoca il consenso ed elimina il profilo
        </Button>
      </Card>
    </div>
  );
}

/**
 * Consent, asked before anything is written.
 *
 * Body metrics gathered for a health purpose are sensitive under European data
 * protection rules, so the app asks once, explicitly, and works fine if the
 * answer is no.
 */
function ConsentGate({ onAccept }: { onAccept: () => void }) {
  return (
    <Card className="stack stack--4">
      <div className="stack stack--2">
        <span className="ds-label">Profilo rider</span>
        <h3 style={{ fontSize: 'var(--fs-h3)' }}>Vuoi salvare i tuoi dati fisici?</h3>
      </div>

      <p className="text-sm muted">
        Sesso, altezza, peso e anno di nascita aiutano a interpretare l’assetto. Sono dati
        sanitari, quindi te li chiediamo esplicitamente.
      </p>

      <ul className="stack stack--2 text-sm muted" style={{ margin: 0, paddingLeft: '1.2rem' }}>
        <li>Vengono salvati solo su questo dispositivo.</li>
        <li>Non vengono inviati a nessun servizio, nemmeno con un account attivo.</li>
        <li>Puoi eliminarli quando vuoi, con un tocco.</li>
        <li>L’app funziona completamente anche senza di essi.</li>
      </ul>

      <div className="row" style={{ gap: 'var(--s-3)' }}>
        <Button variant="primary" onClick={onAccept}>
          Acconsento
        </Button>
        <span className="text-sm faint">Puoi decidere più tardi.</span>
      </div>
    </Card>
  );
}

/** Compact profile summary, for the settings screen. */
export function ProfileSummary() {
  const profile = useRiderStore((s) => s.profile);
  if (!profile) return <span className="text-sm faint">Non impostato</span>;

  const parts = [
    profile.sex ? SEX_OPTIONS.find((o) => o.value === profile.sex)?.label : null,
    profile.heightCm ? `${profile.heightCm} cm` : null,
    profile.weightKg ? `${profile.weightKg} kg` : null,
  ].filter(Boolean);

  return (
    <span className="text-sm">{parts.length > 0 ? parts.join(' · ') : 'Nessun dato inserito'}</span>
  );
}
