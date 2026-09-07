import type { ClickAdjuster, SuspensionConfig, SuspensionSpringType } from '@/types';
import { Choice, Field, Segmented } from '@/design-system';
import { TermInfo } from '@/features/help/TermInfo';
import type { GlossaryId } from '@/features/help/glossary';

/**
 * Suspension form, shared by fork and shock.
 *
 * Adjusters the rider marks as absent are not merely hidden: `available: false`
 * reaches the recommendation engine, which then refuses to suggest that knob.
 */
export function SuspensionForm({
  idPrefix,
  value,
  onChange,
  travelLabel,
}: {
  idPrefix: string;
  value: SuspensionConfig;
  onChange: (next: SuspensionConfig) => void;
  travelLabel: string;
}) {
  const patch = (next: Partial<SuspensionConfig>) => onChange({ ...value, ...next });

  const adjuster = (
    key: 'rebound' | 'compression' | 'highSpeedRebound' | 'highSpeedCompression',
    label: string,
    current: ClickAdjuster,
    term: GlossaryId,
  ) => (
    <div className="stack stack--3">
      <div className="switch-row">
        <span className="field__label info-label" style={{ margin: 0 }}>
          <span>{label}</span>
          <TermInfo id={term} />
        </span>
        <Segmented
          ariaLabel={`${label} disponibile`}
          value={current.available ? 'yes' : 'no'}
          options={[
            { value: 'yes', label: 'Presente' },
            { value: 'no', label: 'Assente' },
          ]}
          onChange={(v) => patch({ [key]: { ...current, available: v === 'yes' } } as Partial<SuspensionConfig>)}
        />
      </div>
      {current.available && (
        <div className="row" style={{ gap: 'var(--s-3)' }}>
          <div className="grow">
            <Field
              label="Click attuali"
              htmlFor={`${idPrefix}-${key}-clicks`}
              info={<TermInfo id="clicks" />}
            >
              <input
                id={`${idPrefix}-${key}-clicks`}
                className="input"
                type="number"
                inputMode="numeric"
                min={0}
                value={current.clicks ?? ''}
                onChange={(e) =>
                  patch({
                    [key]: {
                      ...current,
                      clicks: e.target.value === '' ? undefined : Number(e.target.value),
                    },
                  } as Partial<SuspensionConfig>)
                }
              />
            </Field>
          </div>
          <div className="grow">
            <Field label="Click totali" htmlFor={`${idPrefix}-${key}-total`}>
              <input
                id={`${idPrefix}-${key}-total`}
                className="input"
                type="number"
                inputMode="numeric"
                min={0}
                value={current.totalClicks ?? ''}
                onChange={(e) =>
                  patch({
                    [key]: {
                      ...current,
                      totalClicks: e.target.value === '' ? undefined : Number(e.target.value),
                    },
                  } as Partial<SuspensionConfig>)
                }
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="stack stack--5">
      <Field
        label={travelLabel}
        hint="In millimetri."
        htmlFor={`${idPrefix}-travel`}
        info={<TermInfo id={idPrefix === 'rear' ? 'stroke' : 'travel'} />}
      >
        <input
          id={`${idPrefix}-travel`}
          className="input"
          type="number"
          inputMode="numeric"
          min={1}
          value={value.totalTravelMm || ''}
          onChange={(e) => patch({ totalTravelMm: Number(e.target.value) })}
        />
      </Field>

      <div className="stack stack--2">
        <span className="field__label info-label">
          <span>Tipo di molla</span>
          <TermInfo id="spring-type" />
        </span>
        <Segmented<SuspensionSpringType>
          ariaLabel="Tipo di molla"
          value={value.springType}
          options={[
            { value: 'air', label: 'Aria' },
            { value: 'coil', label: 'Molla' },
          ]}
          onChange={(springType) =>
            patch({
              springType,
              // Switching type clears the field that no longer applies, so the
              // engine never sees a pressure on a coil unit.
              pressurePsi: springType === 'air' ? (value.pressurePsi ?? 0) : undefined,
              springRateLbIn: springType === 'coil' ? (value.springRateLbIn ?? 0) : undefined,
              preload:
                springType === 'coil'
                  ? { available: true, turns: value.preload?.turns ?? 0 }
                  : { available: false },
            })
          }
        />
      </div>

      {value.springType === 'air' ? (
        <Field
          label="Pressione (PSI)"
          htmlFor={`${idPrefix}-psi`}
          info={<TermInfo id="pressure" />}
        >
          <input
            id={`${idPrefix}-psi`}
            className="input"
            type="number"
            inputMode="decimal"
            min={0}
            value={value.pressurePsi ?? ''}
            onChange={(e) =>
              patch({ pressurePsi: e.target.value === '' ? undefined : Number(e.target.value) })
            }
          />
        </Field>
      ) : (
        <>
          <Field
            label="Molla (lb/in)"
            hint="Opzionale."
            htmlFor={`${idPrefix}-rate`}
            info={<TermInfo id="spring-rate" />}
          >
            <input
              id={`${idPrefix}-rate`}
              className="input"
              type="number"
              inputMode="decimal"
              min={0}
              value={value.springRateLbIn ?? ''}
              onChange={(e) =>
                patch({
                  springRateLbIn: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
          </Field>
          <div className="stack stack--2">
            <span className="field__label info-label">
              <span>Precarico</span>
              <TermInfo id="preload" />
            </span>
            <div className="row" style={{ gap: 'var(--s-3)' }}>
              <Choice
                selected={value.preload?.available === true}
                title="Regolabile"
                onClick={() => patch({ preload: { available: true, turns: value.preload?.turns ?? 0 } })}
              />
              <Choice
                selected={value.preload?.available !== true}
                title="Non regolabile"
                onClick={() => patch({ preload: { available: false } })}
              />
            </div>
            {value.preload?.available && (
              <Field label="Giri di precarico" htmlFor={`${idPrefix}-preload`}>
                <input
                  id={`${idPrefix}-preload`}
                  className="input"
                  type="number"
                  inputMode="decimal"
                  step={0.5}
                  value={value.preload.turns ?? ''}
                  onChange={(e) =>
                    patch({
                      preload: {
                        available: true,
                        turns: e.target.value === '' ? undefined : Number(e.target.value),
                      },
                    })
                  }
                />
              </Field>
            )}
          </div>
        </>
      )}

      {adjuster('rebound', 'Ritorno (rebound)', value.rebound, 'rebound')}
      {adjuster('compression', 'Compressione', value.compression, 'compression')}

      {/*
        Split circuits change the advice the app can give: with them it can
        separate support from harshness, without them it says "compressione"
        and stops. Declaring them is optional and off by default.
      */}
      <div className="stack stack--3">
        <hr className="divider" />
        <p className="field__hint" style={{ margin: 0 }}>
          Alcune sospensioni separano la regolazione tra basse e alte velocità. Attivale solo se le
          hai davvero: l’app non consiglierà mai una manopola che non esiste sulla tua sospensione.
        </p>
        {adjuster(
          'highSpeedCompression',
          'Compressione alte velocità (HSC)',
          value.highSpeedCompression ?? { available: false },
          'high-speed',
        )}
        {adjuster(
          'highSpeedRebound',
          'Ritorno alte velocità (HSR)',
          value.highSpeedRebound ?? { available: false },
          'high-speed',
        )}
      </div>
    </div>
  );
}
