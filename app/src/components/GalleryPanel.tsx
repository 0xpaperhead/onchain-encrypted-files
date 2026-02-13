import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ImageCard } from "./ImageCard";
import { useGallery } from "@/hooks/useGallery";

interface GalleryPanelProps {
  onView: (imageId: string, contentType: string) => void;
}

export function GalleryPanel({ onView }: GalleryPanelProps) {
  const { connected } = useWallet();
  const { images, loading, error, refresh } = useGallery();

  if (!connected) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Connect your wallet to view your images.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && images.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      )}

      {!loading && images.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No images found. Upload your first encrypted image!
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((img) => (
            <ImageCard
              key={img.publicKey.toBase58()}
              image={img}
              onView={onView}
            />
          ))}
        </div>
      )}
    </div>
  );
}
