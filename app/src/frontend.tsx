import { Buffer } from "buffer";
globalThis.Buffer = Buffer;

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WalletProvider } from "./components/WalletProvider";
import { App } from "./App";

const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
    <WalletProvider>
      <App />
    </WalletProvider>
  </StrictMode>
);

if (import.meta.hot) {
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(app);
} else {
  createRoot(elem).render(app);
}
