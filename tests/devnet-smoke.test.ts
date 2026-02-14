import * as anchor from "@coral-xyz/anchor";
import { Program, EventParser } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { describe, it, expect, beforeAll } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { OnchainEncryptedImages } from "../target/types/onchain_encrypted_images";
import idl from "../target/idl/onchain_encrypted_images.json";
import {
  getImageUploadPda,
  signMessage,
  deriveEncryptionKey,
  encryptData,
  decryptData,
  chunkData,
  reassembleChunks,
} from "./utils/helpers";

describe("devnet smoke test", () => {
  const rpcUrl = process.env.DEVNET_RPC || "https://api.devnet.solana.com";
  const walletPath = (
    process.env.WALLET_PATH || "~/.config/solana/id.json"
  ).replace("~", process.env.HOME!);
  const connection = new Connection(rpcUrl, "confirmed");
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(walletPath, "utf-8")))
  );
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const program = new Program<OnchainEncryptedImages>(
    idl as OnchainEncryptedImages,
    provider
  );

  const imageId = `smoke-${Date.now()}`;
  const contentType = "image/jpeg";
  let originalData: Uint8Array;
  let encryptedData: Uint8Array;
  let chunks: Buffer[];
  let encryptionKey: Uint8Array;
  let pda: PublicKey;
  let pdaBump: number;

  beforeAll(async () => {
    // Check balance, airdrop if needed
    const balance = await connection.getBalance(wallet.publicKey);
    if (balance < 0.5 * anchor.web3.LAMPORTS_PER_SOL) {
      console.log("Low balance, requesting airdrop...");
      try {
        const sig = await connection.requestAirdrop(
          wallet.publicKey,
          2 * anchor.web3.LAMPORTS_PER_SOL
        );
        await connection.confirmTransaction(sig);
      } catch {
        throw new Error(
          "Airdrop failed (rate-limited). Fund manually: solana airdrop 2 --url devnet"
        );
      }
    }

    // Load actual test image
    const imagePath = join(__dirname, "middle-finger.jpg");
    originalData = new Uint8Array(readFileSync(imagePath));

    // Derive encryption key
    const message = Buffer.from(`encrypt:${imageId}`);
    const signedMessage = signMessage(walletKeypair, message);
    encryptionKey = deriveEncryptionKey(signedMessage);

    // Encrypt and chunk
    encryptedData = encryptData(encryptionKey, originalData);
    chunks = chunkData(encryptedData);

    // Derive PDA
    [pda, pdaBump] = getImageUploadPda(
      program.programId,
      wallet.publicKey,
      imageId
    );

    console.log(`Image ID: ${imageId}`);
    console.log(`Image size: ${originalData.length} bytes`);
    console.log(`Encrypted size: ${encryptedData.length} bytes`);
    console.log(`Chunks: ${chunks.length}`);
    console.log(`PDA: ${pda.toBase58()}`);
  });

  it("initializes upload", async () => {
    await program.methods
      .initializeUpload(imageId, chunks.length, contentType)
      .accounts({
        authority: wallet.publicKey,
      })
      .rpc();

    const account = await program.account.imageUpload.fetch(pda);
    expect(account.authority.toBase58()).toBe(wallet.publicKey.toBase58());
    expect(account.imageId).toBe(imageId);
    expect(account.totalChunks).toBe(chunks.length);
    expect(account.chunksUploaded).toBe(0);
    expect(account.finalized).toBe(false);
    expect(account.contentType).toBe(contentType);
    expect(account.bump).toBe(pdaBump);
  });

  it("uploads all chunks", async () => {
    for (let i = 0; i < chunks.length; i++) {
      await program.methods
        .uploadChunk(i, chunks[i])
        .accounts({
          authority: wallet.publicKey,
          imageUpload: pda,
        })
        .rpc();

      if ((i + 1) % 10 === 0 || i === chunks.length - 1) {
        console.log(`  uploaded chunk ${i + 1}/${chunks.length}`);
      }
    }

    const account = await program.account.imageUpload.fetch(pda);
    expect(account.chunksUploaded).toBe(chunks.length);
  });

  it("finalizes upload", async () => {
    await program.methods
      .finalizeUpload()
      .accounts({
        authority: wallet.publicKey,
        imageUpload: pda,
      })
      .rpc();

    const account = await program.account.imageUpload.fetch(pda);
    expect(account.finalized).toBe(true);
  });

  it("reconstructs and decrypts the original image from the ledger", async () => {
    // Wait for rate limit to reset after chunk uploads
    console.log("  waiting for rate limit cooldown...");
    await new Promise((r) => setTimeout(r, 10_000));

    const account = await program.account.imageUpload.fetch(pda);
    expect(account.finalized).toBe(true);
    const totalChunks = account.totalChunks;

    // Get all transaction signatures involving the PDA
    const signatures = await connection.getSignaturesForAddress(
      pda,
      undefined,
      "confirmed"
    );

    // Fetch transactions one at a time to avoid rate limiting
    const txs = [];
    for (const sig of signatures) {
      const [tx] = await connection.getTransactions([sig.signature], {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });
      txs.push(tx);
      await new Promise((r) => setTimeout(r, 200));
    }

    // Parse ChunkUploaded events from transaction logs
    const eventParser = new EventParser(program.programId, program.coder);
    const chunkEvents: { chunkIndex: number; data: Buffer }[] = [];

    for (const tx of txs) {
      if (!tx?.meta?.logMessages) continue;
      for (const event of eventParser.parseLogs(tx.meta.logMessages)) {
        if (event.name === "chunkUploaded") {
          chunkEvents.push({
            chunkIndex: event.data.chunkIndex,
            data: Buffer.from(event.data.data),
          });
        }
      }
    }

    // Sort by chunk_index and reassemble
    chunkEvents.sort((a, b) => a.chunkIndex - b.chunkIndex);
    expect(chunkEvents.length).toBe(totalChunks);

    const reassembledChunks = chunkEvents.map((e) => e.data);
    const reassembledEncrypted = reassembleChunks(reassembledChunks);

    expect(
      Buffer.from(reassembledEncrypted).equals(Buffer.from(encryptedData))
    ).toBe(true);

    // Re-derive encryption key and decrypt
    const message = Buffer.from(`encrypt:${imageId}`);
    const signedMessage = signMessage(walletKeypair, message);
    const derivedKey = deriveEncryptionKey(signedMessage);
    const decrypted = decryptData(derivedKey, reassembledEncrypted);

    expect(Buffer.from(decrypted).equals(Buffer.from(originalData))).toBe(true);
    console.log("Round-trip verified: decrypted image matches original");
  });
});
