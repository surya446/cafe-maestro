import { useState, useEffect, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  UtensilsCrossed,
  GripVertical,
  Eye,
  EyeOff,
  AlertCircle,
  Upload,
  ChevronDown,
  ArrowLeft,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useMenuCategories,
  useMenuItems,
  useArchivedMenuItems,
  useMenuItemOrderHistory,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  useArchiveMenuItem,
  useRestoreMenuItem,
  useToggleItemAvailability,
} from "@/hooks/useMenu";
import { MenuCategory, MenuItem } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

/* ─── Category form ──────────────────────────────────────────────────────── */
function CategoryForm({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Partial<MenuCategory>;
  onSubmit: (data: Omit<MenuCategory, "id" | "cafe_id" | "created_at" | "updated_at">) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isVisible, setIsVisible] = useState(initial?.is_visible ?? true);

  function handle(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      image_url: null,
      is_visible: isVisible,
      position: initial?.position ?? 0,
    });
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Category name *</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Hot Drinks"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional short description"
          rows={2}
        />
      </div>
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
        <div>
          <p className="text-sm font-medium">Visible to customers</p>
          <p className="text-xs text-muted-foreground">
            Hidden categories won't appear on the menu
          </p>
        </div>
        <Switch checked={isVisible} onCheckedChange={setIsVisible} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} type="button" disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !name.trim()}>
          {loading ? "Saving…" : initial?.name ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/* ─── Menu item form ─────────────────────────────────────────────────────── */
function ItemForm({
  initial,
  categories,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Partial<MenuItem>;
  categories: MenuCategory[];
  onSubmit: (data: Omit<MenuItem, "id" | "cafe_id" | "created_at" | "updated_at" | "is_archived" | "menu_categories">) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [isAvailable, setIsAvailable] = useState(initial?.is_available ?? true);
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [allergens, setAllergens] = useState((initial?.allergens ?? []).join(", "));
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [showUrlField, setShowUrlField] = useState(!!initial?.image_url);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const imagePreview = localPreview ?? (imageUrl || null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    setShowUrlField(true);
  }

  function clearImage() {
    setLocalPreview(null);
    setImageUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handle(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      price: parseFloat(price),
      category_id: categoryId,
      image_url: imageUrl.trim() || null,
      is_available: isAvailable,
      prep_time_min: null,
      position: initial?.position ?? 0,
      calories: null,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      allergens: allergens.split(",").map((a) => a.trim()).filter(Boolean),
    });
  }

  return (
    <form onSubmit={handle} className="flex flex-col h-full min-h-0">
      {/* ── Scrollable body ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-6 scroll-pb-6">

        {/* Section: Basic Information */}
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Basic Information
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="item-name">Item Name *</Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Flat White"
              required
              className="h-[52px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-category">Category *</Label>
            <Select value={categoryId} onValueChange={setCategoryId} required>
              <SelectTrigger id="item-category" className="h-[52px]">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-price">Price (₹) *</Label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm pointer-events-none">
                ₹
              </span>
              <Input
                id="item-price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="99"
                required
                className="h-[52px] pl-8"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-desc">Description</Label>
            <Textarea
              id="item-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of the item"
              className="min-h-[120px] resize-none"
            />
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Section: Media */}
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Media
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFileChange}
          />

          {imagePreview ? (
            <div className="relative rounded-xl overflow-hidden border border-border bg-muted aspect-video">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={clearImage}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                aria-label="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-border hover:border-primary/40 rounded-xl p-8 flex flex-col items-center gap-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Upload className="w-7 h-7" />
              <div className="text-center">
                <p className="text-sm font-medium">Upload image</p>
                <p className="text-xs mt-1 text-muted-foreground/70">
                  Tap to choose from gallery or camera
                </p>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowUrlField((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 transition-transform duration-150",
                showUrlField && "rotate-180"
              )}
            />
            {showUrlField ? "Hide" : "Use"} image URL instead
          </button>

          {showUrlField && (
            <div className="space-y-1.5">
              <Label htmlFor="item-image-url">Image URL</Label>
              <Input
                id="item-image-url"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  if (e.target.value) setLocalPreview(null);
                }}
                placeholder="https://example.com/image.jpg"
                className="h-[52px]"
              />
            </div>
          )}
        </div>

        <div className="border-t border-border" />

        {/* Section: Additional Details */}
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Additional Details
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="item-tags">Tags</Label>
            <Input
              id="item-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="vegan, gluten-free, house special"
              className="h-[52px]"
            />
            <p className="text-xs text-muted-foreground">Separate with commas</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-allergens">Allergens</Label>
            <Input
              id="item-allergens"
              value={allergens}
              onChange={(e) => setAllergens(e.target.value)}
              placeholder="dairy, gluten, nuts"
              className="h-[52px]"
            />
            <p className="text-xs text-muted-foreground">Separate with commas</p>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/60">
            <div>
              <p className="text-sm font-medium">Available</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Visible to customers on the menu
              </p>
            </div>
            <Switch
              id="item-available"
              checked={isAvailable}
              onCheckedChange={setIsAvailable}
            />
          </div>
        </div>

        <div className="h-2" />
      </div>

      {/* ── Sticky footer ────────────────────────────────────── */}
      <div
        className="shrink-0 border-t border-border bg-background px-6 py-4 flex gap-3"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <Button
          variant="outline"
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 h-12"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading || !name.trim() || !price || !categoryId}
          className="flex-1 h-12"
        >
          {loading ? "Saving…" : initial?.name ? "Update Item" : "Create Item"}
        </Button>
      </div>
    </form>
  );
}

