import { Keypair, PublicKey } from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { chacha20poly1305 } from "@noble/ciphers/chacha.js";
import { randomBytes } from "@noble/ciphers/utils.js";
import { ed25519 } from "@noble/curves/ed25519";

const SEED_IMAGE = Buffer.from("image");
const CHUNK_SIZE = 900;

export function getImageUploadPda(
  programId: PublicKey,
  authority: PublicKey,
  imageId: string
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEED_IMAGE, authority.toBuffer(), Buffer.from(imageId)],
    programId
  );
}

export function signMessage(keypair: Keypair, message: Uint8Array): Uint8Array {
  const privateKey = keypair.secretKey.slice(0, 32);
  return ed25519.sign(message, privateKey);
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
  // Prepend nonce to ciphertext
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

export function chunkData(data: Uint8Array, chunkSize = CHUNK_SIZE): Buffer[] {
  const chunks: Buffer[] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(Buffer.from(data.slice(i, i + chunkSize)));
  }
  return chunks;
}

export function reassembleChunks(chunks: Buffer[]): Uint8Array {
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
