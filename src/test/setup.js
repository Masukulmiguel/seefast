import "@testing-library/jest-dom/vitest";

// jsdom não implementa window.matchMedia; fornece um mínimo para o arranque.
// Os testes que dependem do viewport fazem stub deste com valores controlados.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  });
}