/* ─── Mobile item card (< 768 px) ───────────────────────────────────────── */
function MenuItemCard({
  item,
  hasOrders,
  onEdit,
  onArchive,
  onDelete,
  onToggle,
}: {
  item: MenuItem;
  hasOrders: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl shadow-sm p-4 space-y-3">
      {/* Image + name / description */}
      <div className="flex gap-3">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-14 h-14 rounded-lg object-cover shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <UtensilsCrossed className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground leading-snug">{item.name}</p>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>
      </div>

      {/* Category + price */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
          {item.menu_categories?.name ?? "—"}
        </span>
        <span className="font-semibold text-sm text-foreground">
          {formatCurrency(item.price)}
        </span>
      </div>

      {/* Availability toggle */}
      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/40">
        <span className="text-sm text-muted-foreground">Available</span>
        <Switch checked={item.is_available} onCheckedChange={onToggle} />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-11"
          onClick={onEdit}
        >
          <Pencil className="w-3.5 h-3.5 mr-1.5" />
          Edit
        </Button>
        {hasOrders ? (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-11 text-amber-600 hover:text-amber-700 hover:bg-amber-50 hover:border-amber-200"
            onClick={onArchive}
          >
            <Archive className="w-3.5 h-3.5 mr-1.5" />
            Archive
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-11 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20"
            onClick={onDelete}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Mobile archived card (< 768 px) ───────────────────────────────────── */
function ArchivedItemCard({
  item,
  onRestore,
}: {
  item: MenuItem;
  onRestore: () => void;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl shadow-sm p-4 space-y-3 opacity-70">
      <div className="flex gap-3">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-14 h-14 rounded-lg object-cover shrink-0 grayscale"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <UtensilsCrossed className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground line-through decoration-muted-foreground/50 leading-snug">
            {item.name}
          </p>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
          {item.menu_categories?.name ?? "—"}
        </span>
        <span className="font-semibold text-sm text-foreground">
          {formatCurrency(item.price)}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full h-11 text-green-600 hover:text-green-700 hover:bg-green-50 hover:border-green-200"
        onClick={onRestore}
      >
        <ArchiveRestore className="w-3.5 h-3.5 mr-1.5" />
        Restore to Menu
      </Button>
    </div>
  );
}

/* ─── Responsive hook ───────────────────────────────────────────────────── */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

/* ─── Responsive item dialog ─────────────────────────────────────────────── */
function ResponsiveItemDialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          {/* Overlay */}
          <DialogPrimitive.Overlay
            className={cn(
              "fixed inset-0 z-50 bg-black/60",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
              "duration-200"
            )}
          />
          {/* Full-screen bottom sheet */}
          <DialogPrimitive.Content
            className={cn(
              "fixed inset-0 z-50 flex flex-col bg-background",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
              "duration-200 ease-out"
            )}
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            {/* Sticky header */}
            <div className="shrink-0 flex items-center justify-between px-4 h-14 border-b border-border bg-background">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 rounded-lg min-w-[44px] min-h-[44px]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              <DialogPrimitive.Close className="p-2 -mr-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                <X className="w-4 h-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>
            {/* Content fills remaining height */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {children}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  /* Tablet + desktop — centered dialog */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 flex flex-col max-w-[700px] max-h-[90vh] overflow-hidden">
        <DialogHeader className="shrink-0 px-6 py-4 border-b border-border">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
export function MenuPage() {
  const { toast } = useToast();

  const { data: categories = [], isLoading: catLoading } = useMenuCategories();
  const { data: items = [], isLoading: itemsLoading } = useMenuItems();
  const { data: archivedItems = [], isLoading: archivedLoading } = useArchivedMenuItems();
  const { data: orderHistoryIds = [] } = useMenuItemOrderHistory();
  const orderHistory = new Set(orderHistoryIds);

  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();
  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();
  const archiveItem = useArchiveMenuItem();
  const restoreItem = useRestoreMenuItem();
  const toggleAvail = useToggleItemAvailability();

  const [tab, setTab] = useState<"items" | "categories" | "archived">("items");
  const [catDialog, setCatDialog] = useState(false);
  const [itemDialog, setItemDialog] = useState(false);
  const [editCat, setEditCat] = useState<MenuCategory | null>(null);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [archiveItemId, setArchiveItemId] = useState<string | null>(null);
  const [restoreItemId, setRestoreItemId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>("all");

  const filteredItems =
    filterCat === "all"
      ? items
      : items.filter((i) => i.category_id === filterCat);

  const isLoading = catLoading || itemsLoading;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <PageHeader
          title="Menu"
          subtitle={`${items.length} item${items.length !== 1 ? "s" : ""} across ${categories.length} categor${categories.length !== 1 ? "ies" : "y"}${archivedItems.length > 0 ? ` · ${archivedItems.length} archived` : ""}`}
          actions={
            tab !== "archived" ? (
              <Button
                onClick={() => {
                  if (tab === "categories") {
                    setEditCat(null);
                    setCatDialog(true);
                  } else {
                    setEditItem(null);
                    setItemDialog(true);
                  }
                }}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {tab === "categories" ? "Add category" : "Add item"}
              </Button>
            ) : undefined
          }
        />

        <Tabs value={tab} onValueChange={(v) => setTab(v as "items" | "categories" | "archived")}>
          <TabsList className="mb-6">
            <TabsTrigger value="items">Menu Items</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="archived">
              Archived
              {archivedItems.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                  {archivedItems.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Items tab */}
          <TabsContent value="items">
            {categories.length > 0 && (
              <div className="flex gap-2 mb-4 flex-wrap">
                <button
                  onClick={() => setFilterCat("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    filterCat === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setFilterCat(c.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                      filterCat === c.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <EmptyState
                icon={UtensilsCrossed}
                title="No menu items yet"
                description="Add your first menu item to get started."
                action={
                  <Button
                    onClick={() => {
                      setEditItem(null);
                      setItemDialog(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Add item
                  </Button>
                }
              />
            ) : (
              <>
                {/* ── Mobile cards (< 768 px) ───────────────────────── */}
                <div className="md:hidden space-y-3">
                  {filteredItems.map((item) => {
                    const hasOrders = orderHistory.has(item.id);
                    return (
                      <MenuItemCard
                        key={item.id}
                        item={item}
                        hasOrders={hasOrders}
                        onEdit={() => { setEditItem(item); setItemDialog(true); }}
                        onArchive={() => setArchiveItemId(item.id)}
                        onDelete={() => setDeleteItemId(item.id)}
                        onToggle={(v) => toggleAvail.mutate({ id: item.id, is_available: v })}
                      />
                    );
                  })}
                </div>

                {/* ── Tablet + desktop table (≥ 768 px) ────────────── */}
                <div className="hidden md:block bg-card border border-card-border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-3 lg:px-4 py-2.5 lg:py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Item</th>
                        <th className="text-left px-3 lg:px-4 py-2.5 lg:py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</th>
                        <th className="text-right px-3 lg:px-4 py-2.5 lg:py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Price</th>
                        <th className="text-center px-3 lg:px-4 py-2.5 lg:py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Available</th>
                        <th className="px-3 lg:px-4 py-2.5 lg:py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredItems.map((item) => {
                        const hasOrders = orderHistory.has(item.id);
                        return (
                          <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-3 lg:px-4 py-2.5 lg:py-3">
                              <div className="flex items-center gap-2 lg:gap-3">
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    alt={item.name}
                                    className="w-8 h-8 lg:w-9 lg:h-9 rounded-lg object-cover bg-muted shrink-0"
                                  />
                                ) : (
                                  <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                    <UtensilsCrossed className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium text-foreground">{item.name}</p>
                                  {item.description && (
                                    <p className="text-xs text-muted-foreground truncate max-w-[160px] lg:max-w-xs">
                                      {item.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 lg:px-4 py-2.5 lg:py-3 text-muted-foreground text-xs lg:text-sm">
                              {item.menu_categories?.name ?? "—"}
                            </td>
                            <td className="px-3 lg:px-4 py-2.5 lg:py-3 text-right font-semibold text-foreground">
                              {formatCurrency(item.price)}
                            </td>
                            <td className="px-3 lg:px-4 py-2.5 lg:py-3 text-center">
                              <Switch
                                checked={item.is_available}
                                onCheckedChange={(v) =>
                                  toggleAvail.mutate({ id: item.id, is_available: v })
                                }
                              />
                            </td>
                            <td className="px-3 lg:px-4 py-2.5 lg:py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => { setEditItem(item); setItemDialog(true); }}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                  title="Edit"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                {hasOrders ? (
                                  <button
                                    onClick={() => setArchiveItemId(item.id)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                    title="Archive (item has order history)"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setDeleteItemId(item.id)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </TabsContent>

          {/* Categories tab */}
          <TabsContent value="categories">
            {catLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <EmptyState
                title="No categories yet"
                description="Create a category first, then add menu items to it."
                action={
                  <Button onClick={() => { setEditCat(null); setCatDialog(true); }}>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Add category
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2">
                {categories.map((cat) => {
                  const count = items.filter((i) => i.category_id === cat.id).length;
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center gap-4 p-4 bg-card border border-card-border rounded-xl shadow-sm"
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{cat.name}</p>
                        {cat.description && (
                          <p className="text-sm text-muted-foreground truncate">
                            {cat.description}
                          </p>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground shrink-0">
                        {count} item{count !== 1 ? "s" : ""}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {cat.is_visible ? (
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { setEditCat(cat); setCatDialog(true); }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteCatId(cat.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Archived tab */}
          <TabsContent value="archived">
            {archivedLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            ) : archivedItems.length === 0 ? (
              <EmptyState
                icon={Archive}
                title="No archived items"
                description="Items with order history that you remove will appear here."
              />
            ) : (
              <>
                {/* ── Mobile cards (< 768 px) ───────────────────────── */}
                <div className="md:hidden space-y-3">
                  {archivedItems.map((item) => (
                    <ArchivedItemCard
                      key={item.id}
                      item={item}
                      onRestore={() => setRestoreItemId(item.id)}
                    />
                  ))}
                </div>

                {/* ── Tablet + desktop table (≥ 768 px) ────────────── */}
                <div className="hidden md:block bg-card border border-card-border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-3 lg:px-4 py-2.5 lg:py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Item</th>
                        <th className="text-left px-3 lg:px-4 py-2.5 lg:py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</th>
                        <th className="text-right px-3 lg:px-4 py-2.5 lg:py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Price</th>
                        <th className="px-3 lg:px-4 py-2.5 lg:py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {archivedItems.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors opacity-70">
                          <td className="px-3 lg:px-4 py-2.5 lg:py-3">
                            <div className="flex items-center gap-2 lg:gap-3">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="w-8 h-8 lg:w-9 lg:h-9 rounded-lg object-cover bg-muted shrink-0 grayscale"
                                />
                              ) : (
                                <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                  <UtensilsCrossed className="w-4 h-4 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-foreground line-through decoration-muted-foreground/50">
                                  {item.name}
                                </p>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground truncate max-w-[160px] lg:max-w-xs">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 lg:px-4 py-2.5 lg:py-3 text-muted-foreground text-xs lg:text-sm">
                            {item.menu_categories?.name ?? "—"}
                          </td>
                          <td className="px-3 lg:px-4 py-2.5 lg:py-3 text-right font-semibold text-foreground">
                            {formatCurrency(item.price)}
                          </td>
                          <td className="px-3 lg:px-4 py-2.5 lg:py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setRestoreItemId(item.id)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-green-600 hover:bg-green-50 transition-colors"
                                title="Restore to menu"
                              >
                                <ArchiveRestore className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Category dialog */}
        <Dialog open={catDialog} onOpenChange={setCatDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editCat ? "Edit category" : "New category"}
              </DialogTitle>
            </DialogHeader>
            <CategoryForm
              initial={editCat ?? undefined}
              onSubmit={async (data) => {
                if (editCat) {
                  await updateCat.mutateAsync({ id: editCat.id, ...data });
                } else {
                  await createCat.mutateAsync(data);
                }
                setCatDialog(false);
                setEditCat(null);
              }}
              onCancel={() => { setCatDialog(false); setEditCat(null); }}
              loading={createCat.isPending || updateCat.isPending}
            />
          </DialogContent>
        </Dialog>

        {/* Item dialog */}
        <ResponsiveItemDialog
          open={itemDialog}
          onOpenChange={setItemDialog}
          title={editItem ? "Edit Item" : "New Menu Item"}
        >
          {categories.length === 0 ? (
            <div className="flex items-start gap-3 m-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">No categories yet</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Create a category first before adding menu items.
                </p>
              </div>
            </div>
          ) : (
            <ItemForm
              initial={editItem ?? undefined}
              categories={categories}
              onSubmit={async (data) => {
                if (editItem) {
                  await updateItem.mutateAsync({ id: editItem.id, ...data });
                } else {
                  await createItem.mutateAsync(data);
                }
                setItemDialog(false);
                setEditItem(null);
              }}
              onCancel={() => { setItemDialog(false); setEditItem(null); }}
              loading={createItem.isPending || updateItem.isPending}
            />
          )}
        </ResponsiveItemDialog>

        {/* Delete category confirm */}
        <ConfirmDialog
          open={!!deleteCatId}
          onOpenChange={(o) => !o && setDeleteCatId(null)}
          title="Delete category?"
          description="All items in this category will also be deleted. This cannot be undone."
          confirmLabel="Delete"
          loading={deleteCat.isPending}
          onConfirm={async () => {
            if (deleteCatId) {
              await deleteCat.mutateAsync(deleteCatId);
              setDeleteCatId(null);
            }
          }}
        />

        {/* Delete item confirm */}
        <ConfirmDialog
          open={!!deleteItemId}
          onOpenChange={(o) => !o && setDeleteItemId(null)}
          title="Delete menu item?"
          description="This will permanently remove the item from your menu. This cannot be undone."
          confirmLabel="Delete"
          loading={deleteItem.isPending}
          onConfirm={async () => {
            if (!deleteItemId) return;
            try {
              await deleteItem.mutateAsync(deleteItemId);
              setDeleteItemId(null);
            } catch (err) {
              setDeleteItemId(null);
              const raw = (err as { message?: string; code?: string }) ?? {};
              const isLinkedToOrders =
                raw.code === "23503" ||
                (typeof raw.message === "string" &&
                  raw.message.toLowerCase().includes("order_items"));
              const msg = isLinkedToOrders
                ? "This item has order history. Use the Archive action instead."
                : (raw.message ?? "Failed to delete item.");
              toast({ title: "Could not delete item", description: msg, variant: "destructive" });
            }
          }}
        />

        {/* Archive item confirm */}
        <ConfirmDialog
          open={!!archiveItemId}
          onOpenChange={(o) => !o && setArchiveItemId(null)}
          title="Archive menu item?"
          description="The item will be hidden from customers and marked unavailable. It is preserved in order history and can be restored at any time."
          confirmLabel="Archive"
          variant="warning"
          loading={archiveItem.isPending}
          onConfirm={async () => {
            if (!archiveItemId) return;
            await archiveItem.mutateAsync(archiveItemId);
            setArchiveItemId(null);
            toast({ title: "Item archived", description: "The item is now hidden from customers." });
          }}
        />

        {/* Restore item confirm */}
        <ConfirmDialog
          open={!!restoreItemId}
          onOpenChange={(o) => !o && setRestoreItemId(null)}
          title="Restore menu item?"
          description="The item will become visible in your menu again. You can toggle its availability after restoring."
          confirmLabel="Restore"
          variant="warning"
          loading={restoreItem.isPending}
          onConfirm={async () => {
            if (!restoreItemId) return;
            await restoreItem.mutateAsync(restoreItemId);
            setRestoreItemId(null);
            toast({ title: "Item restored", description: "The item is back on your active menu." });
          }}
        />
      </div>
    </AppLayout>
  );
}
