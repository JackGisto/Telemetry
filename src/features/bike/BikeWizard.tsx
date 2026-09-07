import { useState } from 'react';
import type { BikeConfig, RiderLevel, RidingStyle, SuspensionConfig } from '@/types';
import { Button, Card, Choice, Field, useToast } from '@/design-system';
import { createDefaultBike } from '@/data/defaults';
import { useBikeStore } from '@/app/store';
import { TermInfo } from '@/features/help/TermInfo';
import { SuspensionForm } from './SuspensionForm';

const STYLES: Array<{ value: RidingStyle; title: string; description: string }> = [
  {
    value: 'comfort',
    title: 'Comfort',
    description: 'Priorità al confort e alla trazione. La sospensione lavora morbida e progressiva.',
  },
  {
    value: 'balanced',
    title: 'Bilanciato',
    description: 'Il compromesso classico da trail: supporto e assorbimento in equilibrio.',
  },
  {
    value: 'aggressive',
    title: 'Aggressivo',
    description: 'Massimo supporto. Usare tutta la corsa sui colpi forti è normale.',
  },
];

const LEVELS: Array<{ value: RiderLevel; title: string; description: string }> = [
  { value: 'base', title: 'Base', description: 'Consigli semplici, nessun grafico.' },
  { value: 'intermediate', title: 'Intermedio', description: 'Consigli con una spiegazione.' },
  { value: 'advanced', title: 'Avanzato', description: 'Accesso completo a grafici e dati.' },
];

const STEP_TITLES = ['Bici', 'Forcella', 'Posteriore', 'Rider'];

/**
 * Bike setup wizard.
 *
 * The rear-suspension question comes before any rear field: answering "no"
 * removes the entire rear branch from the configuration, so nothing downstream
 * — analysis, charts, recommendations — ever refers to a shock the bike lacks.
 */
