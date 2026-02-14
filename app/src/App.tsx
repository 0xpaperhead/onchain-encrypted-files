import { useState, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { UploadPanel } from "./components/UploadPanel";
import { GalleryPanel } from "./components/GalleryPanel";
import { ImageViewDialog } from "./components/ImageViewDialog";
import "./index.css";

function WalletDebug() {
  const { wallet, wallets, publicKey, connected, connecting } = useWallet();
  const [phantomDirect, setPhantomDirect] = useState<string>("checking...");

  useEffect(() => {
    const p = (window as any).phantom?.solana;
    if (p) {
      setPhantomDirect(`found, isConnected=${p.isConnected}, publicKey=${p.publicKey?.toBase58()?.slice(0,8) ?? "null"}`);
    } else {
      setPhantomDirect("window.phantom.solana not found");
    }
  }, [connected]);

  return (
    <pre style={{ fontSize: 11, background: "#111", color: "#0f0", padding: 8, borderRadius: 4, marginTop: 8, whiteSpace: "pre-wrap" }}>
      {JSON.stringify({
        walletsDetected: wallets.map(w => `${w.adapter.name} (${w.readyState})`),
        selectedWallet: wallet?.adapter.name ?? null,
        adapterConnected: wallet?.adapter.connected ?? null,
        adapterConnecting: (wallet?.adapter as any)?.connecting ?? null,
        connected,
        connecting,
        publicKey: publicKey?.toBase58()?.slice(0, 8) ?? null,
        phantomDirect,
      }, null, 2)}
    </pre>
  );
}

function WalletButton() {
  const { wallet, publicKey, connected, connecting, select, connect, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [error, setError] = useState<string | null>(null);

  // After user picks a wallet from the modal, trigger connect
  const prevWalletRef = useRef(wallet);
  useEffect(() => {
    if (wallet && wallet !== prevWalletRef.current && !connected && !connecting) {
      prevWalletRef.current = wallet;
      const t = setTimeout(() => {
        connect().catch((err) => {
          console.error("[connect error]", err);
          setError(String(err));
        });
      }, 100);
      return () => clearTimeout(t);
    }
    prevWalletRef.current = wallet;
  }, [wallet, connected, connecting, connect]);

  if (connected && publicKey) {
    const addr = publicKey.toBase58();
    return (
      <button
        className="wallet-adapter-button wallet-adapter-button-trigger"
        onClick={() => disconnect()}
      >
        {addr.slice(0, 4)}..{addr.slice(-4)}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button
        className="wallet-adapter-button wallet-adapter-button-trigger"
        onClick={() => {
          if (wallet && !connected && !connecting) {
            connect().catch((err) => {
              console.error("[connect error]", err);
              setError(String(err));
            });
          } else {
            setVisible(true);
          }
        }}
      >
        {connecting ? "Connecting..." : wallet ? "Connect" : "Select Wallet"}
      </button>
      <button
        style={{ padding: "8px 12px", background: "#ab9ff2", color: "#000", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
        onClick={async () => {
          try {
            const phantom = (window as any).phantom?.solana;
            if (!phantom) { setError("Phantom not found"); return; }
            setError(null);
            const resp = await phantom.connect();
            setError("Phantom direct: connected! " + resp.publicKey.toBase58().slice(0, 8) + "...");
          } catch (err: any) {
            setError("Phantom direct error: " + err.message);
          }
        }}
      >
        Test Phantom Direct
      </button>
      {error && <span style={{ color: "#f88", fontSize: 12 }}>{error}</span>}
    </div>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState("upload");
  const [viewImageId, setViewImageId] = useState<string | null>(null);
  const [viewContentType, setViewContentType] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleView(imageId: string, contentType: string) {
    setViewImageId(imageId);
    setViewContentType(contentType);
    setDialogOpen(true);
  }

  function handleUploadComplete() {
    setActiveTab("gallery");
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-8">
      <div style={{ padding: 16, marginBottom: 16, border: "2px solid yellow", background: "#222" }}>
        <button
          style={{ padding: "12px 24px", background: "#ab9ff2", color: "#000", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 16, fontWeight: "bold" }}
          onClick={() => {
            alert("Button clicked! Checking Phantom...");
            const phantom = (window as any).phantom?.solana;
            if (!phantom) {
              alert("window.phantom.solana is UNDEFINED");
              return;
            }
            alert("Phantom found. isConnected=" + phantom.isConnected + ". Calling connect()...");
            phantom.connect()
              .then((resp: any) => alert("Connected! pubkey=" + resp.publicKey.toBase58()))
              .catch((err: any) => alert("Error: " + err.message));
          }}
        >
          TEST: Connect Phantom Directly
        </button>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Onchain Encrypted Images</h1>
        <WalletButton />
      </div>

      <WalletDebug />
      <Separator className="mb-6" />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
        </TabsList>
        <TabsContent value="upload">
          <UploadPanel onUploadComplete={handleUploadComplete} />
        </TabsContent>
        <TabsContent value="gallery">
          <GalleryPanel onView={handleView} />
        </TabsContent>
      </Tabs>

      <ImageViewDialog
        imageId={viewImageId}
        contentType={viewContentType}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

export default App;
