# Onchain Encrypted Images - Complete Flow

## Flow 1: Upload (Encrypt + Store On-Chain)

```
USER clicks "Encrypt & Upload to Solana"
|
+- 1. GENERATE IMAGE ID (client-side, no RPC)
|     generateImageId()
|     \- randomBytes(16) -> hex string (e.g. "a3f1...b2c0")
|
+- 2. READ FILE (client-side, no RPC)
|     file.arrayBuffer() -> Uint8Array plaintext
|
+- 3. SIGN MESSAGE (wallet popup)
|     wallet.signMessage("encrypt:<imageId>")
|     \- User approves in wallet
|     \- Returns: 64-byte ed25519 signature
|
+- 4. DERIVE KEY (client-side, no RPC)
|     deriveEncryptionKey(signature)
|     \- sha256(signature) -> 32-byte key
|
+- 5. ENCRYPT (client-side, no RPC)
|     encryptData(key, plaintext)
|     +- nonce = randomBytes(12)
|     +- ciphertext = chacha20poly1305(key, nonce).encrypt(plaintext)
|     \- Returns: [12B nonce | ciphertext+16B tag]
|
+- 6. CHUNK (client-side, no RPC)
|     chunkData(encrypted, 900)
|     \- Splits into 900-byte chunks -> Uint8Array[]
|
+- 7. INITIALIZE UPLOAD (1 RPC call + 1 wallet signature)
|     program.methods.initializeUpload(imageId, totalChunks, contentType)
|     +- RPC: simulateTransaction (preflight)
|     +- Wallet popup: sign transaction
|     +- RPC: sendTransaction
|     \- On-chain: Creates PDA account
|          PDA seeds: ["image", authority, imageId]
|          Stores: authority, imageId, totalChunks, contentType, createdAt
|
+- 8. UPLOAD CHUNKS (N iterations, each = 1 RPC + 1 wallet signature)
|     for i in 0..chunks.length:
|       program.methods.uploadChunk(i, chunkData)
|       +- RPC: simulateTransaction
|       +- Wallet popup: sign transaction
|       +- RPC: sendTransaction
|       \- On-chain: Validates chunk index, increments chunksUploaded
|            Emits event: ChunkUploaded { imageId, chunkIndex, data }
|            NOTE: Chunk data lives ONLY in tx logs, NOT in account storage
|
\- 9. FINALIZE UPLOAD (1 RPC call + 1 wallet signature)
      program.methods.finalizeUpload()
      +- RPC: simulateTransaction
      +- Wallet popup: sign transaction
      +- RPC: sendTransaction
      \- On-chain: Asserts chunksUploaded == totalChunks, sets finalized=true
           Emits event: UploadFinalized { imageId }
```

**Total RPC calls for upload:** ~`2 + 2*N + 2` (simulate+send per tx, where N = chunk count)
**Total wallet signatures:** `1 (signMessage) + 1 (init) + N (chunks) + 1 (finalize)` = `N + 3`

---

## Flow 2: Gallery (List Images)

```
USER navigates to Gallery tab (or wallet connects)
|
\- useGallery() -> refresh()
      |
      \- 1. FETCH ALL IMAGE ACCOUNTS (1 RPC call)
            program.account.imageUpload.all([memcmp filter])
            +- RPC: getProgramAccounts
            |    endpoint: https://api.devnet.solana.com
            |    filter: memcmp at offset 8 = authority pubkey
            \- Returns: Array of { publicKey, account } where account has:
                 { authority, imageId, totalChunks, chunksUploaded,
                   finalized, contentType, createdAt, bump }
            |
            \- Client sorts by createdAt DESC
            \- Renders ImageCard for each
```

**Total RPC calls:** 1 (`getProgramAccounts` with memcmp filter)

---

## Flow 3: Decrypt + View Image