export function BikeWizard({
  initial,
  onDone,
}: {
  initial?: BikeConfig;
  onDone: (bike: BikeConfig) => void;
}) {
  const [bike, setBike] = useState<BikeConfig>(() => initial ?? createDefaultBike());
  const [step, setStep] = useState(0);
  const upsert = useBikeStore((s) => s.upsert);
  const toast = useToast();

  const hasRear = bike.rearSuspension.present;
  // Step 2 is skipped entirely on a hardtail.
  const steps = hasRear ? [0, 1, 2, 3] : [0, 1, 3];
  const position = steps.indexOf(step);

  const go = (delta: number) => {
    const next = steps[position + delta];
    if (next !== undefined) setStep(next);
  };

  const save = async () => {
    const saved = { ...bike, updatedAt: new Date().toISOString() };
    await upsert(saved);
    toast.push({ tone: 'ok', title: 'Bici salvata' });
    onDone(saved);
  };

  const setFront = (frontSuspension: SuspensionConfig) => setBike({ ...bike, frontSuspension });

  return (
    <div className="stack stack--5">
      <div className="stack stack--2">
        <div className="steps" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s} className={`steps__dot${i <= position ? ' steps__dot--done' : ''}`} />
          ))}
        </div>
        <span className="ds-label">
          Passo {position + 1} di {steps.length} · {STEP_TITLES[step]}
        </span>
      </div>

      {step === 0 && (
        <Card className="stack stack--5">
          <Field label="Nome della bici" htmlFor="bike-name">
            <input
              id="bike-name"
              className="input"
              value={bike.name}
              onChange={(e) => setBike({ ...bike, name: e.target.value })}
            />
          </Field>

          <div className="stack stack--3">
            <span className="field__label">La tua bici ha un ammortizzatore posteriore?</span>
            <div className="row" style={{ gap: 'var(--s-3)' }}>
              <Choice
                selected={hasRear}
                title="Sì, full suspension"
                onClick={() =>
                  setBike({
                    ...bike,
                    rearSuspension: hasRear
                      ? bike.rearSuspension
                      : {
                          present: true,
                          totalTravelMm: 60,
                          springType: 'air',
                          pressurePsi: 180,
                          rebound: { available: true, clicks: 7, totalClicks: 14 },
                          compression: { available: true, clicks: 8, totalClicks: 14 },
                        },
                  })
                }
              />
              <Choice
                selected={!hasRear}
                title="No, hardtail"
                onClick={() => setBike({ ...bike, rearSuspension: { present: false } })}
              />
            </div>
            <p className="text-xs faint">
              Su una hardtail l’app nasconde ogni impostazione e ogni analisi del posteriore.
            </p>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <h2 className="card__title">Forcella</h2>
          <SuspensionForm
            idPrefix="front"
            value={bike.frontSuspension}
            onChange={setFront}
            travelLabel="Corsa totale della forcella"
          />
        </Card>
      )}

      {step === 2 && bike.rearSuspension.present && (
        <Card>
          <h2 className="card__title">Ammortizzatore posteriore</h2>
          <SuspensionForm
            idPrefix="rear"
            value={bike.rearSuspension}
            onChange={(next) =>
              setBike({ ...bike, rearSuspension: { ...bike.rearSuspension, ...next, present: true } })
            }
            travelLabel="Corsa dell’ammortizzatore (stroke)"
          />
          <div style={{ marginTop: 'var(--s-5)' }}>
            <Field
              label="Rapporto di leva (opzionale)"
              hint="Corsa ruota divisa per corsa ammortizzatore. Se non lo conosci, lascialo vuoto."
              htmlFor="rear-leverage"
              info={<TermInfo id="leverage-ratio" />}
            >
              <input
                id="rear-leverage"
                className="input"
                type="number"
                inputMode="decimal"
                step={0.05}
                value={bike.rearSuspension.leverageRatio ?? ''}
                onChange={(e) =>
                  setBike({
                    ...bike,
                    rearSuspension: {
                      ...bike.rearSuspension,
                      present: true,
                      leverageRatio: e.target.value === '' ? undefined : Number(e.target.value),
                    } as BikeConfig['rearSuspension'],
                  })
                }
              />
            </Field>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="stack stack--5">
          <div className="stack stack--3">
            <span className="field__label info-label">
              <span>Stile di guida</span>
              <TermInfo id="riding-style" />
            </span>
            {STYLES.map((style) => (
              <Choice
                key={style.value}
                selected={bike.rider.style === style.value}
                title={style.title}
                description={style.description}
                onClick={() => setBike({ ...bike, rider: { ...bike.rider, style: style.value } })}
              />
            ))}
          </div>

          <div className="stack stack--3">
            <span className="field__label">Livello (opzionale)</span>
            {LEVELS.map((level) => (
              <Choice
                key={level.value}
                selected={bike.rider.level === level.value}
                title={level.title}
                description={level.description}
                onClick={() => setBike({ ...bike, rider: { ...bike.rider, level: level.value } })}
              />
            ))}
          </div>

          <Field label="Peso rider (kg, opzionale)" htmlFor="rider-weight">
            <input
              id="rider-weight"
              className="input"
              type="number"
              inputMode="decimal"
              value={bike.rider.weightKg ?? ''}
              onChange={(e) =>
                setBike({
                  ...bike,
                  rider: {
                    ...bike.rider,
                    weightKg: e.target.value === '' ? undefined : Number(e.target.value),
                  },
                })
              }
            />
          </Field>
        </Card>
      )}

      <div className="row" style={{ gap: 'var(--s-3)' }}>
        {position > 0 && (
          <Button variant="ghost" onClick={() => go(-1)}>
            Indietro
          </Button>
        )}
        <div className="grow" />
        {position < steps.length - 1 ? (
          <Button
            variant="primary"
            onClick={() => go(1)}
            disabled={step === 1 && bike.frontSuspension.totalTravelMm <= 0}
          >
            Continua
          </Button>
        ) : (
          <Button variant="primary" onClick={() => void save()}>
            Salva bici
          </Button>
        )}
      </div>
    </div>
  );
}
