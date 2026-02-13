import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { getProgram } from "@/lib/anchor";
import {
  generateImageId,
  deriveEncryptionKey,
  encryptData,
  chunkData,
  getImageUploadPda,
} from "@/lib/crypto";
import { PROGRAM_ID } from "@/lib/constants";

export type UploadStatus =
  | "idle"
  | "signing"
  | "encrypting"
  | "initializing"
  | "uploading"
  | "finalizing"
  | "done"
  | "error";

export function useImageUpload() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { signMessage } = useWallet();

  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      if (!wallet || !signMessage) {
        setError("Wallet not connected");
        return;
      }

      try {
        setStatus("idle");
        setError(null);
        setTxSignature(null);

        const imageId = generateImageId();
        const contentType = file.type || "application/octet-stream";

        // Read file as Uint8Array
        const arrayBuffer = await file.arrayBuffer();
        const plaintext = new Uint8Array(arrayBuffer);

        // Sign message to derive encryption key
        setStatus("signing");
        const message = new TextEncoder().encode(`encrypt:${imageId}`);
        const signature = await signMessage(message);
        const encryptionKey = deriveEncryptionKey(signature);

        // Encrypt
        setStatus("encrypting");
        const encrypted = encryptData(encryptionKey, plaintext);

        // Chunk
        const chunks = chunkData(encrypted);
        setProgress({ current: 0, total: chunks.length });

        // Get program
        const program = getProgram(connection, wallet);

        // Initialize upload
        setStatus("initializing");
        await program.methods
          .initializeUpload(imageId, chunks.length, contentType)
          .accounts({
            authority: wallet.publicKey,
          })
          .rpc();

        // Upload chunks
        setStatus("uploading");
        const [pda] = getImageUploadPda(
          PROGRAM_ID,
          wallet.publicKey,
          imageId
        );

        for (let i = 0; i < chunks.length; i++) {
          await program.methods
            .uploadChunk(i, Buffer.from(chunks[i]!))
            .accounts({
              authority: wallet.publicKey,
              imageUpload: pda,
            })
            .rpc();
          setProgress({ current: i + 1, total: chunks.length });
        }

        // Finalize
        setStatus("finalizing");
        const finalizeTx = await program.methods
          .finalizeUpload()
          .accounts({
            authority: wallet.publicKey,
            imageUpload: pda,
          })
          .rpc();

        setTxSignature(finalizeTx);
        setStatus("done");
      } catch (err: unknown) {
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [wallet, signMessage, connection]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setProgress({ current: 0, total: 0 });
    setError(null);
    setTxSignature(null);
  }, []);

  return { upload, status, progress, error, txSignature, reset };
}
