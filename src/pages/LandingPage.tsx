import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { STORE_LINKS } from './storeLinks';

/**
 * Public landing page.
 *
 * One job: explain the product in a few seconds and send the rider into the
 * app. Everything on it is a step towards that; there is no company section, no
 * blog, no newsletter.
 */
export function LandingPage() {
  return (
    <div className="lp">
      <Nav />
      <Hero />
      <Problem />
      <HowItWorks />
      <Analysis />
      <Result />
      <Modes />
      <Compatibility />
      <Download />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <nav className="lp-nav">
      <div className="lp__inner lp-nav__row">
        <span className="lp-logo">
          <span className="lp-logo__mark" aria-hidden="true" />
          Telemetria MTB
        </span>
        <div className="lp-nav__links">
          <a className="lp-nav__link" href="#come-funziona">
            Come funziona
          </a>
          <a className="lp-nav__link" href="#analisi">
            L’analisi
          </a>
          <a className="lp-nav__link" href="#modalita">
            Modalità
          </a>
          <a className="lp-nav__link" href="#compatibilita">
            Compatibilità
          </a>
        </div>
        <Link className="btn btn--primary btn--sm" to="/app">
          Apri l’app
        </Link>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <header className="lp-hero">
      <div className="lp__inner">
        <span className="lp-eyebrow">Telemetria sospensioni MTB</span>
        <h1 className="lp-hero__headline">
          Misura. <span className="lp-hero__word">Analizza.</span> Regola.
        </h1>
        <p className="lp-hero__sub">
          Il sistema misura come lavorano davvero forcella e ammortizzatore mentre guidi, e ti dice
          in una riga cosa cambiare. Niente fogli di calcolo, niente teoria.
        </p>
        <div className="lp-hero__cta">
          <Link className="btn btn--primary btn--lg" to="/app">
            Scarica l’app
          </Link>
          <a className="btn btn--ghost btn--lg" href="#come-funziona">
            Scopri come funziona
          </a>
        </div>
        <p className="lp-hero__note">
          Funziona offline. Nessun account richiesto. I dati restano sul tuo telefono.
        </p>
      </div>
    </header>
  );
}

const PROBLEMS = [
  'Quanta corsa stai davvero usando?',
  'Quante volte arrivi a fondo corsa in una discesa?',
  'Quanto velocemente ritorna la sospensione dopo un colpo?',
  'Forcella e mono stanno lavorando in equilibrio tra loro?',
];

