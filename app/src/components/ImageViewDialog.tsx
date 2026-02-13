import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useImageDecrypt } from "@/hooks/useImageDecrypt";
import { useEffect } from "react";

interface ImageViewDialogProps {
  imageId: string | null;
  contentType: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageViewDialog({
  imageId,
  contentType,
  open,
  onOpenChange,
}: ImageViewDialogProps) {
  const { decrypt, status, imageUrl, error, reset } = useImageDecrypt();

  useEffect(() => {
    if (open && imageId && contentType && status === "idle") {
      decrypt(imageId, contentType);
    }
  }, [open, imageId, contentType, decrypt, status]);

  function handleClose(isOpen: boolean) {
    if (!isOpen) {
      reset();
    }
    onOpenChange(isOpen);
  }

  function handleDownload() {
    if (!imageUrl || !imageId) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    const ext = contentType?.split("/")[1] || "bin";
    a.download = `${imageId}.${ext}`;
    a.click();
  }

  const statusText: Record<string, string> = {
    idle: "",
    signing: "Requesting signature to derive decryption key...",
    fetching: "Fetching encrypted chunks from Solana...",
    decrypting: "Decrypting image...",
    done: "",
    error: "Decryption failed",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm truncate">
            {imageId}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Loading state */}
          {status !== "done" && status !== "error" && status !== "idle" && (
            <div className="space-y-4">
              <Skeleton className="w-full h-64 rounded-md" />
              <p className="text-sm text-muted-foreground text-center">
                {statusText[status]}
              </p>
            </div>
          )}

          {/* Decrypted image */}
          {status === "done" && imageUrl && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <img
                  src={imageUrl}
                  alt="Decrypted"
                  className="max-h-96 rounded-md object-contain"
                />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleDownload}
              >
                Download
              </Button>
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
