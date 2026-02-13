import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { EventParser } from "@coral-xyz/anchor";
import { getProgram } from "@/lib/anchor";
import {
  deriveEncryptionKey,
  decryptData,
  reassembleChunks,
  getImageUploadPda,
} from "@/lib/crypto";
import { PROGRAM_ID } from "@/lib/constants";
import type { PublicKey } from "@solana/web3.js";

export type DecryptStatus = "idle" | "signing" | "fetching" | "decrypting" | "done" | "error";

export function useImageDecrypt() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { signMessage } = useWallet();

  const [status, setStatus] = useState<DecryptStatus>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decrypt = useCallback(
    async (imageId: string, expectedContentType: string) => {
      if (!wallet || !signMessage) {
        setError("Wallet not connected");
        return;
      }

      try {
        setStatus("idle");
        setError(null);
        // Revoke previous URL
        if (imageUrl) {
          URL.revokeObjectURL(imageUrl);
          setImageUrl(null);
        }

        // Sign to derive key
        setStatus("signing");
        const message = new TextEncoder().encode(`encrypt:${imageId}`);
        const signature = await signMessage(message);
        const encryptionKey = deriveEncryptionKey(signature);

        // Fetch transactions for the PDA
        setStatus("fetching");
        const [pda] = getImageUploadPda(
          PROGRAM_ID,
          wallet.publicKey,
          imageId
        );

        const program = getProgram(connection, wallet);

        const signatures = await connection.getSignaturesForAddress(
          pda,
          undefined,
          "confirmed"
        );

        const txs = await connection.getTransactions(
          signatures.map((s) => s.signature),
          { maxSupportedTransactionVersion: 0, commitment: "confirmed" }
        );

        // Parse ChunkUploaded events
        const eventParser = new EventParser(
          PROGRAM_ID,
          program.coder
        );

        const chunkEvents: { chunkIndex: number; data: Uint8Array }[] = [];

        for (const tx of txs) {
          if (!tx?.meta?.logMessages) continue;
          for (const event of eventParser.parseLogs(tx.meta.logMessages)) {
            if (event.name === "chunkUploaded") {
              const data = event.data as { chunkIndex: number; data: Uint8Array | Buffer };
              chunkEvents.push({
                chunkIndex: data.chunkIndex,
                data: new Uint8Array(data.data),
              });
            }
          }
        }

        // Sort and reassemble
        chunkEvents.sort((a, b) => a.chunkIndex - b.chunkIndex);
        const reassembled = reassembleChunks(
          chunkEvents.map((e) => e.data)
        );

        // Decrypt
        setStatus("decrypting");
        const decrypted = decryptData(encryptionKey, reassembled);

        // Create blob URL
        const blob = new Blob([new Uint8Array(decrypted)], { type: expectedContentType });
        const url = URL.createObjectURL(blob);

        setImageUrl(url);
        setContentType(expectedContentType);
        setStatus("done");
      } catch (err: unknown) {
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [wallet, signMessage, connection, imageUrl]
  );

  const reset = useCallback(() => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    setStatus("idle");
    setImageUrl(null);
    setContentType(null);
    setError(null);
  }, [imageUrl]);

  return { decrypt, status, imageUrl, contentType, error, reset };
}
