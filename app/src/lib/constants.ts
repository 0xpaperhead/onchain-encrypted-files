import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "13ZhnnA6nfDW2H9g2LsY2dVPLjEnHTW4U51kTKWegENC"
);

export const DEVNET_RPC = "https://api.devnet.solana.com";

export const SEED_IMAGE = new TextEncoder().encode("image");

export const CHUNK_SIZE = 900;

export const MAX_TOTAL_CHUNKS = 10_000;
export const MAX_IMAGE_ID_LENGTH = 64;
export const MAX_CONTENT_TYPE_LENGTH = 32;
