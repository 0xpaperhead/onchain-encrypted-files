import { Buffer } from "buffer";
globalThis.Buffer = Buffer;

import { createRoot } from "react-dom/client";
import { WalletProvider } from "./components/WalletProvider";
import { App } from "./App";

// Clear any stale wallet state from previous debug sessions
localStorage.removeItem("walletName");

const elem = document.getElementById("root")!;
const app = (
  <WalletProvider>
    <App />
  </WalletProvider>
);

if (import.meta.hot) {
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(app);
} else {
  createRoot(elem).render(app);
}
