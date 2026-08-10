import '@testing-library/jest-dom';

// CI has no .env, so provide placeholders for the Vite env vars that the
// eagerly-created Supabase client (src/integrations/supabase/client.ts)
// validates at import time. Tests never hit the network; these values only
// satisfy createClient's argument checks so modules can load headlessly.
Object.assign(import.meta.env, {
  VITE_SUPABASE_URL:
    import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321',
  VITE_SUPABASE_PUBLISHABLE_KEY:
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'test-publishable-key',
  VITE_SUPABASE_PROJECT_ID:
    import.meta.env.VITE_SUPABASE_PROJECT_ID || 'test-project',
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Radix relies on these; jsdom does not implement them.
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}
if (!(Element.prototype as any).scrollIntoView) {
  (Element.prototype as any).scrollIntoView = () => {};
}
if (!(window as any).PointerEvent) {
  (window as any).PointerEvent = class extends Event {} as any;
}
(Element.prototype as any).hasPointerCapture ??= () => false;
(Element.prototype as any).setPointerCapture ??= () => {};
(Element.prototype as any).releasePointerCapture ??= () => {};
