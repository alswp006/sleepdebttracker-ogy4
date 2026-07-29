import type { ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { getSettings } from './lib/storage';
import HomePage from './pages/HomePage';
import OnboardingPage from './pages/OnboardingPage';
import RecordPage from './pages/RecordPage';
import ReportPage from './pages/ReportPage';
import PlanPage from './pages/PlanPage';
import ChronotypePage from './pages/ChronotypePage';
import ChronotypeResultPage from './pages/ChronotypeResultPage';
import SettingsPage from './pages/SettingsPage';

// Dev-only TDS Gallery route — `import.meta.env.DEV` is statically replaced
// (true in dev, false in prod) so the entire import + Route is tree-shaken
// from production builds. Verify with: `grep -r "TdsGallery" dist/` → empty.
const DevTdsGallery = import.meta.env.DEV
  ? lazy(() => import('./pages/__TdsGallery'))
  : null;

/**
 * 온보딩 가드: 아직 온보딩을 마치지 않았으면(getSettings().onboarded === false)
 * 어떤 경로로 진입해도 /onboarding으로 돌려보낸다. 온보딩을 마친 뒤엔 정상 라우팅.
 * (기본값 onboarded=false이므로 최초 진입도 온보딩으로 유도된다.)
 */
function RequireOnboarding({ children }: { children: ReactNode }) {
  if (!getSettings().onboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/" element={<RequireOnboarding><HomePage /></RequireOnboarding>} />
      <Route path="/record" element={<RequireOnboarding><RecordPage /></RequireOnboarding>} />
      <Route path="/report" element={<RequireOnboarding><ReportPage /></RequireOnboarding>} />
      <Route path="/plan" element={<RequireOnboarding><PlanPage /></RequireOnboarding>} />
      <Route path="/chronotype" element={<RequireOnboarding><ChronotypePage /></RequireOnboarding>} />
      <Route
        path="/chronotype/result"
        element={<RequireOnboarding><ChronotypeResultPage /></RequireOnboarding>}
      />
      <Route path="/settings" element={<RequireOnboarding><SettingsPage /></RequireOnboarding>} />
      {DevTdsGallery && (
        <Route
          path="/__tds-gallery"
          element={
            <Suspense fallback={null}>
              <DevTdsGallery />
            </Suspense>
          }
        />
      )}
    </Routes>
  );
}
