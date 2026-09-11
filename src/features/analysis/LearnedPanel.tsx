import type { Observation, SetupLearning } from '@/analysis';
import { SETTING_METRIC } from '@/analysis';
import { Card } from '@/design-system';

/**
 * What the rider's own runs taught the engine.
 *
 * Shown because a number the app cannot justify is a number the rider will not
 * trust. "Adding 7 PSI moved travel used by 7 points on your bike" is checkable
 * against their own memory of the ride, which is what makes the next suggestion
 * believable.
 */

const SETTING_LABEL: Record<Observation['setting'], string> = {
  pressure: 'pressione',
  rebound: 'ritorno',
  compression: 'compressione',
};

const METRIC_LABEL: Record<keyof typeof SETTING_METRIC | string, string> = {
  maxTravelPct: 'la corsa usata',
  recoveryTimeSec: 'il tempo di ritorno',
  rideHeightPct: 'l’altezza di marcia',
  bottomOutCount: 'i fondo corsa',
};

const UNIT: Record<Observation['setting'], string> = {
  pressure: 'PSI',
  rebound: 'click',
  compression: 'click',
};

function metricAmount(observation: Observation): string {
  const value = Math.abs(observation.metricDelta);
  if (observation.metric === 'recoveryTimeSec') return `${value.toFixed(2)} s`;
  if (observation.metric === 'bottomOutCount') return `${Math.round(value)}`;
  return `${value.toFixed(1)} punti`;
}

export function LearnedPanel({ learning }: { learning: SetupLearning }) {
  // Nothing to show until the rider has two runs differing by one setting.
  if (learning.observations.length === 0) return null;

  // Most recent first: the last change is the one they remember.
  const recent = [...learning.observations].reverse().slice(0, 3);

  return (
    <Card className="stack stack--3">
      <div className="stack stack--1">
        <span className="ds-label">Cosa ha imparato dalle tue run</span>
        <p className="text-sm muted">
          L’app misura come la tua bici risponde alle modifiche e usa quei numeri, non una media
          valida per tutti.
        </p>
      </div>

      <div className="learned stack stack--3">
        {recent.map((observation) => {
          const direction = observation.settingDelta > 0 ? 'aggiunto' : 'togliere';
          const verb = observation.setting === 'pressure' ? direction : 'cambiato';
          const moved = observation.metricDelta > 0 ? 'aumentato' : 'ridotto';

          return (
            <div
              key={`${observation.fromSessionId}-${observation.toSessionId}-${observation.setting}`}
              className="learned__row"
            >
              <span className="muted">
                {observation.component === 'front' ? 'Forcella' : 'Posteriore'}:{' '}
                {verb === 'cambiato' ? 'cambiato' : verb}{' '}
                <strong className="ds-mono">
                  {Math.abs(observation.settingDelta)} {UNIT[observation.setting]}
                </strong>{' '}
                di {SETTING_LABEL[observation.setting]}
              </span>
              <span className="ds-mono" style={{ whiteSpace: 'nowrap' }}>
                {METRIC_LABEL[observation.metric]} ha {moved} di {metricAmount(observation)}
              </span>
            </div>
          );
        })}
      </div>

      {learning.sensitivities.length > 0 && (
        <p className="text-xs faint">
          Basato su {learning.observations.length}{' '}
          {learning.observations.length === 1 ? 'confronto' : 'confronti'} fra run in cui era
          cambiata una sola impostazione: è l’unico modo per sapere a cosa attribuire il
          cambiamento.
        </p>
      )}
    </Card>
  );
}
