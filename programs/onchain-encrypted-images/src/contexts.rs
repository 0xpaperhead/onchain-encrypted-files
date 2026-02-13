use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::ImageUpload;

#[derive(Accounts)]
#[instruction(image_id: String, total_chunks: u32, content_type: String)]
pub struct InitializeUpload<'info> {
    #[account(
        init,
        payer = authority,
        space = ImageUpload::space(image_id.len(), content_type.len()),
        seeds = [SEED_IMAGE, authority.key().as_ref(), image_id.as_bytes()],
        bump,
    )]
    pub image_upload: Account<'info, ImageUpload>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UploadChunk<'info> {
    #[account(
        mut,
        has_one = authority,
        seeds = [SEED_IMAGE, authority.key().as_ref(), image_upload.image_id.as_bytes()],
        bump = image_upload.bump,
    )]
    pub image_upload: Account<'info, ImageUpload>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct FinalizeUpload<'info> {
    #[account(
        mut,
        has_one = authority,
        seeds = [SEED_IMAGE, authority.key().as_ref(), image_upload.image_id.as_bytes()],
        bump = image_upload.bump,
    )]
    pub image_upload: Account<'info, ImageUpload>,
    pub authority: Signer<'info>,
}
