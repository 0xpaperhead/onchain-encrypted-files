import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import type { OnchainEncryptedImages } from "@/idl/onchain_encrypted_images";
import IDL from "@/idl/onchain_encrypted_images.json";
import { PROGRAM_ID } from "./constants";

export function getProvider(
  connection: Connection,
  wallet: AnchorWallet
): AnchorProvider {
  return new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
}

export function getProgram(
  connection: Connection,
  wallet: AnchorWallet
): Program<OnchainEncryptedImages> {
  const provider = getProvider(connection, wallet);
  return new Program(
    IDL as unknown as OnchainEncryptedImages,
    provider
  );
}

export interface ImageUploadAccount {
  publicKey: PublicKey;
  account: {
    authority: PublicKey;
    imageId: string;
    totalChunks: number;
    chunksUploaded: number;
    finalized: boolean;
    contentType: string;
    createdAt: { toNumber(): number };
    bump: number;
  };
}

export async function fetchImagesByAuthority(
  program: Program<OnchainEncryptedImages>,
  authority: PublicKey
): Promise<ImageUploadAccount[]> {
  const accounts = await program.account.imageUpload.all([
    {
      memcmp: {
        offset: 8, // Anchor discriminator
        bytes: authority.toBase58(),
      },
    },
  ]);
  return accounts as unknown as ImageUploadAccount[];
}
