import { useState, useRef, useEffect, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  UtensilsCrossed,
  Eye,
  EyeOff,
  AlertCircle,
  Upload,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  ArrowLeft,
  X,
  Lock,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  useMoveCategoryOrder,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  useArchiveMenuItem,
  useRestoreMenuItem,
  useToggleItemAvailability,
  useMoveMenuItem,
  useNormalizeMenuPositions,
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
  onSubmit: (data: Omit<MenuCategory, "id" | "cafe_id" | "is_system" | "created_at" | "updated_at">) => void;
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
  const [ingredients, setIngredients] = useState(initial?.ingredients ?? "");
  // food_type: '' forces the admin to explicitly pick one when creating a new item.
  // When editing, initial.food_type is always populated (DB default is 'veg').
  const [foodType, setFoodType] = useState<'veg' | 'non_veg' | ''>(
    initial?.food_type ?? ''
  );
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
    if (!foodType) return; // guard — form submit disabled below, but be safe
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
      ingredients: ingredients.trim() || null,
      food_type: foodType as 'veg' | 'non_veg',
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
            {/* System categories (like "Archived Items") are excluded — items should
                only be placed in real user-created categories. */}
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

          {/* Food type — required. Displayed as the Indian veg/non-veg indicator
              on the QR ordering menu. Admin must choose before saving. */}
          <div className="space-y-2">
            <Label>
              Food Type <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {/* Veg */}
              <button
                type="button"
                onClick={() => setFoodType('veg')}
                className={cn(
                  "flex items-center gap-2.5 px-4 py-3.5 rounded-xl border text-sm font-medium transition-colors text-left",
                  foodType === 'veg'
                    ? "border-green-600 bg-green-600/10 text-green-600"
                    : "border-border bg-transparent text-muted-foreground hover:border-green-600/40"
                )}
              >
                <span
                  className="inline-flex items-center justify-center shrink-0"
                  style={{ width: 16, height: 16, border: '2px solid #16a34a', borderRadius: 3 }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'block' }} />
                </span>
                Vegetarian
              </button>
              {/* Non-Veg */}
              <button
                type="button"
                onClick={() => setFoodType('non_veg')}
                className={cn(
                  "flex items-center gap-2.5 px-4 py-3.5 rounded-xl border text-sm font-medium transition-colors text-left",
                  foodType === 'non_veg'
                    ? "border-red-600 bg-red-600/10 text-red-600"
                    : "border-border bg-transparent text-muted-foreground hover:border-red-600/40"
                )}
              >
                <span
                  className="inline-flex items-center justify-center shrink-0"
                  style={{ width: 16, height: 16, border: '2px solid #dc2626', borderRadius: 3 }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'block' }} />
                </span>
                Non-Vegetarian
              </button>
            </div>
            {!foodType && (
              <p className="text-xs text-muted-foreground">Required — select one before saving</p>
            )}
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

          <div className="space-y-1.5">
            <Label htmlFor="item-ingredients">Ingredients</Label>
            <Textarea
              id="item-ingredients"
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="Chicken, Onion, Garlic..."
              className="min-h-[90px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Shown to customers on the food detail screen
            </p>
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
          disabled={loading || !name.trim() || !price || !categoryId || !foodType}
          className="flex-1 h-12"
        >
          {loading ? "Saving…" : initial?.name ? "Update Item" : "Create Item"}
        </Button>
      </div>
    </form>
  );
}

/* ─── Restore item dialog ────────────────────────────────────────────────── */
/**
 * Asks the admin to choose a destination category when restoring an archived
 * item. System categories are excluded — items must be restored into a real
 * user-created category.
 */
