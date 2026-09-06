import { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LoadingState, ToastProvider } from '@/design-system';
import { OnboardingPage } from '@/features/onboarding/OnboardingPage';
import { HomePage } from '@/features/home/HomePage';
import { RunPage } from '@/features/run/RunPage';
import { HistoryPage } from '@/features/history/HistoryPage';
import { AnalysisPage } from '@/features/analysis/AnalysisPage';
import { BikeEditPage, BikePage } from '@/features/bike/BikePage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { AppShell } from './AppShell';

// Split points: the public page is loaded by first-time visitors who never
// touch the app, and the comparison screen pulls in the charting library.
const LandingPage = lazy(() => import('@/pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const ComparePage = lazy(() =>
  import('@/features/comparison/ComparePage').then((m) => ({ default: m.ComparePage })),
);
import { hydrateApp } from './hydrate';
import { useSettingsStore } from './store';

/**
 * Two products, one bundle: the public landing page at `/` and the app at
 * `/app`. They share the design tokens and nothing else.
 */
export function AppRoutes() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void hydrateApp().finally(() => setReady(true));
  }, []);

  if (!ready) return <LoadingState label="Caricamento…" />;

  return (
    <ToastProvider>
      <Suspense fallback={<LoadingState label="Caricamento…" />}>
        <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route
          path="/app"
          element={
            <RequireOnboarding>
              <AppShell />
            </RequireOnboarding>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="run" element={<RunPage />} />
          <Route path="storico" element={<HistoryPage />} />
          <Route path="analisi/:id" element={<AnalysisPage />} />
          <Route path="confronto/:idA/:idB" element={<ComparePage />} />
          <Route path="bici" element={<BikePage />} />
          <Route path="bici/:id" element={<BikeEditPage />} />
          <Route path="impostazioni" element={<SettingsPage />} />
        </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ToastProvider>
  );
}

/** First launch always goes through onboarding. */
function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);
  const location = useLocation();
  if (!onboardingCompleted) return <Navigate to="/onboarding" replace state={{ from: location }} />;
  return <>{children}</>;
}
