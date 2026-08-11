
import { createRoot } from 'react-dom/client'
import { Suspense } from 'react'
import App from './App.tsx'
import './index.css'
import './styles/cv-print.css'
import { BrowserRouter } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import ThemeScope from './components/common/ThemeScope'
import './i18n';

// App calls useTranslation("dashboard") at its top level while react-i18next
// runs in suspense mode. Without a Suspense boundary, a failed/late namespace
// load (e.g. /locales/*.json missing on the deployed host) would throw an
// unhandled error and blank the whole page. This boundary renders a minimal
// fallback while i18n suspends instead of white-screening.
const i18nFallback = (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', color: '#6b7280' }}>
    <div>جارٍ التحميل… / Loading…</div>
  </div>
);

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <Suspense fallback={i18nFallback}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <ThemeScope>
          <App />
        </ThemeScope>
      </BrowserRouter>
    </Suspense>
  </ErrorBoundary>
);
