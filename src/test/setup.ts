import { afterEach, beforeEach } from "vitest";

/**
 * jsdom has no layout and no matchMedia. Tests behave like a wide desktop window unless a
 * test sets `viewport.width` (for example to check the phone layout) before rendering.
 */
export const viewport = { width: 1280 };

function matches(query: string): boolean {
  const min = /min-width:\s*(\d+)px/.exec(query);
  if (min) return viewport.width >= Number(min[1]);
  const max = /max-width:\s*(\d+)px/.exec(query);
  if (max) return viewport.width <= Number(max[1]);
  return false;
}

beforeEach(() => {
  viewport.width = 1280;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: matches(query),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
  Element.prototype.scrollIntoView = () => {};
  URL.createObjectURL = () => "blob:test";
  URL.revokeObjectURL = () => {};
  // jsdom lacks Blob.text(); real browsers have it.
  if (!Blob.prototype.text) {
    Blob.prototype.text = function text(this: Blob) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(this);
      });
    };
  }
  // A download link click would make jsdom log "navigation not implemented".
  HTMLAnchorElement.prototype.click = function click() {};
});

afterEach(() => {
  document.body.style.overflow = "";
  document.documentElement.removeAttribute("data-theme");
});
