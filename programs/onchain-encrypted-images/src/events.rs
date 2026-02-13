use anchor_lang::prelude::*;

#[event]
pub struct UploadInitialized {
    pub authority: Pubkey,
    pub image_id: String,
    pub total_chunks: u32,
    pub content_type: String,
}

#[event]
pub struct ChunkUploaded {
    pub authority: Pubkey,
    pub image_id: String,
    pub chunk_index: u32,
    pub data: Vec<u8>,
}

#[event]
pub struct UploadFinalized {
    pub authority: Pubkey,
    pub image_id: String,
    pub total_chunks: u32,
}
