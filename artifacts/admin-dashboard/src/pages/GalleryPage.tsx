import { useState, useRef } from "react";
import { Plus, Trash2, Pencil, Images, Upload, Link as LinkIcon } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useGallery,
  useAddGalleryImage,
  useUpdateGalleryImage,
  useDeleteGalleryImage,
  useUploadGalleryImage,
} from "@/hooks/useGallery";
import { GalleryImage } from "@/types";

function ImageCard({
  image,
  onEdit,
  onDelete,
}: {
  image: GalleryImage;
  onEdit: (image: GalleryImage) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="group relative bg-card border border-card-border rounded-xl overflow-hidden shadow-sm">
      <div className="aspect-video bg-muted overflow-hidden">
        <img
          src={image.url}
          alt={image.caption ?? "Gallery image"}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      {image.caption && (
        <div className="px-3 py-2 border-t border-border">
          <p className="text-sm text-foreground truncate">{image.caption}</p>
        </div>
      )}
      <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <button
          onClick={() => onEdit(image)}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white/90 text-foreground hover:bg-white transition-colors"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(image.id)}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white/90 text-destructive hover:bg-white transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function AddImageDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { url: string; storage_path: string; caption?: string }) => void;
  loading: boolean;
}) {
  const [tab, setTab] = useState<"url" | "upload">("url");
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const uploadMutation = useUploadGalleryImage();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (tab === "url") {
      onSubmit({ url, storage_path: url, caption: caption.trim() || undefined });
    } else if (file) {
      const { publicUrl, path } = await uploadMutation.mutateAsync(file);
      onSubmit({ url: publicUrl, storage_path: path, caption: caption.trim() || undefined });
    }
    setUrl("");
    setCaption("");
    setFile(null);
    setPreview(null);
  }

  const isSubmitting = loading || uploadMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add image</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "url" | "upload")}>
            <TabsList className="w-full">
              <TabsTrigger value="url" className="flex-1 gap-2">
                <LinkIcon className="w-4 h-4" /> URL
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex-1 gap-2">
                <Upload className="w-4 h-4" /> Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="mt-4">
              <div className="space-y-1.5">
                <Label>Image URL *</Label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…"
                  required={tab === "url"}
                />
              </div>
              {url && (
                <img
                  src={url}
                  alt="Preview"
                  className="mt-3 w-full h-40 object-cover rounded-lg bg-muted"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
            </TabsContent>

            <TabsContent value="upload" className="mt-4">
              <div
                onClick={() => fileRef.current?.click()}
                className="relative border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                {preview ? (
                  <img
                    src={preview}
                    alt="Preview"
                    className="h-36 mx-auto object-contain rounded-lg"
                  />
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium">Click to upload</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPEG, PNG, WebP up to 10MB
                    </p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-1.5">
            <Label>Caption (optional)</Label>
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. Our signature cold brew"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                (tab === "url" && !url) ||
                (tab === "upload" && !file)
              }
            >
              {isSubmitting ? "Adding…" : "Add image"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function GalleryPage() {
  const { data: images = [], isLoading } = useGallery();
  const addImage = useAddGalleryImage();
  const updateImage = useUpdateGalleryImage();
  const deleteImage = useDeleteGalleryImage();

  const [addOpen, setAddOpen] = useState(false);
  const [editImage, setEditImage] = useState<GalleryImage | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <PageHeader
          title="Gallery"
          subtitle={`${images.length} image${images.length !== 1 ? "s" : ""} in your public gallery`}
          actions={
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add image
            </Button>
          }
        />

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-video bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <EmptyState
            icon={Images}
            title="No gallery images yet"
            description="Add photos to showcase your cafe, food, and ambiance."
            action={
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                Add first image
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((img) => (
              <ImageCard
                key={img.id}
                image={img}
                onEdit={(i) => { setEditImage(i); setEditCaption(i.caption ?? ""); }}
                onDelete={setDeleteId}
              />
            ))}
          </div>
        )}

        {/* Add dialog */}
        <AddImageDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onSubmit={async (data) => {
            await addImage.mutateAsync(data);
            setAddOpen(false);
          }}
          loading={addImage.isPending}
        />

        {/* Edit caption dialog */}
        <Dialog open={!!editImage} onOpenChange={(o) => !o && setEditImage(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit caption</DialogTitle>
            </DialogHeader>
            {editImage && (
              <>
                <img
                  src={editImage.url}
                  alt=""
                  className="w-full h-40 object-cover rounded-lg bg-muted mb-2"
                />
                <div className="space-y-1.5">
                  <Label>Caption</Label>
                  <Input
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    placeholder="Describe this image…"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditImage(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      await updateImage.mutateAsync({
                        id: editImage.id,
                        caption: editCaption.trim() || null,
                      });
                      setEditImage(null);
                    }}
                    disabled={updateImage.isPending}
                  >
                    {updateImage.isPending ? "Saving…" : "Save"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <ConfirmDialog
          open={!!deleteId}
          onOpenChange={(o) => !o && setDeleteId(null)}
          title="Remove image?"
          description="This will permanently remove the image from your gallery."
          confirmLabel="Remove"
          loading={deleteImage.isPending}
          onConfirm={async () => {
            if (deleteId) {
              await deleteImage.mutateAsync(deleteId);
              setDeleteId(null);
            }
          }}
        />
      </div>
    </AppLayout>
  );
}
