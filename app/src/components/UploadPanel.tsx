import { useState, useRef, type ChangeEvent } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useImageUpload } from "@/hooks/useImageUpload";

export function UploadPanel({ onUploadComplete }: { onUploadComplete?: () => void }) {
  const { connected } = useWallet();
  const { upload, status, progress, error, txSignature, reset } =
    useImageUpload();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    // Create preview
    const url = URL.createObjectURL(selected);
    setPreview(url);
  }

  async function handleUpload() {
    if (!file) return;
    await upload(file);
    onUploadComplete?.();
  }

  function handleReset() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    reset();
  }

  const isUploading = status !== "idle" && status !== "done" && status !== "error";
  const progressPercent =
    progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  const statusText: Record<string, string> = {
    idle: "",
    signing: "Requesting signature for encryption key...",
    encrypting: "Encrypting image...",
    initializing: "Initializing upload on-chain...",
    uploading: `Uploading chunk ${progress.current}/${progress.total}...`,
    finalizing: "Finalizing upload...",
    done: "Upload complete!",
    error: "Upload failed",
  };

  if (!connected) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Connect your wallet to upload images.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* File input */}
      <Card>
        <CardContent className="pt-6">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isUploading}
            className="block w-full text-sm text-muted-foreground
              file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0
              file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground
              hover:file:bg-primary/90 file:cursor-pointer"
          />
        </CardContent>
      </Card>

      {/* Preview */}
      {preview && (
        <Card>
          <CardContent className="pt-6 flex justify-center">
            <img
              src={preview}
              alt="Preview"
              className="max-h-64 rounded-md object-contain"
            />
          </CardContent>
        </Card>
      )}

      {/* Upload button */}
      {file && status === "idle" && (
        <div className="flex gap-2">
          <Button onClick={handleUpload} className="flex-1">
            Encrypt & Upload to Solana
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Clear
          </Button>
        </div>
      )}

      {/* Progress */}
      {isUploading && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{statusText[status]}</p>
          {status === "uploading" && (
            <Progress value={progressPercent} />
          )}
        </div>
      )}

      {/* Success */}
      {status === "done" && (
        <Alert>
          <AlertDescription>
            Image encrypted and uploaded on-chain!
            {txSignature && (
              <a
                href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 underline text-primary"
              >
                View transaction
              </a>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Reset after done/error */}
      {(status === "done" || status === "error") && (
        <Button variant="outline" onClick={handleReset} className="w-full">
          Upload Another
        </Button>
      )}
    </div>
  );
}