```
USER clicks "View" on an ImageCard
|
+- ImageViewDialog opens -> triggers useImageDecrypt.decrypt(imageId, contentType)
|
+- 1. SIGN MESSAGE (wallet popup)
|     wallet.signMessage("encrypt:<imageId>")
|     \- Same message as upload -> same signature -> same key
|     \- Returns: 64-byte signature
|
+- 2. DERIVE KEY (client-side, no RPC)
|     deriveEncryptionKey(signature)
|     \- sha256(signature) -> 32-byte key (identical to upload key)
|
+- 3. COMPUTE PDA (client-side, no RPC)
|     getImageUploadPda(PROGRAM_ID, publicKey, imageId)
|     \- PDA seeds: ["image", authority, imageId]
|
+- 4. FETCH TX SIGNATURES FOR PDA (1 RPC call)
|     connection.getSignaturesForAddress(pda)
|     +- RPC: getSignaturesForAddress
|     \- Returns: all tx signatures that touched this PDA
|          (includes initializeUpload, uploadChunk x N, finalizeUpload)
|
+- 5. FETCH EACH TRANSACTION (N+2 RPC calls, sequential w/ 400ms delay)
|     for each signature:                          <-- RATE LIMIT BOTTLENECK
|       connection.getTransaction(sig)
|       +- RPC: getTransaction
|       +- wait 400ms
|       \- Returns: full tx with meta.logMessages
|
+- 6. PARSE CHUNK EVENTS (client-side, no RPC)
|     EventParser.parseLogs(tx.meta.logMessages)
|     \- Finds "chunkUploaded" events -> extracts { chunkIndex, data }
|     \- Sorts by chunkIndex
|
+- 7. REASSEMBLE (client-side, no RPC)
|     reassembleChunks(sortedChunks)
|     \- Concatenates all chunk data -> single Uint8Array
|        [12B nonce | ciphertext | 16B tag]
|
+- 8. DECRYPT (client-side, no RPC)
|     decryptData(key, reassembled)
|     +- nonce = first 12 bytes
|     +- ciphertext = remaining bytes
|     \- chacha20poly1305(key, nonce).decrypt(ciphertext) -> plaintext
|
\- 9. DISPLAY (client-side, no RPC)
      new Blob([plaintext], { type: contentType })
      \- URL.createObjectURL(blob) -> <img src={url} />
```

**Total RPC calls for decrypt:** `1 + (N+2)` where N = number of chunks
**Rate limit problem:** Step 5 fires `N+2` sequential `getTransaction` calls. For a 50-chunk image that's 52 RPC calls, taking ~21 seconds even with 400ms delays. The public devnet RPC (`api.devnet.solana.com`) aggressively rate-limits at ~2 req/s.

---

## RPC Call Summary

| Operation | RPC Method | Count | Rate Limit Risk |
|---|---|---|---|
| **Upload: init** | `sendTransaction` | 1 | Low |
| **Upload: chunks** | `sendTransaction` | N | Medium (sequential) |
| **Upload: finalize** | `sendTransaction` | 1 | Low |
| **Gallery** | `getProgramAccounts` | 1 | Low |
| **Decrypt: get sigs** | `getSignaturesForAddress` | 1 | Low |
| **Decrypt: get txs** | `getTransaction` | N+2 | **HIGH** |

---

## Key Files

| File | Role |
|---|---|
| `app/src/lib/crypto.ts` | Encryption/decryption, chunking, PDA derivation, key derivation |
| `app/src/lib/anchor.ts` | Anchor program/provider setup, `fetchImagesByAuthority` |
| `app/src/lib/constants.ts` | Program ID, RPC URL, chunk size, seeds |
| `app/src/hooks/useImageUpload.ts` | Full upload flow (sign -> encrypt -> init -> chunks -> finalize) |
| `app/src/hooks/useGallery.ts` | Fetch and list user's image accounts |
| `app/src/hooks/useImageDecrypt.ts` | Full decrypt flow (sign -> fetch txs -> parse events -> decrypt) |
| `app/src/components/WalletProvider.tsx` | Solana wallet adapter setup (ConnectionProvider, WalletProvider, WalletModalProvider) |
| `app/src/components/UploadPanel.tsx` | Upload UI (file picker, progress, status) |
| `app/src/components/GalleryPanel.tsx` | Gallery UI (grid of ImageCards) |
| `app/src/components/ImageCard.tsx` | Single image metadata card |
| `app/src/components/ImageViewDialog.tsx` | Decrypt-and-display dialog |

---

## On-Chain Program

**Program ID:** `13ZhnnA6nfDW2H9g2LsY2dVPLjEnHTW4U51kTKWegENC`

### Instructions

| Instruction | Accounts | Args | Effect |
|---|---|---|---|
| `initializeUpload` | authority (signer), imageUpload (PDA, init), systemProgram | imageId, totalChunks, contentType | Creates PDA account with metadata |
| `uploadChunk` | authority (signer), imageUpload (PDA, mut) | chunkIndex, data | Validates ordering, emits ChunkUploaded event |
| `finalizeUpload` | authority (signer), imageUpload (PDA, mut) | (none) | Asserts all chunks uploaded, sets finalized=true |

### Account: ImageUpload (PDA)

Seeds: `["image", authority_pubkey, image_id_bytes]`

| Field | Type | Description |
|---|---|---|
| authority | Pubkey | Owner who uploaded |
| imageId | String | Unique identifier |
| totalChunks | u32 | Expected number of chunks |
| chunksUploaded | u32 | Counter incremented per uploadChunk |
| finalized | bool | Set true by finalizeUpload |
| contentType | String | MIME type (e.g. "image/png") |
| createdAt | i64 | Unix timestamp |
| bump | u8 | PDA bump seed |

### Events

| Event | Fields | Emitted By |
|---|---|---|
| ChunkUploaded | imageId, chunkIndex, data (Vec\<u8\>) | uploadChunk |
| UploadFinalized | imageId | finalizeUpload |
| UploadInitialized | imageId, totalChunks | initializeUpload |
