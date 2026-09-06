import type { TransportErrorCode } from './types';

/** Rider-facing wording for every transport failure (spec section 27). */
export const TRANSPORT_MESSAGES: Record<TransportErrorCode, { title: string; body: string }> = {
  'device-not-found': {
    title: 'Nessun dispositivo trovato',
    body: 'Accendi il dispositivo e avvicinalo allo smartphone, poi riprova.',
  },
  'bluetooth-unavailable': {
    title: 'Bluetooth non disponibile',
    body: 'Questo browser non permette la connessione Bluetooth. Usa Chrome su Android o desktop, oppure prova il dispositivo simulato.',
  },
  'bluetooth-disabled': {
    title: 'Bluetooth disattivato',
    body: 'Attiva il Bluetooth per collegare il dispositivo.',
  },
  'permission-denied': {
    title: 'Permesso negato',
    body: 'Serve il permesso di accedere al Bluetooth per collegare il dispositivo.',
  },
  'connection-lost': {
    title: 'Connessione interrotta',
    body: 'Il dispositivo continua a registrare da solo. Riavvicinati e riprova: i dati non vengono persi.',
  },
  'device-busy': {
    title: 'Dispositivo occupato',
    body: 'Il dispositivo sta gia eseguendo un’operazione. Attendi qualche secondo.',
  },
  'storage-full': {
    title: 'Memoria piena',
    body: 'La memoria del dispositivo e piena. Scarica le run precedenti per liberare spazio.',
  },
  'battery-low': {
    title: 'Batteria quasi scarica',
    body: 'La batteria del dispositivo e quasi scarica. Ricaricalo prima della prossima uscita.',
  },
  'calibration-failed': {
    title: 'Calibrazione non riuscita',
    body: 'Movimento rilevato. Tieni ferma la bici e riprova.',
  },
  'transfer-failed': {
    title: 'Trasferimento interrotto',
    body: 'Connessione interrotta durante il download. Il trasferimento riprende da dove si era fermato.',
  },
  'corrupt-data': {
    title: 'Dati non leggibili',
    body: 'Non e stato possibile leggere questa sessione. Prova a scaricarla di nuovo.',
  },
  'not-supported': {
    title: 'Funzione non disponibile',
    body: 'Questa funzione non e supportata dal dispositivo o dal browser in uso.',
  },
};

export function errorMessage(code: TransportErrorCode) {
  return TRANSPORT_MESSAGES[code] ?? TRANSPORT_MESSAGES['not-supported'];
}
