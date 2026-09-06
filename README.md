# Telemetria MTB — Landing Page + PWA

Software lato utente per un sistema di telemetria delle sospensioni MTB: un sito
pubblico e una web app installabile che acquisisce le run dal dispositivo, le
analizza e dice al rider **cosa cambiare**.

Il progetto è eseguibile e provabile **senza hardware**: un dispositivo simulato
copre connessione, calibrazione, registrazione, trasferimento a chunk, caduta di
connessione e ripresa.

```bash
npm install
npm run dev      # http://localhost:5173  → landing page; /app → applicazione
npm test         # 95 test su motore, dati, trasporto, export e flussi UI
npm run build    # build di produzione
```

## Percorso completo senza hardware

Landing page → `Apri l'app` → onboarding → dispositivo simulato → wizard bici →
calibrazione → `START RUN` → `SCARICA DATI` → analisi → diagnosi → consiglio
concreto → storico → confronto tra due run.

---

## 1. Architettura

```
UI (React)                 pages/ features/ design-system/
      ↓
Application Layer          app/store/  (Zustand: settings, bike, device, history)
      ↓
Analysis Engine            analysis/   (puro, sincrono, senza React)
      ↓
Data Layer                 data/ storage/ (normalizzazione, IndexedDB)
      ↓
Transport                  ble/        (interfaccia + mock + Web Bluetooth)
```

La regola strutturale è una sola: **ogni livello dipende solo da quello
sottostante, mai al contrario**. In pratica:

- `analysis/` non importa nulla da `react`, `zustand`, `storage` o `ble`. È una
  funzione pura `Session -> AnalysisReport`. È il livello che verrà riusato tale
  e quale in una futura app nativa.
- `ble/` non conosce l'analisi né la UI. Espone `TelemetryTransport` e niente
  altro; nessun componente importa una implementazione concreta.
- `storage/` è l'unico modulo che tocca IndexedDB.
- I componenti non contengono soglie, pesi o formule: stanno in
  `analysis/tunables.ts`.

### Scelte tecniche e motivazioni

| Scelta | Perché |
| --- | --- |
| **React + TypeScript + Vite** | I tipi sono il contratto tra i livelli: `BikeConfig` e `AnalysisReport` sono la specifica eseguibile del prodotto. Vite dà build rapide e code splitting senza configurazione. |
| **Zustand** | Lo stato applicativo è poco e piatto (impostazioni, bici, dispositivo, storico). Un store globale leggero evita il boilerplate di Redux e, soprattutto, tiene la logica fuori dai componenti. |
| **IndexedDB via `idb`** | Le run sono migliaia di campioni: `localStorage` non basta. `idb` è un wrapper sottile e tipizzato, non un ORM. |
| **Recharts** | Grafici dichiarativi e responsive. Caricato in *lazy chunk*: chi non apre la modalità Esperto non lo scarica. |
| **Nessun backend** | V1 è locale. Nessun account, nessun server, nessuna telemetria in uscita. |
| **CSS con custom properties** | Un design system leggibile e senza runtime, invece di una libreria di componenti da riadattare. |

Dipendenze di runtime totali: React, React Router, Zustand, idb, Recharts.
Non ne sono state aggiunte altre.

---

## 2. Design System

`src/design-system/` — token in `tokens.css`, componenti in `components/`.

Palette scura ad alto contrasto, pensata per uno schermo in pieno sole: superfici
neutre fredde, **un solo** accento (teal), colori di stato usati con parsimonia.
Target minimo di tocco 48 px, tipografia grande, gerarchia netta.

Copre: colori, tipografia, spaziature, raggi, ombre, motion, card, button (incluso
il pulsante `hero` della schermata Run), badge, status indicator, campi, segmented
control, choice card, progress, modal con focus trap, toast, error/empty/loading
state, skeleton e grafici.

**Accessibilità:** nessuno stato è comunicato dal solo colore. Ogni
`StatusIndicator` accosta al colore un glifo (`✓ ! ✕`) e un'etichetta testuale;
i grafici hanno `aria-label` descrittivi; il focus è sempre visibile.

---

## 3. Landing Page

`src/pages/LandingPage.tsx`. Hero (*Misura. Analizza. Regola.*), il problema,
i cinque passi, l'analisi, il risultato simulato, le due modalità, la
compatibilità e il download. Completamente responsive.

I link agli store sono **placeholder configurabili** (`VITE_APP_STORE_URL`,
`VITE_PLAY_STORE_URL`): finché non esistono, i pulsanti restano disabilitati e
dicono "in arrivo". Nessun link finto. L'installazione PWA usa
`beforeinstallprompt` e compare solo dove il browser la supporta davvero.

---

## 4. Motore di analisi

Deterministico e rule-based. Nessun machine learning, nessun modello predittivo,
nessun servizio cloud. Lo stesso input dà sempre lo stesso output — c'è un test
che lo verifica.

**Pipeline:** `metriche → diagnosi → scoring → raccomandazioni`

1. **Metriche** (`analysis/metrics/`) — corsa massima/media/p95, istogramma,
   bottom-out (con debounce: un colpo = un evento, non un evento per campione),
   tempo a fondo corsa e in alto, top-out, velocità di compressione e ritorno, e
   il **tempo di recupero** dopo un picco, che è l'indicatore su cui lavorano le
   regole del rebound.
2. **Diagnosi** (`analysis/diagnostics/`) — dieci regole; ognuna produce
   `id, component, severity, confidence, metric, threshold, description`. La
   confidenza scende su run corte o con pochi eventi.
