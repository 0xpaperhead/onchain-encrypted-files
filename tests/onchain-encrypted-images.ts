import * as anchor from "@coral-xyz/anchor";
import { Program, EventParser } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { OnchainEncryptedImages } from "../target/types/onchain_encrypted_images";
import {
  getImageUploadPda,
  signMessage,
  deriveEncryptionKey,
  encryptData,
  decryptData,
  chunkData,
  reassembleChunks,
} from "./utils/helpers";

describe("onchain-encrypted-images", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .onchainEncryptedImages as Program<OnchainEncryptedImages>;
  const authority = provider.wallet;
  const authorityKeypair = (authority as anchor.Wallet).payer;

  // Test data
  const imageId = "test-image-001";
  const contentType = "image/png";
  let originalData: Uint8Array;
  let encryptedData: Uint8Array;
  let chunks: Buffer[];
  let encryptionKey: Uint8Array;
  let pda: PublicKey;
  let pdaBump: number;

  before(async () => {
    // Create 2500 bytes of deterministic test data (simulates an image)
    originalData = new Uint8Array(2500);
    for (let i = 0; i < originalData.length; i++) {
      originalData[i] = i % 256;
    }

    // Airdrop SOL
    const airdropSig = await provider.connection.requestAirdrop(
      authority.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    // Derive encryption key: sign a message and hash the signature
    const message = Buffer.from(`encrypt:${imageId}`);
    const signedMessage = signMessage(authorityKeypair, message);
    encryptionKey = deriveEncryptionKey(signedMessage);

    // Encrypt the data
    encryptedData = encryptData(encryptionKey, originalData);

    // Chunk the encrypted data
    chunks = chunkData(encryptedData);

    // Derive PDA
    [pda, pdaBump] = getImageUploadPda(
      program.programId,
      authority.publicKey,
      imageId
    );
  });

  describe("initialize_upload", () => {
    it("creates the image upload PDA with correct state", async () => {
      await program.methods
        .initializeUpload(imageId, chunks.length, contentType)
        .accounts({
          authority: authority.publicKey,
        })
        .rpc();

      const account = await program.account.imageUpload.fetch(pda);

      expect(account.authority.toBase58()).to.equal(
        authority.publicKey.toBase58()
      );
      expect(account.imageId).to.equal(imageId);
      expect(account.totalChunks).to.equal(chunks.length);
      expect(account.chunksUploaded).to.equal(0);
      expect(account.finalized).to.equal(false);
      expect(account.contentType).to.equal(contentType);
      expect(account.createdAt.toNumber()).to.be.greaterThan(0);
      expect(account.bump).to.equal(pdaBump);
    });

    it("rejects duplicate initialization (same image_id)", async () => {
      try {
        await program.methods
          .initializeUpload(imageId, chunks.length, contentType)
          .accounts({
            authority: authority.publicKey,
          })
          .rpc();
        expect.fail("should have thrown");
      } catch (err: any) {
        // Account already initialized — Anchor/Solana will reject
        expect(err).to.exist;
      }
    });

    it("rejects zero chunks", async () => {
      const zeroChunkId = "zero-chunk-test";
      try {
        await program.methods
          .initializeUpload(zeroChunkId, 0, contentType)
          .accounts({
            authority: authority.publicKey,
          })
          .rpc();
        expect.fail("should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("ZeroChunks");
      }
    });
  });

  describe("upload_chunk", () => {
    it("uploads all chunks sequentially", async () => {
      for (let i = 0; i < chunks.length; i++) {
        await program.methods
          .uploadChunk(i, chunks[i])
          .accounts({
            authority: authority.publicKey,
            imageUpload: pda,
          })
          .rpc();
      }

      const account = await program.account.imageUpload.fetch(pda);
      expect(account.chunksUploaded).to.equal(chunks.length);
    });

    it("rejects out-of-order chunk upload", async () => {
      const oooId = "out-of-order-test";
      const [oooPda] = getImageUploadPda(
        program.programId,
        authority.publicKey,
        oooId
      );

      await program.methods
        .initializeUpload(oooId, 3, contentType)
        .accounts({
          authority: authority.publicKey,
        })
        .rpc();

      // Try to upload chunk 1 before chunk 0
      try {
        await program.methods
          .uploadChunk(1, Buffer.from([1, 2, 3]))
          .accounts({
            authority: authority.publicKey,
            imageUpload: oooPda,
          })
          .rpc();
        expect.fail("should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidChunkIndex");
      }
    });

    it("rejects oversized chunk data", async () => {
      const oversizedId = "oversized-test";
      const [oversizedPda] = getImageUploadPda(
        program.programId,
        authority.publicKey,
        oversizedId
      );

      await program.methods
        .initializeUpload(oversizedId, 1, contentType)
        .accounts({
          authority: authority.publicKey,
        })
        .rpc();

      const oversizedData = Buffer.alloc(901);
      try {
        await program.methods
          .uploadChunk(0, oversizedData)
          .accounts({
            authority: authority.publicKey,
            imageUpload: oversizedPda,
          })
          .rpc();
        expect.fail("should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("ChunkDataTooLarge");
      }
    });

    it("rejects empty chunk data", async () => {
      const emptyId = "empty-chunk-test";
      const [emptyPda] = getImageUploadPda(
        program.programId,
        authority.publicKey,
        emptyId
      );

      await program.methods
        .initializeUpload(emptyId, 1, contentType)
        .accounts({
          authority: authority.publicKey,
        })
        .rpc();

      try {
        await program.methods
          .uploadChunk(0, Buffer.alloc(0))
          .accounts({
            authority: authority.publicKey,
            imageUpload: emptyPda,
          })
          .rpc();
        expect.fail("should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("EmptyChunkData");
      }
    });

    it("rejects unauthorized uploader", async () => {
      const unauthorizedId = "unauthorized-test";
      const [unauthorizedPda] = getImageUploadPda(
        program.programId,
        authority.publicKey,
        unauthorizedId
      );

      await program.methods
        .initializeUpload(unauthorizedId, 1, contentType)
        .accounts({
          authority: authority.publicKey,
        })
        .rpc();

      const fakeAuthority = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(
        fakeAuthority.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      try {
        await program.methods
          .uploadChunk(0, Buffer.from([1, 2, 3]))
          .accounts({
            authority: fakeAuthority.publicKey,
            imageUpload: unauthorizedPda,
          })
          .signers([fakeAuthority])
          .rpc();
        expect.fail("should have thrown");
      } catch (err: any) {
        // has_one constraint fails — seeds mismatch or constraint violation
        expect(err).to.exist;
      }
    });
  });

  describe("finalize_upload", () => {
    it("rejects finalization when not all chunks uploaded", async () => {
      const incompleteId = "incomplete-test";
      const [incompletePda] = getImageUploadPda(
        program.programId,
        authority.publicKey,
        incompleteId
      );

      await program.methods
        .initializeUpload(incompleteId, 3, contentType)
        .accounts({
          authority: authority.publicKey,
        })
        .rpc();

      // Upload only 1 of 3 chunks
      await program.methods
        .uploadChunk(0, Buffer.from([1, 2, 3]))
        .accounts({
          authority: authority.publicKey,
          imageUpload: incompletePda,
        })
        .rpc();

      try {
        await program.methods
          .finalizeUpload()
          .accounts({
            authority: authority.publicKey,
            imageUpload: incompletePda,
          })
          .rpc();
        expect.fail("should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("IncompleteUpload");
      }
    });

    it("finalizes upload when all chunks are uploaded", async () => {
      await program.methods
        .finalizeUpload()
        .accounts({
          authority: authority.publicKey,
          imageUpload: pda,
        })
        .rpc();

      const account = await program.account.imageUpload.fetch(pda);
      expect(account.finalized).to.equal(true);
    });

    it("rejects double finalization", async () => {
      try {
        await program.methods
          .finalizeUpload()
          .accounts({
            authority: authority.publicKey,
            imageUpload: pda,
          })
          .rpc();
        expect.fail("should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("AlreadyFinalized");
      }
    });

    it("rejects chunk upload after finalization", async () => {
      try {
        await program.methods
          .uploadChunk(chunks.length, Buffer.from([1, 2, 3]))
          .accounts({
            authority: authority.publicKey,
            imageUpload: pda,
          })
          .rpc();
        expect.fail("should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("AlreadyFinalized");
      }
    });
  });

  describe("round-trip reconstruction", () => {
    it("reconstructs and decrypts the original image from the ledger", async () => {
      // 1. Fetch metadata from PDA
      const account = await program.account.imageUpload.fetch(pda);
      expect(account.finalized).to.equal(true);
      const totalChunks = account.totalChunks;

      // 2. Get all transaction signatures involving the PDA
      const signatures = await provider.connection.getSignaturesForAddress(
        pda,
        undefined,
        "confirmed"
      );

      // 3. Fetch all transactions
      const txs = await provider.connection.getTransactions(
        signatures.map((s) => s.signature),
        { maxSupportedTransactionVersion: 0, commitment: "confirmed" }
      );

      // 4. Parse ChunkUploaded events from transaction logs
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

      // 5. Sort by chunk_index and reassemble
      chunkEvents.sort((a, b) => a.chunkIndex - b.chunkIndex);
      expect(chunkEvents.length).to.equal(totalChunks);

      const reassembledChunks = chunkEvents.map((e) => e.data);
      const reassembledEncrypted = reassembleChunks(reassembledChunks);

      // Verify reassembled encrypted data matches original encrypted data
      expect(
        Buffer.from(reassembledEncrypted).equals(Buffer.from(encryptedData))
      ).to.be.true;

      // 6. Re-derive encryption key (sign same message again)
      const message = Buffer.from(`encrypt:${imageId}`);
      const signedMessage = signMessage(authorityKeypair, message);
      const derivedKey = deriveEncryptionKey(signedMessage);

      // 7. Decrypt
      const decrypted = decryptData(derivedKey, reassembledEncrypted);

      // 8. Assert it matches the original
      expect(Buffer.from(decrypted).equals(Buffer.from(originalData))).to.be
        .true;
    });
  });
});
