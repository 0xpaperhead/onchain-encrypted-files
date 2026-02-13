use anchor_lang::prelude::*;

#[account]
pub struct ImageUpload {
    pub authority: Pubkey,      // 32
    pub image_id: String,       // 4 + len
    pub total_chunks: u32,      // 4
    pub chunks_uploaded: u32,   // 4
    pub finalized: bool,        // 1
    pub content_type: String,   // 4 + len
    pub created_at: i64,        // 8
    pub bump: u8,               // 1
}

impl ImageUpload {
    pub const fn space(image_id_len: usize, content_type_len: usize) -> usize {
        8  // discriminator
        + 32 // authority
        + 4 + image_id_len // image_id (String)
        + 4  // total_chunks
        + 4  // chunks_uploaded
        + 1  // finalized
        + 4 + content_type_len // content_type (String)
        + 8  // created_at
        + 1  // bump
    }
}