3. **Scoring** (`analysis/scoring/`) — ogni diagnosi sottrae
   `peso(severità) × confidenza` da 100, per componente e complessivo.
4. **Raccomandazioni** (`analysis/recommendations/`) — la parte che conta.

**Regola inderogabile:** non viene mai suggerita una regolazione che la
sospensione configurata non possiede.

```
aria + pressione nota  → modifica in PSI
molla + precarico      → modifica di precarico
molla senza precarico  → valuta una molla diversa
nessuna regolazione    → spiega il problema, non inventa una modifica
```

Lo stesso vale per il rebound: senza adjuster, l'app spiega e si ferma. È
verificato da test dedicati.

**Normalizzazione** (`data/normalize.ts`): la conversione da conteggi ADC a
millimetri è isolata qui. Il motore riceve solo millimetri, quindi cambiare
sensore o encoding non lo tocca.

**Tuning:** soglie, pesi, severità e profili di stile stanno tutti in
`analysis/tunables.ts` e possono essere sovrascritti per singola analisi.

---

## 5. Trasporto e dispositivo simulato

`TelemetryTransport` è l'unico contratto verso il dispositivo. Ne esistono due
implementazioni:

- **`MockTelemetryTransport`** — simula connessione, batteria, memoria,
  calibrazione (anche fallita), start/stop, il **pulsante fisico** del
  dispositivo, il trasferimento a chunk, la caduta di connessione e la **ripresa
  dall'offset raggiunto**.
- **`BleTelemetryTransport`** — Web Bluetooth, strutturalmente completo.

Web Bluetooth **non** è disponibile ovunque: manca su Safari iOS e Firefox, e
richiede un contesto sicuro. L'app lo rileva e lo dice esplicitamente, invece di
offrire un pulsante che fallirà.

Il trasferimento verifica l'integrità con un CRC32 nell'header del payload.
Una run scaricata viene rimossa dal dispositivo solo **dopo** essere stata
salvata localmente.

### Da definire con il firmware

Il protocollo BLE definitivo non esiste ancora. Tutto ciò che dipende da esso è
isolato e marcato `FIRMWARE TBD`:

| File | Cosa resta da definire |
| --- | --- |
| `ble/protocol/gatt.ts` | UUID di servizio e caratteristiche, opcode, MTU, prefisso del nome. Sono **segnaposto**, non derivati da alcuna specifica esistente. |
| `ble/protocol/codec.ts` | Formato del payload di sessione (oggi JSON + CRC32). |
| `ble/web/BleTelemetryTransport.ts` | Layout dei pacchetti di stato e di dati; `calibrate()` e `listSessions()` sollevano `not-supported` finché il firmware non li definisce. |
| `data/normalize.ts` | Risoluzione e fondo scala dell'ADC. |

Quando il protocollo sarà congelato si cambiano queste costanti: nessun altro
livello va toccato.

---

## 6. Dataset di test

`src/data/fixtures/` contiene sei run di riferimento: `normal_run`,
`stiff_fork`, `soft_shock`, `fast_rebound`, `slow_rebound`,
`front_rear_imbalance`.

Ogni file dichiara le diagnosi che il motore **deve** produrre, ed è asserito da
`analysis/engine.test.ts`. I campioni non sono salvati inline: il generatore
(`data/synth.ts`) è deterministico, quindi il seed riproduce la stessa traccia
ovunque e il repository resta leggero. Per usare tracce reali basta aggiungere un
array `samples` a un dataset.

---

## 7. Struttura

```
src/
  app/            shell, routing, store Zustand, hydrate
  pages/          landing page pubblica
  design-system/  token CSS + componenti riusabili
  features/       onboarding, device, bike, calibration, run,
                  analysis, history, comparison, settings, export
  analysis/       metrics, diagnostics, scoring, recommendations, tunables
  ble/            transport (contratto), protocol, mock, web
  data/           normalizzazione, generatore, dataset
  storage/        IndexedDB
  types/          modelli condivisi
```

---

## 8. Test

95 test, `npm test`.

| Area | Copertura |
| --- | --- |
| Motore | conversione posizione, percentuali, istogramma, bottom-out, rebound, compressione, scoring, diagnosi, determinismo, hardtail, run non analizzabili |
| Raccomandazioni | aria/molla/precarico/nessuna regolazione, direzione e limiti delle modifiche, deduplica |
| Data layer | salvataggio, lettura, aggiornamento note, cancellazione a cascata, impostazioni, wipe |
| Trasporto | connect, disconnect, calibrazione (ok e fallita), memoria piena, batteria scarica, pulsante fisico, trasferimento a chunk, **ripresa dopo caduta**, CRC |
| Export | round-trip JSON, CSV campioni, CSV riepilogo, quoting, hardtail |
| UI | landing, onboarding, connessione, wizard bici, run, download, analisi, consiglio, storico, confronto, percorso hardtail |

---

## 9. Cosa non è incluso

Per scelta, come da specifica: nessuna progettazione meccanica o elettronica,
nessun firmware, nessun GPS o accelerometro, nessun machine learning, nessuna
analisi cloud, nessuna integrazione con Strava o Garmin.

I documenti di riferimento citati nel brief (progetto generale, specifiche web
app, motore, dati, UX writing, roadmap, datasheet) **non erano presenti nel
repository**: dove una specifica hardware mancava non è stata inventata, ma
sostituita da un'astrazione configurabile marcata `FIRMWARE TBD`, come elencato
sopra.
