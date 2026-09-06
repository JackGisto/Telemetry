import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom does not implement these; several UI components rely on them.
if (!('matchMedia' in window)) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (!('ResizeObserver' in window)) {
  // Recharts' ResponsiveContainer needs it.
  (window as unknown as Record<string, unknown>).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
