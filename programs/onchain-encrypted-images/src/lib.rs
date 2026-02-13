use anchor_lang::prelude::*;

pub mod constants;
pub mod contexts;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use contexts::*;

declare_id!("13ZhnnA6nfDW2H9g2LsY2dVPLjEnHTW4U51kTKWegENC");

#[program]
pub mod onchain_encrypted_images {
    use super::*;

    pub fn initialize_upload(
        ctx: Context<InitializeUpload>,
        image_id: String,
        total_chunks: u32,
        content_type: String,
    ) -> Result<()> {
        instructions::initialize_upload(ctx, image_id, total_chunks, content_type)
    }

    pub fn upload_chunk(
        ctx: Context<UploadChunk>,
        chunk_index: u32,
        data: Vec<u8>,
    ) -> Result<()> {
        instructions::upload_chunk(ctx, chunk_index, data)
    }

    pub fn finalize_upload(ctx: Context<FinalizeUpload>) -> Result<()> {
        instructions::finalize_upload(ctx)
    }
}
