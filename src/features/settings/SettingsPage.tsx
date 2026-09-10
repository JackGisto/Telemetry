import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, ConfirmModal, Segmented, useToast } from '@/design-system';
import { ENGINE_VERSION } from '@/analysis';
import { bleAvailability } from '@/transport';
import { clearAllData, saveSession } from '@/storage';
import { newId } from '@/data/defaults';
import { ScreenHeader } from '@/app/AppShell';
import { BUILD_INFO, buildLabel } from '@/app/buildInfo';
import { useBikeStore, useHistoryStore, useSettingsStore } from '@/app/store';
import { parseJson } from '@/features/export/exporters';
import { readTextFile } from '@/features/export/download';
import { CalibrationPanel } from '@/features/calibration/CalibrationPanel';
import { ConnectPanel } from '@/features/device/ConnectPanel';
import { AccountPanel } from '@/features/profile/AccountPanel';
import { ProfilePanel } from '@/features/profile/ProfilePanel';

export function SettingsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { mode, units, update } = useSettingsStore();
  const reloadHistory = useHistoryStore((s) => s.load);
  const reloadBikes = useBikeStore((s) => s.load);
  const activeBike = useBikeStore((s) => s.activeBike());
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const ble = bleAvailability();

  const importRun = async (file: File) => {
    try {
      const parsed = parseJson(await readTextFile(file));
      // Imported runs get a fresh local id so they never collide with a
      // downloaded run that happens to share one.
      await saveSession({ ...parsed.session, id: newId('run'), source: 'imported' });
      await reloadHistory();
      toast.push({ tone: 'ok', title: 'Run importata' });
      navigate('/app/storico');
    } catch (error) {
      toast.push({
        tone: 'danger',
        title: 'Import non riuscito',
        body: error instanceof Error ? error.message : 'File non leggibile.',
      });
    }
  };

  const wipe = async () => {
    await clearAllData();
    await Promise.all([reloadHistory(), reloadBikes()]);
    await useSettingsStore.getState().hydrate();
    toast.push({ tone: 'ok', title: 'Dati eliminati' });
    navigate('/onboarding');
  };

  return (
    <>
      <ScreenHeader title="Impostazioni" />

      <div className="stack stack--4">
        <Card className="stack stack--3">
          <span className="ds-label">Account</span>
          <AccountPanel />
        </Card>

        <ProfilePanel />

        <Card className="stack stack--3">
          <span className="ds-label">Modalità</span>
          <Segmented
            ariaLabel="Modalità di visualizzazione"
            value={mode}
            options={[
              { value: 'standard' as const, label: 'Standard' },
              { value: 'expert' as const, label: 'Esperto' },
            ]}
            onChange={(next) => void update({ mode: next })}
          />
          <p className="text-sm muted">
            Standard mostra solo il verdetto e le azioni da fare. Esperto aggiunge grafici, metriche
            complete e dati grezzi.
          </p>
        </Card>

        <Card className="stack stack--3">
          <span className="ds-label">Unità</span>
          <Segmented
            ariaLabel="Unità di misura"
            value={units}
            options={[
              { value: 'metric' as const, label: 'mm / PSI' },
              { value: 'imperial' as const, label: 'in / PSI' },
            ]}
            onChange={(next) => void update({ units: next })}
          />
        </Card>

        <Card className="stack stack--3">
          <span className="ds-label">Dispositivo</span>
          <ConnectPanel />
        </Card>

        {activeBike && <CalibrationPanel />}

        <Card className="stack stack--3">
          <span className="ds-label">Dati</span>
          <p className="text-sm muted">
            Tutte le run restano su questo dispositivo. Non esiste alcun account e nessun dato viene
            inviato a un server.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importRun(file);
              e.target.value = '';
            }}
          />
          <Button variant="secondary" block onClick={() => fileInput.current?.click()}>
            Importa run da file JSON
          </Button>
          <Button variant="danger" block onClick={() => setConfirmWipe(true)}>
            Elimina tutti i dati locali
          </Button>
        </Card>

        <Card className="stack stack--3 text-sm muted">
          <span className="ds-label">Informazioni</span>
          <div className="row row--between">
            <span>Versione app</span>
            <span className="ds-mono">v{BUILD_INFO.version}</span>
          </div>
          <div className="row row--between">
            <span>Build</span>
            <span className="ds-mono">
              {BUILD_INFO.commit} · {BUILD_INFO.date}
            </span>
          </div>
          <div className="row row--between">
            <span>Motore di analisi</span>
            <span className="ds-mono">v{ENGINE_VERSION}</span>
          </div>
          <div className="row row--between">
            <span>Web Bluetooth</span>
            <span className="ds-mono">{ble.usable ? 'disponibile' : 'non disponibile'}</span>
          </div>
          <p className="text-xs faint">
            Il protocollo del dispositivo non è ancora congelato: gli indirizzi e gli
            identificativi usati dall’app sono segnaposto e verranno allineati al firmware.
          </p>
          {/* A tester reporting a problem needs to say which build they saw it on. */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(buildLabel())
                .then(() => toast.push({ tone: 'ok', title: 'Versione copiata' }))
                .catch(() =>
                  toast.push({
                    tone: 'warn',
                    title: 'Copia non riuscita',
                    body: buildLabel(),
                  }),
                );
            }}
          >
            Copia versione per una segnalazione
          </Button>
        </Card>
      </div>

      <ConfirmModal
        open={confirmWipe}
        title="Eliminare tutti i dati?"
        body="Bici, run, analisi e note verranno eliminate definitivamente da questo dispositivo. L’operazione non è reversibile."
        confirmLabel="Elimina tutto"
        destructive
        onConfirm={() => void wipe()}
        onClose={() => setConfirmWipe(false)}
      />
    </>
  );
}
