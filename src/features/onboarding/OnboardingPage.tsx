import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from '@/design-system';
import { useBikeStore, useDeviceStore, useSettingsStore } from '@/app/store';
import { ConnectPanel } from '@/features/device/ConnectPanel';
import { BikeWizard } from '@/features/bike/BikeWizard';

type Step = 'welcome' | 'device' | 'bike';

/** First run: what this is, connect the device, configure the bike. Three steps. */
export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('welcome');
  const connection = useDeviceStore((s) => s.connection);
  const bikes = useBikeStore((s) => s.bikes);
  const update = useSettingsStore((s) => s.update);

  const finish = async () => {
    await update({ onboardingCompleted: true });
    navigate('/app');
  };

  const index = ['welcome', 'device', 'bike'].indexOf(step);

  return (
    <main className="app-main" style={{ paddingBottom: 'var(--s-8)' }}>
      <div className="stack stack--5">
        <div className="steps" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`steps__dot${i <= index ? ' steps__dot--done' : ''}`} />
          ))}
        </div>

        {step === 'welcome' && (
          <div className="stack stack--5">
            <div className="stack stack--3">
              <span className="ds-label">Benvenuto</span>
              <h1 style={{ fontSize: 'var(--fs-h1)' }}>
                Misura come lavorano davvero le tue sospensioni.
              </h1>
              <p className="muted">
                Il dispositivo montato sulla bici registra il movimento della forcella e, se
                presente, dell’ammortizzatore posteriore. L’app legge quei dati, capisce come sta
                lavorando la bici e ti dice cosa cambiare.
              </p>
            </div>

            <Card className="stack stack--3">
              <span className="ds-label">Come funziona</span>
              <ol className="stack stack--2 muted" style={{ margin: 0, paddingLeft: '1.2rem' }}>
                <li>Colleghi il dispositivo.</li>
                <li>Calibri le sospensioni a bici sollevata.</li>
                <li>Fai una discesa.</li>
                <li>Scarichi i dati e ricevi i consigli.</li>
              </ol>
            </Card>

            <Button variant="primary" size="lg" block onClick={() => setStep('device')}>
              Iniziamo
            </Button>
          </div>
        )}

        {step === 'device' && (
          <div className="stack stack--5">
            <div className="stack stack--2">
              <span className="ds-label">Passo 2 di 3</span>
              <h1 style={{ fontSize: 'var(--fs-h2)' }}>Collega il dispositivo</h1>
              <p className="muted">
                Puoi anche proseguire con il dispositivo simulato e collegare l’hardware più tardi.
              </p>
            </div>

            <ConnectPanel onConnected={() => setStep('bike')} />

            <div className="row" style={{ gap: 'var(--s-3)' }}>
              <Button variant="ghost" onClick={() => setStep('welcome')}>
                Indietro
              </Button>
              <div className="grow" />
              <Button variant={connection === 'connected' ? 'primary' : 'ghost'} onClick={() => setStep('bike')}>
                {connection === 'connected' ? 'Continua' : 'Salta per ora'}
              </Button>
            </div>
          </div>
        )}

        {step === 'bike' && (
          <div className="stack stack--5">
            <div className="stack stack--2">
              <span className="ds-label">Passo 3 di 3</span>
              <h1 style={{ fontSize: 'var(--fs-h2)' }}>Configura la bici</h1>
              <p className="muted">
                Servono la corsa delle sospensioni e le regolazioni che hai davvero a disposizione:
                l’app non ti consiglierà mai una modifica che la tua sospensione non permette.
              </p>
            </div>

            <BikeWizard onDone={() => void finish()} />

            {bikes.length > 0 && (
              <Button variant="ghost" block onClick={() => void finish()}>
                Ho già configurato una bici, entra nell’app
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
