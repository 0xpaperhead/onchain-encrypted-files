import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ImageUploadAccount } from "@/lib/anchor";

interface ImageCardProps {
  image: ImageUploadAccount;
  onView: (imageId: string, contentType: string) => void;
}

export function ImageCard({ image, onView }: ImageCardProps) {
  const { imageId, contentType, totalChunks, chunksUploaded, finalized, createdAt } =
    image.account;

  const date = new Date(createdAt.toNumber() * 1000);
  const dateStr = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-mono truncate flex-1">
            {imageId}
          </CardTitle>
          {finalized ? (
            <Badge variant="default">Finalized</Badge>
          ) : (
            <Badge variant="secondary">
              {chunksUploaded}/{totalChunks}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Type: {contentType}</p>
          <p>Chunks: {totalChunks}</p>
          <p>{dateStr}</p>
        </div>
        {finalized && (
          <Button
            size="sm"
            className="w-full"
            onClick={() => onView(imageId, contentType)}
          >
            View
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
