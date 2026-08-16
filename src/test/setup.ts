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

// jsdom (≤25) ships a stub Blob with only slice/size/type — no text() or
// arrayBuffer(). The CSV BOM test inspects raw bytes, so polyfill both.
// Real browsers implement these; bumping jsdom to 26/30 drags in undici 8 /
// whatwg-url 17, which breaks Lovable's Bun install graph.
if (typeof Blob !== 'undefined') {
  const sym = Object.getOwnPropertySymbols(new Blob([])).find(s => String(s) === 'Symbol(impl)');

  const rawBytes = (blob: Blob): Uint8Array => {
    // jsdom stores the Blob content as a Node Buffer on the impl's _buffer,
    // behind a Symbol(impl) private. Test-only glue; in a real browser the
    // native methods exist and this branch never runs.
    const impl = sym ? (blob as any)[sym] : undefined;
    const buf: unknown = impl?._buffer;
    if (typeof buf === 'string') return new TextEncoder().encode(buf);
    if (buf && typeof (buf as any).byteLength === 'number') {
      return new Uint8Array((buf as ArrayBuffer).slice(0, (buf as any).byteLength));
    }
    return new Uint8Array(0);
  };

  if (typeof (Blob.prototype as any).arrayBuffer !== 'function') {
    (Blob.prototype as any).arrayBuffer = function arrayBuffer(this: Blob): Promise<ArrayBuffer> {
      return Promise.resolve(rawBytes(this).buffer as ArrayBuffer);
    };
  }
  if (typeof (Blob.prototype as any).text !== 'function') {
    (Blob.prototype as any).text = function text(this: Blob): Promise<string> {
      // Per spec, text() decodes as UTF-8 and strips a leading BOM.
      const bytes = rawBytes(this);
      const hasBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
      return Promise.resolve(new TextDecoder().decode(hasBom ? bytes.slice(3) : bytes));
    };
  }
}
