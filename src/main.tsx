import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";

/**
 * The real entry point: the one line that tells the browser "render the
 * Cadence app (`App`, from `src/app/App.tsx`) into the `<div id="root">` in
 * `index.html`". Nothing else in the app is reachable except through `App`.
 */
import "@fontsource/atkinson-hyperlegible/latin-400.css";
import "@fontsource/atkinson-hyperlegible/latin-700.css";
import "@fontsource/bricolage-grotesque/latin-500.css";
import "@fontsource/bricolage-grotesque/latin-700.css";
import "./styles/app.css";
import { registerServiceWorker } from "./pwa/registerServiceWorker";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// In the published site only: keep a copy of the app on the device so it opens offline and can be installed.
registerServiceWorker();
