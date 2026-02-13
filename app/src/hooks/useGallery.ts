import { useState, useEffect, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { getProgram, fetchImagesByAuthority } from "@/lib/anchor";
import type { ImageUploadAccount } from "@/lib/anchor";

export function useGallery() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [images, setImages] = useState<ImageUploadAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!wallet) {
      setImages([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const program = getProgram(connection, wallet);
      const accounts = await fetchImagesByAuthority(
        program,
        wallet.publicKey
      );

      // Sort by createdAt descending
      accounts.sort(
        (a, b) =>
          b.account.createdAt.toNumber() - a.account.createdAt.toNumber()
      );

      setImages(accounts);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { images, loading, error, refresh };
}
