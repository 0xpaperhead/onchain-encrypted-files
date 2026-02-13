use anchor_lang::prelude::*;

#[error_code]
pub enum ImageError {
    #[msg("Image ID exceeds maximum length of 64 characters")]
    ImageIdTooLong,
    #[msg("Total chunks must be greater than zero")]
    ZeroChunks,
    #[msg("Total chunks exceeds maximum of 10,000")]
    TooManyChunks,
    #[msg("Chunk data exceeds maximum size of 900 bytes")]
    ChunkDataTooLarge,
    #[msg("Chunk data must not be empty")]
    EmptyChunkData,
    #[msg("Chunk index does not match expected next chunk")]
    InvalidChunkIndex,
    #[msg("Upload is already finalized")]
    AlreadyFinalized,
    #[msg("Not all chunks have been uploaded")]
    IncompleteUpload,
    #[msg("Content type exceeds maximum length of 32 characters")]
    ContentTypeTooLong,
}
