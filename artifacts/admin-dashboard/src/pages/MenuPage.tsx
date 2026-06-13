import { useState, useRef } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  UtensilsCrossed,
  GripVertical,
  Eye,
  EyeOff,
  Star,
  AlertCircle,
} from "lucide-react";
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
import { useMenuCategories, useMenuItems, useCreateCategory, useUpdateCategory, useDeleteCategory, useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem, useToggleItemAvailability } from "@/hooks/useMenu";
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
  onSubmit: (data: Omit<MenuCategory, "id" | "cafe_id" | "created_at">) => void;
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
      is_visible: isVisible,
      display_order: initial?.display_order ?? 0,
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
  onSubmit: (data: Omit<MenuItem, "id" | "cafe_id" | "created_at" | "menu_categories">) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [isAvailable, setIsAvailable] = useState(initial?.is_available ?? true);
  const [isPopular, setIsPopular] = useState(initial?.is_popular ?? false);
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [allergens, setAllergens] = useState((initial?.allergens ?? []).join(", "));

  function handle(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      price: parseFloat(price),
      category_id: categoryId,
      image_url: imageUrl.trim() || null,
      is_available: isAvailable,
      is_popular: isPopular,
      display_order: initial?.display_order ?? 0,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      allergens: allergens.split(",").map((a) => a.trim()).filter(Boolean),
    });
  }

  return (
    <form onSubmit={handle} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5 col-span-2">
          <Label>Item name *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Flat White"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Price (AUD) *</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="4.50"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Category *</Label>
          <Select value={categoryId} onValueChange={setCategoryId} required>
            <SelectTrigger>
              <SelectValue placeholder="Select…" />
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
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description of the item"
          rows={2}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Image URL</Label>
        <Input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Tags (comma-separated)</Label>
        <Input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="vegan, gluten-free, house special"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Allergens (comma-separated)</Label>
        <Input
          value={allergens}
          onChange={(e) => setAllergens(e.target.value)}
          placeholder="dairy, gluten, nuts"
        />
      </div>
      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <Switch
            id="available"
            checked={isAvailable}
            onCheckedChange={setIsAvailable}
          />
          <Label htmlFor="available" className="cursor-pointer">Available</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="popular"
            checked={isPopular}
            onCheckedChange={setIsPopular}
          />
          <Label htmlFor="popular" className="cursor-pointer">Popular</Label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} type="button" disabled={loading}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading || !name.trim() || !price || !categoryId}
        >
          {loading ? "Saving…" : initial?.name ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
export function MenuPage() {
  const { data: categories = [], isLoading: catLoading } = useMenuCategories();
  const { data: items = [], isLoading: itemsLoading } = useMenuItems();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();
  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();
  const toggleAvail = useToggleItemAvailability();

  const [tab, setTab] = useState<"items" | "categories">("items");
  const [catDialog, setCatDialog] = useState(false);
  const [itemDialog, setItemDialog] = useState(false);
  const [editCat, setEditCat] = useState<MenuCategory | null>(null);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>("all");

  const filteredItems =
    filterCat === "all"
      ? items
      : items.filter((i) => i.category_id === filterCat);

  const isLoading = catLoading || itemsLoading;

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <PageHeader
          title="Menu"
          subtitle={`${items.length} items across ${categories.length} categories`}
          actions={
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
          }
        />

        <Tabs value={tab} onValueChange={(v) => setTab(v as "items" | "categories")}>
          <TabsList className="mb-6">
            <TabsTrigger value="items">Menu Items</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
          </TabsList>

          {/* Items tab */}
          <TabsContent value="items">
            {/* Category filter */}
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
              <div className="bg-card border border-card-border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Item</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Price</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Available</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-9 h-9 rounded-lg object-cover bg-muted shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                <UtensilsCrossed className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-foreground flex items-center gap-1.5">
                                {item.name}
                                {item.is_popular && (
                                  <Star className="w-3 h-3 fill-primary text-primary" />
                                )}
                              </p>
                              {item.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-xs">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {item.menu_categories?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">
                          {formatCurrency(item.price)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Switch
                            checked={item.is_available}
                            onCheckedChange={(v) =>
                              toggleAvail.mutate({ id: item.id, is_available: v })
                            }
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditItem(item);
                                setItemDialog(true);
                              }}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteItemId(item.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
        <Dialog open={itemDialog} onOpenChange={setItemDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editItem ? "Edit item" : "New menu item"}
              </DialogTitle>
            </DialogHeader>
            {categories.length === 0 ? (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
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
          </DialogContent>
        </Dialog>

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
          description="This will permanently remove the item from your menu."
          confirmLabel="Delete"
          loading={deleteItem.isPending}
          onConfirm={async () => {
            if (deleteItemId) {
              await deleteItem.mutateAsync(deleteItemId);
              setDeleteItemId(null);
            }
          }}
        />
      </div>
    </AppLayout>
  );
}