function Problem() {
  return (
    <section className="lp-section">
      <div className="lp__inner">
        <span className="lp-eyebrow">Il problema</span>
        <h2 className="lp-section__title">Il setup sulla carta non dice come lavora la bici.</h2>
        <p className="lp-section__lead">
          Puoi impostare sag e click seguendo la tabella del produttore e avere comunque una
          sospensione che lavora male in discesa. Quello che succede davvero sul sentiero non si
          vede da fermo, e nessuno può ricordarselo mentre guida.
        </p>
        <div className="lp-problems">
          {PROBLEMS.map((problem) => (
            <div key={problem} className="lp-problem">
              <span className="lp-problem__q" aria-hidden="true">
                ?
              </span>
              <span>{problem}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { n: '01', title: 'Installa i sensori', body: 'Sulla forcella e, se c’è, sull’ammortizzatore.' },
  { n: '02', title: 'Collega il dispositivo', body: 'Via Wi-Fi, dal telefono, in pochi secondi.' },
  { n: '03', title: 'Fai una run', body: 'Premi start e guida normalmente.' },
  { n: '04', title: 'L’app analizza', body: 'I dati vengono elaborati sul telefono.' },
  { n: '05', title: 'Ricevi i consigli', body: 'Modifiche concrete, in ordine di priorità.' },
];

function HowItWorks() {
  return (
    <section className="lp-section lp-section--alt" id="come-funziona">
      <div className="lp__inner">
        <span className="lp-eyebrow">Come funziona</span>
        <h2 className="lp-section__title">Cinque passaggi, una volta sola.</h2>
        <div className="lp-steps">
          {STEPS.map((step) => (
            <div key={step.n} className="lp-step">
              <div className="lp-step__num">{step.n}</div>
              <div className="lp-step__title">{step.title}</div>
              <div className="lp-step__body">{step.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Heights of the illustrative travel-distribution bars, in percent. */
const DISTRIBUTION = [12, 30, 58, 82, 96, 74, 52, 34, 18, 7];

function Analysis() {
  return (
    <section className="lp-section" id="analisi">
      <div className="lp__inner">
        <span className="lp-eyebrow">L’analisi</span>
        <h2 className="lp-section__title">Quattro cose che cambiano il tuo setup.</h2>
        <p className="lp-section__lead">
          L’app guarda ogni singolo movimento della sospensione e ne ricava poche misure che
          contano davvero.
        </p>

        <div className="lp-analysis">
          <div className="lp-tile">
            <div className="lp-tile__value">92%</div>
            <div className="lp-tile__label">Corsa utilizzata</div>
            <p className="lp-tile__body">
              Quanta corsa hai davvero sfruttato nel punto più impegnativo della discesa.
            </p>
          </div>

          <div className="lp-tile">
            <div className="lp-tile__value" style={{ color: 'var(--c-warn)' }}>
              5×
            </div>
            <div className="lp-tile__label">Fondo corsa</div>
            <p className="lp-tile__body">
              Quante volte la sospensione è arrivata a fine corsa, e per quanto tempo ci è rimasta.
            </p>
          </div>

          <div className="lp-tile">
            <div className="lp-tile__value">0,24 s</div>
            <div className="lp-tile__label">Tempo di ritorno</div>
            <p className="lp-tile__body">
              Quanto ci mette la sospensione a tornare estesa dopo un colpo. È il rebound, misurato.
            </p>
          </div>

          <div className="lp-tile">
            <div className="lp-tile__value">
              <span style={{ color: 'var(--c-accent)' }}>LS</span>
              <span className="faint"> / </span>
              <span style={{ color: 'var(--c-warn)' }}>HS</span>
            </div>
            <div className="lp-tile__label">Basse e alte velocità</div>
            <p className="lp-tile__body">
              Il sostegno in curva e la durezza sui colpi secchi si regolano con manopole diverse.
              L’app li misura separatamente e ti dice quale toccare.
            </p>
          </div>

          <div className="lp-tile" style={{ gridColumn: 'span 2' }}>
            <div className="lp-tile__label">Distribuzione del travel</div>
            <div className="lp-bars" aria-hidden="true">
              {DISTRIBUTION.map((height, i) => (
                <span key={i} className="lp-bars__bar" style={{ height: `${height}%` }} />
              ))}
            </div>
            <p className="lp-tile__body">
              Dove la sospensione passa il suo tempo lungo la corsa. Da qui si capisce se sta troppo
              alta, troppo bassa o al punto giusto.
            </p>
          </div>

          <div className="lp-tile">
            <div className="lp-tile__value" style={{ color: 'var(--c-accent)' }}>
              F/R
            </div>
            <div className="lp-tile__label">Equilibrio</div>
            <p className="lp-tile__body">
              Se anteriore e posteriore usano quote di corsa molto diverse, la bici non è in
              equilibrio.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Result() {
  return (
    <section className="lp-section lp-section--alt">
      <div className="lp__inner lp-result">
        <div>
          <span className="lp-eyebrow">Il risultato</span>
          <h2 className="lp-section__title">Una schermata. Una decisione.</h2>
          <p className="lp-section__lead">
            Alla fine di ogni run l’app non ti mostra un cruscotto: ti dice come sta lavorando ogni
            sospensione e qual è la modifica da fare per prima.
          </p>
        </div>

        <div className="lp-phone">
          <div className="lp-phone__screen">
            <div className="lp-phone__row">
              <div>
                <div className="lp-phone__label">Forcella</div>
                <div className="lp-phone__value">Leggermente rigida</div>
              </div>
              <span className="badge badge--warn">!</span>
            </div>
            <div className="lp-phone__row">
              <div>
                <div className="lp-phone__label">Posteriore</div>
                <div className="lp-phone__value">Corretto</div>
              </div>
              <span className="badge badge--ok">✓</span>
            </div>
            <div className="lp-phone__row">
              <div>
                <div className="lp-phone__label">Bilanciamento</div>
                <div className="lp-phone__value">Retrotreno leggermente cedevole</div>
              </div>
              <span className="badge badge--warn">!</span>
            </div>
            <div className="lp-phone__action">
              <div className="lp-phone__action-label">Azione consigliata</div>
              <div className="lp-phone__action-value">Aggiungi 5 PSI al posteriore</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Modes() {
  return (
    <section className="lp-section" id="modalita">
      <div className="lp__inner">
        <span className="lp-eyebrow">Due modalità</span>
        <h2 className="lp-section__title">Semplice di default, completa quando serve.</h2>
        <div className="lp-modes">
          <div className="lp-mode lp-mode--accent">
            <h3>Rider normale</h3>
            <p className="text-sm muted" style={{ marginTop: 'var(--s-2)' }}>
              Modalità Standard, attiva di default.
            </p>
            <ul className="lp-mode__list">
              <li>Un verdetto per forcella, posteriore e bilanciamento.</li>
              <li>Al massimo tre modifiche, in ordine di priorità.</li>
              <li>Nessun numero da interpretare.</li>
              <li>Una “i” accanto a ogni termine, con la spiegazione in parole semplici.</li>
            </ul>
          </div>
          <div className="lp-mode">
            <h3>Rider esperto</h3>
            <p className="text-sm muted" style={{ marginTop: 'var(--s-2)' }}>
              Modalità Esperto, un tocco per attivarla.
            </p>
            <ul className="lp-mode__list">
              <li>Posizione nel tempo, distribuzione del travel e delle velocità di stelo.</li>
              <li>Altezza di marcia, ripartizione tra basse e alte velocità.</li>
              <li>Metriche complete e ogni diagnosi con la sua soglia.</li>
              <li>Confronto tra run, dati grezzi ed export CSV e JSON.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Compatibility() {
  return (
    <section className="lp-section lp-section--alt" id="compatibilita">
      <div className="lp__inner">
        <span className="lp-eyebrow">Compatibilità</span>
        <h2 className="lp-section__title">Progettata per il suo dispositivo.</h2>
        <p className="lp-section__lead">
          L’app è pensata per il sistema di telemetria dedicato: unità di acquisizione e sensori
          lineari sulla forcella e, quando presente, sull’ammortizzatore posteriore. Funziona anche
          su hardtail: senza mono, l’app nasconde tutto ciò che riguarda il posteriore.
        </p>
        <p className="lp-section__lead">
          Dichiari tu quali regolazioni ha la tua sospensione, comprese le separazioni tra basse e
          alte velocità. L’app non consiglierà mai una manopola che non hai: se non c’è nulla da
          girare, te lo dice invece di inventarsi una modifica.
        </p>
        <p className="lp-section__lead">
          Non dichiariamo compatibilità con altri sistemi di telemetria o sensori di terze parti.
          L’app include un dispositivo simulato, così puoi provare l’intera esperienza prima di
          avere l’hardware.
        </p>
      </div>
    </section>
  );
}

function Download() {
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const install = () => {
    // Only Chromium browsers fire beforeinstallprompt; elsewhere the button
    // stays a plain link into the app, which is installable from the browser menu.
    (installPrompt as unknown as { prompt?: () => void })?.prompt?.();
  };

  return (
    <section className="lp-section">
      <div className="lp__inner lp-download">
        <span className="lp-eyebrow">Inizia</span>
        <h2 className="lp-section__title">Provala adesso, anche senza hardware.</h2>
        <p className="lp-section__lead" style={{ margin: 'var(--s-4) auto 0' }}>
          L’app si installa direttamente dal browser e funziona offline. Il dispositivo simulato ti
          fa provare tutto il flusso: calibrazione, run, analisi e consigli.
        </p>

        <div className="lp-store">
          <Link className="btn btn--primary btn--lg" to="/app">
            Apri l’app nel browser
          </Link>
          {installPrompt && (
            <button type="button" className="btn btn--lg" onClick={install}>
              Installa come app
            </button>
          )}
        </div>

        <div className="lp-store">
          {STORE_LINKS.map((link) =>
            link.href ? (
              <a key={link.id} className="lp-store__btn" href={link.href}>
                <span className="lp-store__small">{link.small}</span>
                <span className="lp-store__big">{link.big}</span>
              </a>
            ) : (
              <button key={link.id} type="button" className="lp-store__btn" disabled>
                <span className="lp-store__small">In arrivo su</span>
                <span className="lp-store__big">{link.big}</span>
              </button>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp__inner row row--between row--wrap">
        <span>Telemetria MTB · Sistema di telemetria per sospensioni</span>
        <span>I dati delle run restano sul tuo dispositivo.</span>
      </div>
    </footer>
  );
}
