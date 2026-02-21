
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/cv-print.css'
import { BrowserRouter } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import './i18n';

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </ErrorBoundary>
);
