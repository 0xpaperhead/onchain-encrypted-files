/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/onchain_encrypted_images.json`.
 */
export type OnchainEncryptedImages = {
  "address": "13ZhnnA6nfDW2H9g2LsY2dVPLjEnHTW4U51kTKWegENC",
  "metadata": {
    "name": "onchainEncryptedImages",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "finalizeUpload",
      "discriminator": [
        13,
        254,
        103,
        85,
        77,
        3,
        111,
        129
      ],
      "accounts": [
        {
          "name": "imageUpload",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  109,
                  97,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "account",
                "path": "image_upload.image_id",
                "account": "imageUpload"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "imageUpload"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "initializeUpload",
      "discriminator": [
        1,
        241,
        34,
        247,
        238,
        4,
        239,
        29
      ],
      "accounts": [
        {
          "name": "imageUpload",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  109,
                  97,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "arg",
                "path": "imageId"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "imageId",
          "type": "string"
        },
        {
          "name": "totalChunks",
          "type": "u32"
        },
        {
          "name": "contentType",
          "type": "string"
        }
      ]
    },
    {
      "name": "uploadChunk",
      "discriminator": [
        130,
        219,
        165,
        153,
        119,
        149,
        252,
        162
      ],
      "accounts": [
        {
          "name": "imageUpload",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  109,
                  97,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "account",
                "path": "image_upload.image_id",
                "account": "imageUpload"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "imageUpload"
          ]
        }
      ],
      "args": [
        {
          "name": "chunkIndex",
          "type": "u32"
        },
        {
          "name": "data",
          "type": "bytes"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "imageUpload",
      "discriminator": [
        184,
        41,
        85,
        198,
        3,
        241,
        39,
        215
      ]
    }
  ],
  "events": [
    {
      "name": "chunkUploaded",
      "discriminator": [
        179,
        164,
        69,
        179,
        35,
        219,
        108,
        139
      ]
    },
    {
      "name": "uploadFinalized",
      "discriminator": [
        35,
        112,
        32,
        41,
        225,
        22,
        159,
        179
      ]
    },
    {
      "name": "uploadInitialized",
      "discriminator": [
        31,
        112,
        119,
        131,
        1,
        69,
        98,
        118
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "imageIdTooLong",
      "msg": "Image ID exceeds maximum length of 64 characters"
    },
    {
      "code": 6001,
      "name": "zeroChunks",
      "msg": "Total chunks must be greater than zero"
    },
    {
      "code": 6002,
      "name": "tooManyChunks",
      "msg": "Total chunks exceeds maximum of 10,000"
    },
    {
      "code": 6003,
      "name": "chunkDataTooLarge",
      "msg": "Chunk data exceeds maximum size of 900 bytes"
    },
    {
      "code": 6004,
      "name": "emptyChunkData",
      "msg": "Chunk data must not be empty"
    },
    {
      "code": 6005,
      "name": "invalidChunkIndex",
      "msg": "Chunk index does not match expected next chunk"
    },
    {
      "code": 6006,
      "name": "alreadyFinalized",
      "msg": "Upload is already finalized"
    },
    {
      "code": 6007,
      "name": "incompleteUpload",
      "msg": "Not all chunks have been uploaded"
    },
    {
      "code": 6008,
      "name": "contentTypeTooLong",
      "msg": "Content type exceeds maximum length of 32 characters"
    }
  ],
  "types": [
    {
      "name": "chunkUploaded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "imageId",
            "type": "string"
          },
          {
            "name": "chunkIndex",
            "type": "u32"
          },
          {
            "name": "data",
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "imageUpload",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "imageId",
            "type": "string"
          },
          {
            "name": "totalChunks",
            "type": "u32"
          },
          {
            "name": "chunksUploaded",
            "type": "u32"
          },
          {
            "name": "finalized",
            "type": "bool"
          },
          {
            "name": "contentType",
            "type": "string"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "uploadFinalized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "imageId",
            "type": "string"
          },
          {
            "name": "totalChunks",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "uploadInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "imageId",
            "type": "string"
          },
          {
            "name": "totalChunks",
            "type": "u32"
          },
          {
            "name": "contentType",
            "type": "string"
          }
        ]
      }
    }
  ]
};
