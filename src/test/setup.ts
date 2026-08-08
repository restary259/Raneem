import '@testing-library/jest-dom';

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
