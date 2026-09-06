import type { ClickAdjuster, SuspensionConfig, SuspensionSpringType } from '@/types';
import { Choice, Field, Segmented } from '@/design-system';

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
    key: 'rebound' | 'compression',
    label: string,
    current: ClickAdjuster,
  ) => (
    <div className="stack stack--3">
      <div className="switch-row">
        <span className="field__label" style={{ margin: 0 }}>
          {label}
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
            <Field label="Click attuali" htmlFor={`${idPrefix}-${key}-clicks`}>
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
      <Field label={travelLabel} hint="In millimetri." htmlFor={`${idPrefix}-travel`}>
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
        <span className="field__label">Tipo di molla</span>
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
        <Field label="Pressione (PSI)" htmlFor={`${idPrefix}-psi`}>
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
          <Field label="Molla (lb/in)" hint="Opzionale." htmlFor={`${idPrefix}-rate`}>
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
            <span className="field__label">Precarico</span>
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

      {adjuster('rebound', 'Ritorno (rebound)', value.rebound)}
      {adjuster('compression', 'Compressione', value.compression)}
    </div>
  );
}
