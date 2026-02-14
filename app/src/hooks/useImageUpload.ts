import { useState, useCallback } from "react";
import { useConnection, useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
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
  const anchorWallet = useAnchorWallet();
  const { signMessage } = useWallet();

  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      if (!anchorWallet || !signMessage) {
        setError("Wallet not connected");
        return;
      }

      try {
        setStatus("idle");
        setError(null);
        setTxSignature(null);

        const imageId = generateImageId();
        const contentType = file.type || "application/octet-stream";

        const arrayBuffer = await file.arrayBuffer();
        const plaintext = new Uint8Array(arrayBuffer);

        setStatus("signing");
        const message = new TextEncoder().encode(`encrypt:${imageId}`);
        const signature = await signMessage(message);
        const encryptionKey = deriveEncryptionKey(signature);

        setStatus("encrypting");
        const encrypted = encryptData(encryptionKey, plaintext);

        const chunks = chunkData(encrypted);
        setProgress({ current: 0, total: chunks.length });

        const program = getProgram(connection, anchorWallet);

        setStatus("initializing");
        await program.methods
          .initializeUpload(imageId, chunks.length, contentType)
          .accounts({
            authority: anchorWallet.publicKey,
          })
          .rpc();

        setStatus("uploading");
        const [pda] = getImageUploadPda(
          PROGRAM_ID,
          anchorWallet.publicKey,
          imageId
        );

        for (let i = 0; i < chunks.length; i++) {
          await program.methods
            .uploadChunk(i, Buffer.from(chunks[i]!))
            .accounts({
              authority: anchorWallet.publicKey,
              imageUpload: pda,
            })
            .rpc();
          setProgress({ current: i + 1, total: chunks.length });
        }

        setStatus("finalizing");
        const finalizeTx = await program.methods
          .finalizeUpload()
          .accounts({
            authority: anchorWallet.publicKey,
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
    [anchorWallet, signMessage, connection]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setProgress({ current: 0, total: 0 });
    setError(null);
    setTxSignature(null);
  }, []);

  return { upload, status, progress, error, txSignature, reset };
}
