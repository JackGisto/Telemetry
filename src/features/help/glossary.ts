/**
 * Plain-language explanations for every term the app shows.
 *
 * The rule for writing these: assume the reader has never set up a suspension
 * and does not know what a shaft is. Each entry says what the thing is, how to
 * read the number, and what it means for the rider. No formulas, no jargon that
 * is not itself explained here.
 *
 * All help copy lives in this one file so it can be reviewed as a set, the same
 * way the analysis wording does in `features/analysis/presentation.ts`.
 */
export interface GlossaryTerm {
  /** Heading of the explanation panel. */
  term: string;
  /** One or more paragraphs of explanation. */
  body: string[];
  /** Optional practical takeaway, highlighted at the end. */
  tip?: string;
}

export type GlossaryId =
  | 'travel'
  | 'travel-max'
  | 'travel-mean'
  | 'travel-p95'
  | 'ride-height'
  | 'travel-distribution'
  | 'bottom-out'
  | 'time-near-bottom'
  | 'time-near-top'
  | 'top-out'
  | 'rebound'
  | 'compression'
  | 'recovery-time'
  | 'shaft-velocity'
  | 'velocity-distribution'
  | 'speed-split'
  | 'low-speed'
  | 'high-speed'
  | 'packing'
  | 'compression-events'
  | 'balance'
  | 'score'
  | 'severity'
  | 'confidence'
  | 'riding-style'
  | 'spring-type'
  | 'pressure'
  | 'preload'
  | 'spring-rate'
  | 'leverage-ratio'
  | 'stroke'
  | 'calibration'
  | 'clicks'
  | 'percentile';

