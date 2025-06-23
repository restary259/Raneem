
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import { securityMonitor } from './utils/securityMonitor'
import './i18n'; // Initialize i18next

// Initialize security monitoring
securityMonitor.init();

// Add meta tag for CSP if not already present
if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = `
    default-src 'self'; 
    script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; 
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; 
    font-src 'self' https://fonts.gstatic.com; 
    img-src 'self' data: blob: https://*.supabase.co https://lovable-uploads.s3.amazonaws.com; 
    connect-src 'self' https://*.supabase.co wss://*.supabase.co; 
    frame-src 'none'; 
    object-src 'none'; 
    upgrade-insecure-requests;
  `.replace(/\s+/g, ' ').trim();
  document.head.appendChild(meta);
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </ErrorBoundary>
);
