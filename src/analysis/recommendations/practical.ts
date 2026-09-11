import type {
  ClickAdjuster,
  DampingCircuit,
  RecommendationAction,
  SettingChange,
  SuspensionComponent,
  SuspensionConfig,
} from '@/types';

/**
 * The practical half of a recommendation.
 *
 * The engine decides *what* to change; this decides how to state it so the
 * rider can act on it at the trailhead without doing arithmetic or guessing
 * which way the dial turns. It is the difference between advice and a task.
 */

const OF: Record<SuspensionComponent, string> = {
  front: 'della forcella',
  rear: 'del posteriore',
};

const CIRCUIT: Record<DampingCircuit, string> = {
  'low-speed': ' alle basse velocità',
  'high-speed': ' alle alte velocità',
  single: '',
};

/** The adjuster an action targets, so its current value can be read. */
function adjusterFor(
  unit: SuspensionConfig,
  action: RecommendationAction,
): ClickAdjuster | undefined {
  if (action.kind === 'rebound') {
    return action.circuit === 'high-speed' ? unit.highSpeedRebound : unit.rebound;
  }
  if (action.kind === 'compression') {
    return action.circuit === 'high-speed' ? unit.highSpeedCompression : unit.compression;
  }
  return undefined;
}

/**
 * Concrete start and end values.
 *
 * Returns null when the current setting is unknown: inventing a starting point
 * would make the instruction look precise while being wrong, which is worse
 * than saying "add 5 PSI" and letting the rider read their own pump.
 */
export function changeFor(
  action: RecommendationAction,
  unit: SuspensionConfig,
): SettingChange | null {
  switch (action.kind) {
    case 'pressure': {
      const from = unit.pressurePsi;
      if (from === undefined) return null;
      return {
        from,
        to: Math.max(0, from + action.deltaPsi),
        unit: 'PSI',
        label: `Pressione ${OF[action.component]}`,
      };
    }

    case 'rebound':
    case 'compression': {
      const adjuster = adjusterFor(unit, action);
      const from = adjuster?.clicks;
      if (from === undefined) return null;
      const to = Math.max(0, from + action.deltaClicks);
      // Never propose a value past the end of the adjuster's range.
      const capped = adjuster?.totalClicks !== undefined ? Math.min(to, adjuster.totalClicks) : to;
      return {
        from,
        to: capped,
        unit: 'click',
        label: `${action.kind === 'rebound' ? 'Ritorno' : 'Compressione'}${
          CIRCUIT[action.circuit]
        } ${OF[action.component]}`,
      };
    }

    case 'preload': {
      const from = unit.preload?.turns;
      if (from === undefined) return null;
      return {
        from,
        to: Math.max(0, from + action.deltaTurns),
        unit: 'giri',
        label: `Precarico ${OF[action.component]}`,
      };
    }

    case 'spring-rate':
    case 'explain':
      return null;
  }
}

/**
 * How to physically make the change.
 *
 * Written for a rider who has never touched the adjuster. Where a convention
 * is not universal across manufacturers, it points at the marking on the part
 * instead of asserting a direction that might be wrong on their fork.
 */
