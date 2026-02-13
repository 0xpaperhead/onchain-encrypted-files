import { PublicKey } from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { chacha20poly1305 } from "@noble/ciphers/chacha.js";
import { randomBytes } from "@noble/ciphers/utils.js";
import { SEED_IMAGE, CHUNK_SIZE } from "./constants";

export function getImageUploadPda(
  programId: PublicKey,
  authority: PublicKey,
  imageId: string
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEED_IMAGE, authority.toBytes(), new TextEncoder().encode(imageId)],
    programId
  );
}

export function deriveEncryptionKey(signature: Uint8Array): Uint8Array {
  return sha256(signature);
}

export function encryptData(
  key: Uint8Array,
  plaintext: Uint8Array
): Uint8Array {
  const nonce = randomBytes(12);
  const cipher = chacha20poly1305(key, nonce);
  const ciphertext = cipher.encrypt(plaintext);
  const result = new Uint8Array(nonce.length + ciphertext.length);
  result.set(nonce, 0);
  result.set(ciphertext, nonce.length);
  return result;
}

export function decryptData(
  key: Uint8Array,
  encrypted: Uint8Array
): Uint8Array {
  const nonce = encrypted.slice(0, 12);
  const ciphertext = encrypted.slice(12);
  const cipher = chacha20poly1305(key, nonce);
  return cipher.decrypt(ciphertext);
}

export function chunkData(
  data: Uint8Array,
  chunkSize = CHUNK_SIZE
): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  return chunks;
}

export function reassembleChunks(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function generateImageId(): string {
  const bytes = randomBytes(16);
  return Array.from(bytes as Uint8Array<ArrayBuffer>)
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");
}
