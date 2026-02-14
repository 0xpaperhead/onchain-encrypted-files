# Onchain Encrypted Images

Encrypted image storage on Solana. Images are encrypted client-side with ChaCha20-Poly1305, chunked into 900-byte segments, and stored on-chain via transaction events. Only the wallet that uploaded an image can decrypt it.

**Program ID:** `13ZhnnA6nfDW2H9g2LsY2dVPLjEnHTW4U51kTKWegENC`

## How It Works

### Upload
1. User selects an image file
2. Client requests a wallet signature over `"encrypt:{image_id}"`
3. Encryption key derived: `SHA256(signature)` (32 bytes)
4. Image encrypted with ChaCha20-Poly1305 (12-byte random nonce prepended)
5. Encrypted data chunked into 900-byte segments
6. Chunks uploaded on-chain via `initialize_upload` -> `upload_chunk` x N -> `finalize_upload`
7. Each chunk is emitted as a `ChunkUploaded` event in the transaction logs

### Decrypt
1. Fetch transaction signatures for the image's PDA
2. Parse `ChunkUploaded` events from transaction logs
3. Reassemble chunks into the encrypted blob
4. Request the same wallet signature, derive the same key
5. Decrypt with ChaCha20-Poly1305 -> original image

## Project Structure

```
programs/onchain-encrypted-images/   # Anchor program (Rust)
  src/
    lib.rs                           # Instructions: initialize_upload, upload_chunk, finalize_upload
    state.rs                         # ImageUpload account structure
    events.rs                        # UploadInitialized, ChunkUploaded, UploadFinalized
    error.rs                         # Custom error codes

app/                                 # React frontend
  src/
    components/                      # UploadPanel, GalleryPanel, ImageViewDialog, ImageCard
    hooks/                           # useImageUpload, useImageDecrypt, useGallery
    lib/
      crypto.ts                      # ChaCha20-Poly1305 encrypt/decrypt, key derivation
      anchor.ts                      # Anchor program interaction

tests/
  onchain-encrypted-images.test.ts   # Localnet tests (13 tests)
  devnet-smoke.test.ts               # Devnet smoke test (4 tests)
  utils/helpers.ts                   # Shared crypto and PDA helpers
```

## Prerequisites

- [Bun](https://bun.sh)
- [Rust](https://rustup.rs)
- [Solana CLI](https://docs.solanalabs.com/cli/install)
- [Anchor](https://www.anchor-lang.com/docs/installation)

## Setup

```bash
# Install dependencies
bun install
cd app && bun install

# Copy environment config
cp .env.example .env
```

## Build

```bash
# Build the Solana program
anchor build

# Build the frontend
cd app && bun run build.ts
```

## Test

```bash
# Localnet tests (starts a local validator)
bun run test

# Devnet smoke test (requires funded wallet and deployed program)
bun run test:devnet

# Type-check
bun run check
```

## Environment Variables

See `.env.example`:

| Variable | Default | Description |
|----------|---------|-------------|
| `DEVNET_RPC` | `https://api.devnet.solana.com` | RPC endpoint for devnet tests |
| `WALLET_PATH` | `~/.config/solana/id.json` | Path to Solana keypair |

## Program Instructions

| Instruction | Description |
|-------------|-------------|
| `initialize_upload(image_id, total_chunks, content_type)` | Creates an ImageUpload PDA account |
| `upload_chunk(chunk_index, data)` | Uploads a single chunk (max 900 bytes, must be sequential) |
| `finalize_upload()` | Marks the upload as complete |

## Constraints

| Limit | Value |
|-------|-------|
| Max image ID length | 64 characters |
| Max content type length | 32 characters |
| Chunk size | 900 bytes |
| Max chunks per image | 10,000 (~9 MB) |

## Tech Stack

- **Program:** Rust + Anchor 0.32
- **Frontend:** React 19, Tailwind CSS, Radix UI
- **Crypto:** `@noble/ciphers` (ChaCha20-Poly1305), `@noble/hashes` (SHA256)
- **Wallet:** Solana Wallet Adapter (Phantom)
- **Runtime:** Bun
