use anchor_lang::prelude::*;
use crate::constants::*;
use crate::contexts::*;
use crate::error::ImageError;
use crate::events::*;

pub fn initialize_upload(
    ctx: Context<InitializeUpload>,
    image_id: String,
    total_chunks: u32,
    content_type: String,
) -> Result<()> {
    require!(image_id.len() <= MAX_IMAGE_ID_LENGTH, ImageError::ImageIdTooLong);
    require!(total_chunks > 0, ImageError::ZeroChunks);
    require!(total_chunks <= MAX_TOTAL_CHUNKS, ImageError::TooManyChunks);
    require!(content_type.len() <= MAX_CONTENT_TYPE_LENGTH, ImageError::ContentTypeTooLong);

    let upload = &mut ctx.accounts.image_upload;
    upload.authority = ctx.accounts.authority.key();
    upload.image_id = image_id.clone();
    upload.total_chunks = total_chunks;
    upload.chunks_uploaded = 0;
    upload.finalized = false;
    upload.content_type = content_type.clone();
    upload.created_at = Clock::get()?.unix_timestamp;
    upload.bump = ctx.bumps.image_upload;

    emit!(UploadInitialized {
        authority: upload.authority,
        image_id,
        total_chunks,
        content_type,
    });

    Ok(())
}

pub fn upload_chunk(
    ctx: Context<UploadChunk>,
    chunk_index: u32,
    data: Vec<u8>,
) -> Result<()> {
    let upload = &mut ctx.accounts.image_upload;

    require!(!upload.finalized, ImageError::AlreadyFinalized);
    require!(!data.is_empty(), ImageError::EmptyChunkData);
    require!(data.len() <= MAX_CHUNK_DATA_SIZE, ImageError::ChunkDataTooLarge);
    require!(chunk_index == upload.chunks_uploaded, ImageError::InvalidChunkIndex);

    upload.chunks_uploaded += 1;

    emit!(ChunkUploaded {
        authority: upload.authority,
        image_id: upload.image_id.clone(),
        chunk_index,
        data,
    });

    Ok(())
}

pub fn finalize_upload(ctx: Context<FinalizeUpload>) -> Result<()> {
    let upload = &mut ctx.accounts.image_upload;

    require!(!upload.finalized, ImageError::AlreadyFinalized);
    require!(
        upload.chunks_uploaded == upload.total_chunks,
        ImageError::IncompleteUpload
    );

    upload.finalized = true;

    emit!(UploadFinalized {
        authority: upload.authority,
        image_id: upload.image_id.clone(),
        total_chunks: upload.total_chunks,
    });

    Ok(())
}
