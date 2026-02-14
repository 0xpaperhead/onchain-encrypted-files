import { useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { UploadPanel } from "./components/UploadPanel";
import { GalleryPanel } from "./components/GalleryPanel";
import { ImageViewDialog } from "./components/ImageViewDialog";
import "./index.css";

export function App() {
  const [activeTab, setActiveTab] = useState("upload");
  const [viewImageId, setViewImageId] = useState<string | null>(null);
  const [viewContentType, setViewContentType] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleView(imageId: string, contentType: string) {
    setViewImageId(imageId);
    setViewContentType(contentType);
    setDialogOpen(true);
  }

  function handleUploadComplete() {
    setActiveTab("gallery");
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Onchain Encrypted Images</h1>
        <WalletMultiButton />
      </div>

      <Separator className="mb-6" />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
        </TabsList>
        <TabsContent value="upload">
          <UploadPanel onUploadComplete={handleUploadComplete} />
        </TabsContent>
        <TabsContent value="gallery">
          <GalleryPanel onView={handleView} />
        </TabsContent>
      </Tabs>

      <ImageViewDialog
        imageId={viewImageId}
        contentType={viewContentType}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

export default App;