export const GLOSSARY: Record<GlossaryId, GlossaryTerm> = {
  travel: {
    term: 'Corsa (travel)',
    body: [
      'La corsa è quanto la sospensione può comprimersi, dall’estensione completa fino a fine corsa. Si misura in millimetri.',
      'L’app esprime quasi tutto in percentuale di corsa invece che in millimetri: così una forcella da 160 mm e un ammortizzatore da 60 mm si possono confrontare direttamente.',
    ],
    tip: 'Il valore corretto è quello dichiarato dal produttore della tua forcella o del tuo ammortizzatore.',
  },

  'travel-max': {
    term: 'Corsa massima usata',
    body: [
      'Il punto più profondo raggiunto dalla sospensione durante la run, in percentuale della corsa totale.',
      'Se resta bassa, la sospensione è troppo rigida e stai sprecando corsa che hai pagato. Se arriva sempre al 100%, è troppo morbida e finisci lo spazio disponibile sui colpi forti.',
    ],
    tip: 'L’obiettivo non è il 100%: è arrivare vicino al fondo corsa solo sui colpi più forti della discesa.',
  },

  'travel-mean': {
    term: 'Corsa media usata',
    body: [
      'La posizione media della sospensione lungo tutta la run.',
      'È influenzata sia da come la bici sta appoggiata sia dai colpi presi. Un valore alto significa che la sospensione lavora affondata per gran parte del tempo.',
    ],
  },

  'travel-p95': {
    term: 'P95 della corsa',
    body: [
      'Il valore sotto il quale la sospensione resta per il 95% del tempo.',
      'Serve a togliere di mezzo i pochi colpi estremi: dice quanta corsa usi “normalmente”, senza farsi ingannare da un singolo atterraggio.',
    ],
  },

  'ride-height': {
    term: 'Altezza di marcia',
    body: [
      'Dove la sospensione si assesta mentre guidi, cioè quanto è affondata quando non sta prendendo un colpo.',
      'È l’equivalente del sag, ma misurato con la bici in movimento invece che da fermo. L’app lo calcola guardando solo i momenti in cui lo stelo è praticamente fermo, così qualche colpo forte non falsa il risultato come farebbe una media.',
    ],
    tip: 'Se è troppo alto la bici si siede, perde geometria e diventa pigra in curva. Se è troppo basso la bici resta rigida e non copia il terreno.',
  },

  'travel-distribution': {
    term: 'Distribuzione del travel',
    body: [
      'Mostra quanto tempo la sospensione passa in ogni zona della corsa: quanto vicino all’estensione, quanto a metà, quanto verso il fondo.',
      'È il grafico che dice di più sul comportamento della sospensione. Una distribuzione spostata tutta a sinistra significa che la sospensione non lavora; una spostata a destra significa che sta affondata.',
    ],
  },

  'bottom-out': {
    term: 'Fondo corsa (bottom-out)',
    body: [
      'La sospensione arriva a fine corsa e non può più comprimersi. Spesso si sente come un colpo secco.',
      'L’app conta un fondo corsa per ogni colpo, non per ogni istante: se la sospensione resta appoggiata sul finale per mezzo secondo, viene contato una volta sola.',
    ],
    tip: 'Qualche fondo corsa in una discesa impegnativa è normale. Molti fondo corsa significano che serve più sostegno.',
  },

  'time-near-bottom': {
    term: 'Tempo a fondo corsa',
    body: [
      'La percentuale di tempo che la sospensione passa nell’ultima parte della corsa.',
      'È diverso dal contare i fondo corsa: qui il problema non sono i singoli colpi, ma il fatto che la sospensione ci viva vicino. Se questo valore è alto, hai poco margine per assorbire l’imprevisto.',
    ],
  },

  'time-near-top': {
    term: 'Tempo in alto',
    body: [
      'La percentuale di tempo che la sospensione passa nella prima parte della corsa, vicino all’estensione completa.',
      'Un valore molto alto indica una sospensione che non si muove abbastanza: sta ignorando le asperità piccole invece di assorbirle.',
    ],
  },

  'top-out': {
    term: 'Top-out',
    body: [
      'La sospensione torna a estensione completa in modo brusco, arrivando a battuta nella direzione opposta al fondo corsa.',
      'Capita quando il ritorno è troppo veloce o quando la sospensione è troppo rigida per il terreno.',
    ],
  },

  rebound: {
    term: 'Ritorno (rebound)',
    body: [
      'Il ritorno controlla la velocità con cui la sospensione si riestende dopo essere stata compressa.',
      'Si regola con una manopola, di solito rossa, che si conta in click. Chiudere il rebound rallenta il ritorno, aprirlo lo velocizza.',
    ],
    tip: 'Troppo veloce e la bici rimbalza e diventa nervosa. Troppo lento e la sospensione resta schiacciata sui tratti rotti.',
  },

  compression: {
    term: 'Compressione',
    body: [
      'La compressione controlla quanta resistenza la sospensione oppone mentre si comprime.',
      'Si regola in click. Chiuderla dà più sostegno e tiene la bici più alta; aprirla la rende più scorrevole e più sensibile.',
    ],
  },

  'recovery-time': {
    term: 'Tempo di ritorno',
    body: [
      'Quanti secondi impiega la sospensione a risalire dopo un colpo, misurati dal punto più profondo fino a quando ha recuperato la maggior parte della corsa usata.',
      'È il modo in cui l’app giudica il rebound. È più affidabile della velocità di picco perché non dipende da quanto era forte il colpo.',
    ],
    tip: 'Se questo tempo è fuori dall’intervallo consigliato, il consiglio sarà di aprire o chiudere il rebound di qualche click.',
  },

  'shaft-velocity': {
    term: 'Velocità di stelo',
    body: [
      'La velocità con cui la sospensione si sta muovendo in un dato istante, in millimetri al secondo.',
      'Positiva quando si comprime, negativa quando si riestende. Non è la velocità della bici: è la velocità del movimento della sospensione.',
    ],
  },

  'velocity-distribution': {
    term: 'Distribuzione delle velocità',
    body: [
      'Mostra quanto tempo la sospensione passa a ogni velocità di movimento, dal ritorno (a sinistra dello zero) alla compressione (a destra).',
      'È lo strumento standard per leggere lo smorzamento. Due assetti con la stessa velocità media possono comportarsi in modo opposto: è la forma di questa distribuzione a dirlo.',
    ],
    tip: 'Le barre in tinta scura sono le alte velocità, cioè i colpi secchi. Si regolano con manopole diverse rispetto al resto.',
  },

  'speed-split': {
    term: 'Basse e alte velocità',
    body: [
      'Il movimento della sospensione si divide in due mondi. Alle basse velocità la sospensione si muove piano: sono le pieghe, le frenate, le ondulazioni del terreno. Alle alte velocità si muove di scatto: sono radici, pietre e buche.',
      'Sono governate da parti diverse dell’ammortizzatore, e su molte sospensioni da manopole diverse. Per questo l’app le valuta separatamente invece di dare un unico giudizio sulla compressione.',
    ],
    tip: 'Se la tua sospensione ha una sola manopola di compressione, l’app non ti parlerà mai di circuiti separati.',
  },

  'low-speed': {
    term: 'Basse velocità (LS)',
    body: [
      'Il movimento lento della sospensione: quello prodotto da te sui pedali, dalle frenate e dalle curve.',
      'Governa il sostegno e l’altezza a cui la bici viaggia. Se manca, la bici si siede e diventa pigra.',
    ],
  },

  'high-speed': {
    term: 'Alte velocità (HS)',
    body: [
      'Il movimento rapido della sospensione, prodotto dai colpi secchi del terreno: radici, pietre, buche.',
      'Governa quanto la bici risulta dura sui tratti rotti e quanta resistenza c’è sul finale di corsa.',
    ],
  },

  packing: {
    term: 'Impaccamento',
    body: [
      'Succede quando i colpi arrivano più in fretta di quanto la sospensione riesca a riestendersi.',
      'La sospensione non fa in tempo a tornare su e a ogni colpo parte da un po’ più in basso, finché si ritrova seduta a fondo corsa. Sui tratti rotti e veloci la bici diventa dura e imprevedibile.',
    ],
    tip: 'Di solito si corregge aprendo il ritorno, non ammorbidendo la molla.',
  },

  'compression-events': {
    term: 'Compressioni rilevate',
    body: [
      'Quante volte, durante la run, la sospensione ha preso un colpo abbastanza importante da essere considerato un evento.',
      'Serve a capire se la run è sufficiente per dare un giudizio. Poche compressioni significano un tracciato troppo liscio o una run troppo corta.',
    ],
  },

  balance: {
    term: 'Bilanciamento',
    body: [
      'Confronta quanto lavora l’anteriore rispetto al posteriore.',
      'Se le due sospensioni usano quote di corsa molto diverse, la bici non è in equilibrio: una delle due sta lavorando per entrambe e la posizione di guida cambia in modo poco prevedibile.',
    ],
    tip: 'Ha senso solo su una bici full suspension. Su una hardtail l’app non lo mostra affatto.',
  },

  score: {
    term: 'Score',
    body: [
      'Un punteggio da 0 a 100 che riassume quanto l’assetto è vicino a quello che serve per lo stile di guida che hai scelto.',
      'Parte da 100 e scende per ogni problema trovato, in proporzione a quanto è grave e a quanto l’app ne è sicura. Non è un voto sulla tua guida.',
    ],
    tip: 'Serve soprattutto a confrontare due run tra loro: è il modo più rapido per capire se una modifica ha funzionato.',
  },

  severity: {
    term: 'Gravità',
    body: [
      'Quanto il comportamento rilevato si discosta da quello atteso: lieve, media o importante.',
      'Determina l’ordine in cui i consigli vengono mostrati. I problemi più gravi vengono per primi.',
    ],
  },

  confidence: {
    term: 'Confidenza',
    body: [
      'Quanto l’app è sicura di quello che ha rilevato.',
      'Scende quando la run è corta o quando ci sono poche compressioni, perché con pochi dati un singolo tratto anomalo può falsare tutto.',
    ],
    tip: 'Per un’analisi affidabile registra una discesa intera su un tratto rappresentativo di come guidi di solito.',
  },

  'riding-style': {
    term: 'Stile di guida',
    body: [
      'Dice all’app cosa consideri un buon assetto, perché non esiste un assetto giusto in assoluto.',
      'Con Comfort la sospensione deve assorbire molto e arrivare raramente a fondo corsa. Con Aggressivo serve più sostegno e toccare il fondo corsa sui colpi forti è normale. Bilanciato sta in mezzo.',
    ],
    tip: 'Cambiando stile la stessa identica run può ricevere consigli diversi. Scegli quello che corrisponde a come guidi davvero.',
  },

  'spring-type': {
    term: 'Aria o molla',
    body: [
      'Una sospensione ad aria usa aria compressa come molla e si regola cambiando la pressione. Una sospensione a molla usa una molla d’acciaio e si regola cambiando molla o agendo sul precarico.',
      'L’app ha bisogno di saperlo perché i consigli sono diversi: a una sospensione a molla non ha senso suggerire di aggiungere PSI.',
    ],
  },

  pressure: {
    term: 'Pressione (PSI)',
    body: [
      'La pressione dell’aria dentro la sospensione, misurata in PSI. È la regolazione principale di quanto è dura o morbida.',
      'Si cambia con una pompa specifica per sospensioni. Più pressione significa sospensione più rigida e meno corsa usata.',
    ],
    tip: 'Indica la pressione che hai adesso: serve all’app per dirti di quanto cambiarla, non solo in che direzione.',
  },

  preload: {
    term: 'Precarico',
    body: [
      'Su una sospensione a molla, il precarico comprime leggermente la molla già da ferma.',
      'Alza la bici e riduce quanto affonda sotto il tuo peso, ma non cambia la durezza della molla stessa.',
    ],
    tip: 'Serve per piccoli aggiustamenti. Se ne serve tanto, la molla è probabilmente quella sbagliata.',
  },

  'spring-rate': {
    term: 'Durezza della molla',
    body: [
      'Quanto è dura la molla d’acciaio, espressa in libbre per pollice (lb/in).',
      'È scritta sulla molla stessa. Cambiarla è l’equivalente, su una sospensione a molla, di cambiare la pressione su una ad aria.',
    ],
  },

  'leverage-ratio': {
    term: 'Rapporto di leva',
    body: [
      'Su una full suspension, la ruota posteriore si muove più dell’ammortizzatore. Il rapporto di leva dice quante volte di più.',
      'È un dato opzionale. Se non lo conosci, lascialo vuoto: l’analisi del posteriore funziona comunque, ragionando sulla corsa dell’ammortizzatore.',
    ],
  },

  stroke: {
    term: 'Corsa dell’ammortizzatore',
    body: [
      'Quanto si comprime l’ammortizzatore posteriore, non quanto si muove la ruota.',
      'Sono due numeri diversi: un ammortizzatore da 60 mm può far muovere la ruota di 150 mm. Il dato da inserire è quello dell’ammortizzatore, di solito stampato sul corpo.',
    ],
  },

  calibration: {
    term: 'Calibrazione',
    body: [
      'Insegna al dispositivo dove si trova lo zero, cioè la posizione della sospensione completamente estesa.',
      'Senza calibrazione i sensori danno numeri grezzi che non corrispondono a millimetri reali, e l’analisi non avrebbe senso.',
    ],
    tip: 'Va rifatta se sposti i sensori o cambi qualcosa nel montaggio.',
  },

  clicks: {
    term: 'Click',
    body: [
      'Le regolazioni di ritorno e compressione si muovono a scatti, e ogni scatto è un click.',
      'Il riferimento si conta di solito partendo dalla manopola tutta chiusa, girando poi in senso di apertura.',
    ],
    tip: 'Indicare i click attuali permette all’app di dirti dove arrivare, non solo in che direzione girare.',
  },

  percentile: {
    term: 'P95',
    body: [
      'Il valore sotto il quale sta il 95% delle misure.',
      'Si usa al posto del massimo per non farsi condizionare da un singolo picco isolato, che può essere anche solo un urto anomalo.',
    ],
  },
};
