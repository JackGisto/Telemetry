import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, ConfirmModal, EmptyState } from '@/design-system';
import { ScreenHeader } from '@/app/AppShell';
import { useBikeStore, useSettingsStore } from '@/app/store';
import { BikeWizard } from './BikeWizard';

/** Bike list and editor. */
export function BikePage() {
  const navigate = useNavigate();
  const { bikes, remove, setActive } = useBikeStore();
  const activeBikeId = useSettingsStore((s) => s.activeBikeId);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  if (bikes.length === 0) {
    return (
      <>
        <ScreenHeader title="Bici" />
        <EmptyState
          glyph="⚙"
          title="Nessuna bici configurata"
          body="L’analisi ha bisogno della corsa delle sospensioni e delle regolazioni disponibili."
          action={
            <Button variant="primary" onClick={() => navigate('/app/bici/nuova')}>
              Configura una bici
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <ScreenHeader
        title="Bici"
        question="Com’è configurata la mia bici?"
        action={
          <Button size="sm" onClick={() => navigate('/app/bici/nuova')}>
            Aggiungi
          </Button>
        }
      />

      <div className="stack stack--3">
        {bikes.map((bike) => {
          const rear = bike.rearSuspension.present ? bike.rearSuspension : null;
          return (
            <Card key={bike.id} className="stack stack--3">
              <div className="row row--between">
                <strong>{bike.name}</strong>
                {bike.id === activeBikeId && <Badge tone="ok">Attiva</Badge>}
              </div>

              <div className="stack stack--1 text-sm muted">
                <span>
                  Forcella {bike.frontSuspension.totalTravelMm} mm ·{' '}
                  {bike.frontSuspension.springType === 'air' ? 'aria' : 'molla'}
                  {bike.frontSuspension.pressurePsi !== undefined
                    ? ` · ${bike.frontSuspension.pressurePsi} PSI`
                    : ''}
                </span>
                <span>
                  {rear
                    ? `Posteriore ${rear.totalTravelMm} mm · ${rear.springType === 'air' ? 'aria' : 'molla'}${
                        rear.pressurePsi !== undefined ? ` · ${rear.pressurePsi} PSI` : ''
                      }`
                    : 'Hardtail — nessun ammortizzatore posteriore'}
                </span>
                <span>Stile: {bike.rider.style}</span>
              </div>

              <div className="row" style={{ gap: 'var(--s-2)' }}>
                <Button size="sm" variant="primary" onClick={() => navigate(`/app/bici/${bike.id}`)}>
                  Modifica
                </Button>
                {bike.id !== activeBikeId && (
                  <Button size="sm" variant="ghost" onClick={() => void setActive(bike.id)}>
                    Rendi attiva
                  </Button>
                )}
                <div className="grow" />
                <Button size="sm" variant="ghost" onClick={() => setPendingDelete(bike.id)}>
                  Elimina
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <ConfirmModal
        open={pendingDelete !== null}
        title="Eliminare questa bici?"
        body="Le run già salvate restano nello storico con la configurazione con cui sono state registrate."
        confirmLabel="Elimina"
        destructive
        onConfirm={() => {
          if (pendingDelete) void remove(pendingDelete);
        }}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}

/** Create or edit one bike through the wizard. */
export function BikeEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const bikes = useBikeStore((s) => s.bikes);
  const initial = id && id !== 'nuova' ? bikes.find((b) => b.id === id) : undefined;

  return (
    <>
      <ScreenHeader title={initial ? 'Modifica bici' : 'Nuova bici'} />
      <BikeWizard initial={initial} onDone={() => navigate('/app/bici')} />
    </>
  );
}