function RestoreItemDialog({
  open,
  onOpenChange,
  categories,
  loading,
  onRestore,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: MenuCategory[];
  loading: boolean;
  onRestore: (categoryId: string) => void;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  useEffect(() => {
    if (!open) setSelectedCategoryId("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restore menu item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            Choose which category to restore this item into. It will become
            visible on your active menu again.
          </p>
          {categories.length === 0 ? (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">No categories available</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Create a category first, then restore this item.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="restore-category">Destination category *</Label>
              <Select
                value={selectedCategoryId}
                onValueChange={setSelectedCategoryId}
              >
                <SelectTrigger id="restore-category" className="h-[46px]">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={() => selectedCategoryId && onRestore(selectedCategoryId)}
            disabled={loading || !selectedCategoryId || categories.length === 0}
          >
            {loading ? "Restoring…" : "Restore to Menu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  onMove,
  isFirst,
  isLast,
}: {
  item: MenuItem;
  hasOrders: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onToggle: (v: boolean) => void;
  onMove?: (direction: "up" | "down" | "top" | "bottom") => void;
  isFirst?: boolean;
  isLast?: boolean;
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

      {/* Reorder controls — visible only when a single category is selected */}
      {onMove && (
        <div className="flex items-center gap-1 pt-0.5 border-t border-border">
          <span className="text-xs text-muted-foreground mr-auto">Reorder</span>
          <button
            onClick={() => onMove("top")}
            disabled={isFirst}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move to top"
          >
            <ChevronsUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onMove("up")}
            disabled={isFirst}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move up"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onMove("down")}
            disabled={isLast}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move down"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onMove("bottom")}
            disabled={isLast}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move to bottom"
          >
            <ChevronsDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
  hasOrders,
  onRestore,
  onDelete,
}: {
  item: MenuItem;
  hasOrders: boolean;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl shadow-sm p-4 space-y-3 opacity-75">
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
        <span className="font-semibold text-sm text-foreground">
          {formatCurrency(item.price)}
        </span>
      </div>
      <div className="flex gap-2 pt-1 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-11 text-green-600 hover:text-green-700 hover:bg-green-50 hover:border-green-200"
          onClick={onRestore}
        >
          <ArchiveRestore className="w-3.5 h-3.5 mr-1.5" />
          Restore
        </Button>
        {!hasOrders && (
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
  const moveCat = useMoveCategoryOrder();
  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();
  const archiveItem = useArchiveMenuItem();
  const restoreItem = useRestoreMenuItem();
  const toggleAvail = useToggleItemAvailability();
  const moveItem = useMoveMenuItem();
  const normalizePositions = useNormalizeMenuPositions();
  const normalizedRef = useRef(false);

  const [tab, setTab] = useState<"items" | "categories" | "archived">("items");
  const [catDialog, setCatDialog] = useState(false);
  const [itemDialog, setItemDialog] = useState(false);
  const [editCat, setEditCat] = useState<MenuCategory | null>(null);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [archiveItemId, setArchiveItemId] = useState<string | null>(null);
  // Restore: track which item is being restored (null = closed)
  const [restoreItemId, setRestoreItemId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [archivedSearch, setArchivedSearch] = useState("");
  const [deleteArchivedItemId, setDeleteArchivedItemId] = useState<string | null>(null);

  // Separate user-created categories from the system "Archived Items" category.
  // System categories are NEVER shown in:
  //   • the category filter buttons on the Items tab
  //   • the category dropdown in the item form
  //   • the Add / Edit category dialogs
  const userCategories = categories.filter((c) => !c.is_system);
  const systemCategories = categories.filter((c) => c.is_system);

  // "All" view: iterate categories in category order, then items within each
  // category sorted by position. This keeps category sections fixed regardless
  // of item position changes — matching Public Website / QR Ordering behaviour.
  const allViewItems = useMemo(
    () =>
      userCategories.flatMap((c) =>
        items
          .filter((i) => i.category_id === c.id)
          .sort((a, b) => a.position - b.position)
      ),
    [userCategories, items]
  );

  const filteredItems =
    filterCat === "all"
      ? allViewItems
      : items.filter((i) => i.category_id === filterCat);

  const filteredArchivedItems = archivedSearch.trim()
    ? archivedItems.filter(
        (i) =>
          i.name.toLowerCase().includes(archivedSearch.toLowerCase()) ||
          (i.description ?? "").toLowerCase().includes(archivedSearch.toLowerCase())
      )
    : archivedItems;

  const isLoading = catLoading || itemsLoading;

  // Normalize positions once on first load: assigns sequential 0-based positions
  // to any category where items share the same position value (the default=0 case
  // that causes non-deterministic ORDER BY results on every UPDATE).
  useEffect(() => {
    if (normalizedRef.current || itemsLoading || items.length === 0) return;
    normalizedRef.current = true;
    normalizePositions.mutate(items);
  }, [items, itemsLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleMove(item: MenuItem, direction: "up" | "down" | "top" | "bottom") {
    const categoryItems = items.filter((i) => i.category_id === item.category_id);
    moveItem.mutate({ id: item.id, direction, categoryItems });
  }

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <PageHeader
          title="Menu"
          subtitle={`${items.length} item${items.length !== 1 ? "s" : ""} across ${userCategories.length} categor${userCategories.length !== 1 ? "ies" : "y"}${archivedItems.length > 0 ? ` · ${archivedItems.length} archived` : ""}`}
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

          {/* ── Items tab ─────────────────────────────────────────────── */}
          <TabsContent value="items">
            {userCategories.length > 0 && (
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
                  All ({items.length})
                </button>
                {userCategories.map((c) => (
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
                    {c.name} ({items.filter((i) => i.category_id === c.id).length})
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
                  {filteredItems.map((item, idx) => {
                    const hasOrders = orderHistory.has(item.id);
                    const inCategoryMode = filterCat !== "all";
                    return (
                      <MenuItemCard
                        key={item.id}
                        item={item}
                        hasOrders={hasOrders}
                        onEdit={() => { setEditItem(item); setItemDialog(true); }}
                        onArchive={() => setArchiveItemId(item.id)}
                        onDelete={() => setDeleteItemId(item.id)}
                        onToggle={(v) => toggleAvail.mutate({ id: item.id, is_available: v })}
                        onMove={inCategoryMode ? (dir) => handleMove(item, dir) : undefined}
                        isFirst={inCategoryMode && idx === 0}
                        isLast={inCategoryMode && idx === filteredItems.length - 1}
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
                        {filterCat !== "all" ? (
                          <th className="px-3 lg:px-4 py-2.5 lg:py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Order</th>
                        ) : (
                          <th className="text-left px-3 lg:px-4 py-2.5 lg:py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</th>
                        )}
                        <th className="text-right px-3 lg:px-4 py-2.5 lg:py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Price</th>
                        <th className="text-center px-3 lg:px-4 py-2.5 lg:py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Available</th>
                        <th className="px-3 lg:px-4 py-2.5 lg:py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredItems.map((item, idx) => {
                        const hasOrders = orderHistory.has(item.id);
                        const isFirst = idx === 0;
                        const isLast = idx === filteredItems.length - 1;
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
                            {filterCat !== "all" ? (
                              <td className="px-3 lg:px-4 py-2.5 lg:py-3">
                                <div className="flex items-center gap-0.5">
                                  <button
                                    onClick={() => handleMove(item, "top")}
                                    disabled={isFirst}
                                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Move to top"
                                  >
                                    <ChevronsUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleMove(item, "up")}
                                    disabled={isFirst}
                                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Move up"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleMove(item, "down")}
                                    disabled={isLast}
                                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Move down"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleMove(item, "bottom")}
                                    disabled={isLast}
                                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Move to bottom"
                                  >
                                    <ChevronsDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            ) : (
                              <td className="px-3 lg:px-4 py-2.5 lg:py-3 text-muted-foreground text-xs lg:text-sm">
                                {item.menu_categories?.name ?? "—"}
                              </td>
                            )}
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

          {/* ── Categories tab ────────────────────────────────────────── */}
          <TabsContent value="categories">
            {catLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            ) : userCategories.length === 0 && systemCategories.length === 0 ? (
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
                {/* User-created categories */}
                {userCategories.map((cat, idx) => {
                  const count = items.filter((i) => i.category_id === cat.id).length;
                  const isFirst = idx === 0;
                  const isLast = idx === userCategories.length - 1;
                  const isMoving = moveCat.isPending;
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center gap-4 p-4 bg-card border border-card-border rounded-xl shadow-sm"
                    >
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
                      {/* Move Up / Move Down */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => {
                            const above = userCategories[idx - 1];
                            moveCat.mutate({ idA: cat.id, posA: cat.position, idB: above.id, posB: above.position });
                          }}
                          disabled={isFirst || isMoving}
                          className={cn(
                            "p-1.5 rounded-lg transition-colors",
                            isFirst
                              ? "text-muted-foreground/30 cursor-not-allowed"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                          title="Move up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            const below = userCategories[idx + 1];
                            moveCat.mutate({ idA: cat.id, posA: cat.position, idB: below.id, posB: below.position });
                          }}
                          disabled={isLast || isMoving}
                          className={cn(
                            "p-1.5 rounded-lg transition-colors",
                            isLast
                              ? "text-muted-foreground/30 cursor-not-allowed"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                          title="Move down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { setEditCat(cat); setCatDialog(true); }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Edit category"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            // Block deletion if active items still exist in this category.
                            // Archived items are always moved to "Archived Items" automatically,
                            // so any remaining items are active.
                            const activeItemsInCat = items.filter(
                              (i) => i.category_id === cat.id
                            );
                            if (activeItemsInCat.length > 0) {
                              toast({
                                title: "Cannot delete category",
                                description:
                                  `"${cat.name}" still contains active menu items. ` +
                                  "Archive or delete those items first.",
                                variant: "destructive",
                              });
                              return;
                            }
                            setDeleteCatId(cat.id);
                          }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Delete category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* System categories — shown with a lock badge; no edit/delete actions */}
                {systemCategories.map((cat) => {
                  const count = archivedItems.filter((i) => i.category_id === cat.id).length;
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center gap-4 p-4 bg-muted/30 border border-border rounded-xl"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{cat.name}</p>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground border border-border">
                            <Lock className="w-2.5 h-2.5" />
                            System
                          </span>
                        </div>
                        {cat.description && (
                          <p className="text-sm text-muted-foreground truncate mt-0.5">
                            {cat.description}
                          </p>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground shrink-0">
                        {count} archived item{count !== 1 ? "s" : ""}
                      </span>
                      <EyeOff className="w-4 h-4 text-muted-foreground shrink-0" />
                      {/* No edit / delete buttons for system categories */}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Archived tab ──────────────────────────────────────────── */}
          <TabsContent value="archived">
            {/* Search bar */}
            {archivedItems.length > 0 && (
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={archivedSearch}
                  onChange={(e) => setArchivedSearch(e.target.value)}
                  placeholder="Search archived items…"
                  className="pl-9 h-10"
                />
                {archivedSearch && (
                  <button
                    onClick={() => setArchivedSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

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
            ) : filteredArchivedItems.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No results"
                description={`No archived items match "${archivedSearch}".`}
              />
            ) : (
              <>
                {/* ── Mobile cards (< 768 px) ───────────────────────── */}
                <div className="md:hidden space-y-3">
                  {filteredArchivedItems.map((item) => (
                    <ArchivedItemCard
                      key={item.id}
                      item={item}
                      hasOrders={orderHistory.has(item.id)}
                      onRestore={() => setRestoreItemId(item.id)}
                      onDelete={() => setDeleteArchivedItemId(item.id)}
                    />
                  ))}
                </div>

                {/* ── Tablet + desktop table (≥ 768 px) ────────────── */}
                <div className="hidden md:block bg-card border border-card-border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-3 lg:px-4 py-2.5 lg:py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Item</th>
                        <th className="text-right px-3 lg:px-4 py-2.5 lg:py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Price</th>
                        <th className="px-3 lg:px-4 py-2.5 lg:py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredArchivedItems.map((item) => {
                        const hasOrders = orderHistory.has(item.id);
                        return (
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
                                {!hasOrders && (
                                  <button
                                    onClick={() => setDeleteArchivedItemId(item.id)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    title="Permanently delete"
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
        </Tabs>

        {/* ── Category dialog ──────────────────────────────────────────── */}
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

        {/* ── Item dialog ──────────────────────────────────────────────── */}
        <ResponsiveItemDialog
          open={itemDialog}
          onOpenChange={setItemDialog}
          title={editItem ? "Edit Item" : "New Menu Item"}
        >
          {userCategories.length === 0 ? (
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
              key={editItem?.id ?? 'new'}
              initial={editItem ?? undefined}
              categories={userCategories}
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

        {/* ── Delete category confirm ──────────────────────────────────── */}
        <ConfirmDialog
          open={!!deleteCatId}
          onOpenChange={(o) => !o && setDeleteCatId(null)}
          title="Delete category?"
          description="This category is empty and will be permanently deleted. This cannot be undone."
          confirmLabel="Delete"
          loading={deleteCat.isPending}
          onConfirm={async () => {
            if (!deleteCatId) return;
            try {
              await deleteCat.mutateAsync(deleteCatId);
              if (filterCat === deleteCatId) setFilterCat("all");
              setDeleteCatId(null);
            } catch (err) {
              setDeleteCatId(null);
              const raw = (err as { message?: string; code?: string }) ?? {};
              const description =
                raw.code === "CATEGORY_HAS_ITEMS"
                  ? "This category still contains active menu items. Archive or delete them first."
                  : raw.code === "SYSTEM_CATEGORY"
                  ? "System categories cannot be deleted."
                  : (raw.message ?? "Failed to delete category.");
              toast({ title: "Cannot delete category", description, variant: "destructive" });
            }
          }}
        />

        {/* ── Delete active item confirm ───────────────────────────────── */}
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

        {/* ── Delete archived item confirm ─────────────────────────────── */}
        <ConfirmDialog
          open={!!deleteArchivedItemId}
          onOpenChange={(o) => !o && setDeleteArchivedItemId(null)}
          title="Permanently delete item?"
          description="This archived item has no order history and will be permanently removed. This cannot be undone."
          confirmLabel="Delete"
          loading={deleteItem.isPending}
          onConfirm={async () => {
            if (!deleteArchivedItemId) return;
            try {
              await deleteItem.mutateAsync(deleteArchivedItemId);
              setDeleteArchivedItemId(null);
            } catch (err) {
              setDeleteArchivedItemId(null);
              const raw = (err as { message?: string; code?: string }) ?? {};
              toast({
                title: "Could not delete item",
                description: raw.message ?? "Failed to delete item.",
                variant: "destructive",
              });
            }
          }}
        />

        {/* ── Archive item confirm ─────────────────────────────────────── */}
        <ConfirmDialog
          open={!!archiveItemId}
          onOpenChange={(o) => !o && setArchiveItemId(null)}
          title="Archive menu item?"
          description="The item will be hidden from customers and moved to Archived Items. Order history is preserved. You can restore it at any time."
          confirmLabel="Archive"
          variant="warning"
          loading={archiveItem.isPending}
          onConfirm={async () => {
            if (!archiveItemId) return;
            await archiveItem.mutateAsync(archiveItemId);
            setArchiveItemId(null);
            toast({ title: "Item archived", description: "The item has been moved to Archived Items." });
          }}
        />

        {/* ── Restore item dialog (category picker) ───────────────────── */}
        <RestoreItemDialog
          open={!!restoreItemId}
          onOpenChange={(o) => !o && setRestoreItemId(null)}
          categories={userCategories}
          loading={restoreItem.isPending}
          onRestore={async (categoryId) => {
            if (!restoreItemId) return;
            await restoreItem.mutateAsync({ id: restoreItemId, category_id: categoryId });
            setRestoreItemId(null);
            toast({ title: "Item restored", description: "The item is back on your active menu." });
          }}
        />
      </div>
    </>
  );
}