export function howToFor(action: RecommendationAction): string[] {
  switch (action.kind) {
    case 'pressure':
      return [
        'Serve una pompa da sospensioni, non quella da gomme: quella da bici non tiene queste pressioni e ne perde a ogni stacco.',
        'Avvita la pompa sulla valvola, porta la pressione al valore indicato e stacca. Un piccolo sbuffo allo stacco è normale.',
        action.deltaPsi < 0
          ? 'Per scendere, premi il pulsante di scarico della pompa a piccoli colpi.'
          : 'Pompa poco alla volta e rileggi: le ultime unità salgono in fretta.',
        'Dopo la modifica rimisura il sag, così parti da un dato certo.',
      ];

    case 'rebound':
      return [
        'Il registro del ritorno è quasi sempre rosso: sulla forcella in basso, sull’ammortizzatore accanto al corpo.',
        action.deltaClicks > 0
          ? 'Chiudere significa girare verso il segno + o verso la tartaruga, di solito in senso orario.'
          : 'Aprire significa girare verso il segno − o verso la lepre, di solito in senso antiorario.',
        'Conta i click a voce mentre giri: perderne uno è l’errore più comune.',
        'Se non sai da dove parti, chiudi tutto contando i click, poi riapri fino al valore indicato.',
      ];

    case 'compression':
      return [
        'Il registro della compressione è in cima allo stelo della forcella o sul corpo dell’ammortizzatore.',
        action.circuit === 'high-speed'
          ? 'Se i registri sono due concentrici, l’incisione sulla manopola dice quale agisce sulle alte velocità: cerca la scritta HSC o il simbolo con due frecce.'
          : action.circuit === 'low-speed'
            ? 'Se i registri sono due concentrici, quello delle basse velocità è marcato LSC o con una freccia singola.'
            : 'La tua sospensione ha un solo registro di compressione: è quello.',
        action.deltaClicks > 0
          ? 'Chiudere significa girare verso il segno +, di solito in senso orario.'
          : 'Aprire significa girare verso il segno −, di solito in senso antiorario.',
        'Conta i click a voce mentre giri.',
      ];

    case 'preload':
      return [
        'L’anello di precarico è alla base della molla, a volte con una ghiera di bloccaggio da allentare prima.',
        action.deltaTurns > 0
          ? 'Avvita per aumentare il precarico, contando i giri completi.'
          : 'Svita per ridurre il precarico, contando i giri completi.',
        'La molla deve restare in appoggio: se puoi ruotarla a mano, il precarico è troppo scarso.',
        'Dopo la modifica rimisura il sag.',
      ];

    case 'spring-rate':
      return [
        'Non è una regolazione: serve sostituire la molla.',
        'La durezza è stampata sulla molla stessa, in lb/in insieme alla corsa.',
        'Portati dietro il dato quando la ordini: la corsa deve corrispondere a quella del tuo ammortizzatore.',
      ];

    case 'explain':
      return [];
  }
}

/**
 * What should feel different afterwards.
 *
 * Without this the rider has no way to judge whether the change helped, and a
 * setup session becomes guesswork.
 */
export function expectFor(action: RecommendationAction): string {
  switch (action.kind) {
    case 'pressure':
      return action.deltaPsi > 0
        ? 'La bici dovrebbe restare più alta, sostenersi meglio in curva e arrivare meno spesso a fondo corsa.'
        : 'La sospensione dovrebbe copiare meglio le asperità piccole e sfruttare più corsa, con più aderenza.';

    case 'preload':
      return action.deltaTurns > 0
        ? 'La bici dovrebbe affondare meno sotto il tuo peso e mantenere meglio la geometria.'
        : 'La sospensione dovrebbe muoversi più liberamente all’inizio della corsa.';

    case 'rebound':
      return action.deltaClicks > 0
        ? 'La bici dovrebbe risultare più calma dopo i colpi, meno saltellante e più prevedibile.'
        : 'La sospensione dovrebbe riprendersi più in fretta tra un colpo e l’altro e restare meno seduta.';

    case 'compression':
      return action.deltaClicks > 0
        ? 'Più sostegno in appoggio, in frenata e nelle compressioni lunghe.'
        : 'Meno durezza sui colpi secchi, con più aderenza sul terreno rotto.';

    case 'spring-rate':
      return action.direction === 'stiffer'
        ? 'Con una molla più dura la bici userà meno corsa e resterà più alta.'
        : 'Con una molla più morbida la sospensione lavorerà più a fondo e copierà meglio.';

    case 'explain':
      return 'Non c’è una modifica da fare su questa sospensione: il dato serve a capire come sta lavorando.';
  }
}
