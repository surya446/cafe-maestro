import { useState } from "react";
import { Plus, Pencil, Trash2, Tag, ToggleLeft, ToggleRight } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useOffers, useCreateOffer, useUpdateOffer, useDeleteOffer, useToggleOffer } from "@/hooks/useOffers";
import { Offer } from "@/types";
import { formatDate } from "@/lib/utils";

function OfferForm({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Partial<Offer>;
  onSubmit: (data: Omit<Offer, "id" | "cafe_id" | "created_at" | "updated_at">) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [validFrom, setValidFrom] = useState(
    initial?.valid_from ? initial.valid_from.split("T")[0] : ""
  );
  const [validUntil, setValidUntil] = useState(
    initial?.valid_until ? initial.valid_until.split("T")[0] : ""
  );
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  function handle(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      image_url: imageUrl.trim() || null,
      discount_type: null,
      discount_value: null,
      applies_to_items: null,
      valid_from: validFrom || null,
      valid_until: validUntil || null,
      is_active: isActive,
      is_public: true,
    });
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Title *</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Happy Hour — 20% off all drinks"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tell customers more about this offer…"
          rows={3}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Image URL</Label>
        <Input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
        />
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Preview"
            className="h-32 w-full object-cover rounded-lg bg-muted mt-2"
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Valid from</Label>
          <Input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Valid until</Label>
          <Input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
        <div>
          <p className="text-sm font-medium">Active</p>
          <p className="text-xs text-muted-foreground">
            Inactive offers are hidden from customers
          </p>
        </div>
        <Switch checked={isActive} onCheckedChange={setIsActive} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} type="button" disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !title.trim()}>
          {loading ? "Saving…" : initial?.title ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function OffersPage() {
  const { data: offers = [], isLoading } = useOffers();
  const create = useCreateOffer();
  const update = useUpdateOffer();
  const del = useDeleteOffer();
  const toggle = useToggleOffer();

  const [dialog, setDialog] = useState(false);
  const [editOffer, setEditOffer] = useState<Offer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const active = offers.filter((o) => o.is_active);
  const inactive = offers.filter((o) => !o.is_active);

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl mx-auto">
        <PageHeader
          title="Offers & Specials"
          subtitle={`${active.length} active, ${inactive.length} inactive`}
          actions={
            <Button onClick={() => { setEditOffer(null); setDialog(true); }}>
              <Plus className="w-4 h-4 mr-1.5" />
              New offer
            </Button>
          }
        />

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : offers.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No offers yet"
            description="Create limited-time deals, happy hours, or seasonal specials."
            action={
              <Button onClick={() => { setEditOffer(null); setDialog(true); }}>
                <Plus className="w-4 h-4 mr-1.5" />
                Create offer
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className={`flex gap-4 p-4 bg-card border rounded-xl shadow-sm transition-opacity ${
                  offer.is_active
                    ? "border-card-border"
                    : "border-border opacity-60"
                }`}
              >
                {/* Image */}
                {offer.image_url ? (
                  <img
                    src={offer.image_url}
                    alt={offer.title}
                    className="w-20 h-20 rounded-lg object-cover bg-muted shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Tag className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{offer.title}</p>
                      {offer.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                          {offer.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Switch
                        checked={offer.is_active}
                        onCheckedChange={(v) =>
                          toggle.mutate({ id: offer.id, is_active: v })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-2">
                    {(offer.valid_from || offer.valid_until) && (
                      <p className="text-xs text-muted-foreground">
                        {offer.valid_from && `From ${formatDate(offer.valid_from)}`}
                        {offer.valid_from && offer.valid_until && " · "}
                        {offer.valid_until && `Until ${formatDate(offer.valid_until)}`}
                      </p>
                    )}
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        onClick={() => { setEditOffer(offer); setDialog(true); }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteId(offer.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={dialog} onOpenChange={setDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editOffer ? "Edit offer" : "New offer"}</DialogTitle>
            </DialogHeader>
            <OfferForm
              initial={editOffer ?? undefined}
              onSubmit={async (data) => {
                if (editOffer) {
                  await update.mutateAsync({ id: editOffer.id, ...data });
                } else {
                  await create.mutateAsync(data);
                }
                setDialog(false);
                setEditOffer(null);
              }}
              onCancel={() => { setDialog(false); setEditOffer(null); }}
              loading={create.isPending || update.isPending}
            />
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={!!deleteId}
          onOpenChange={(o) => !o && setDeleteId(null)}
          title="Delete offer?"
          description="This offer will be permanently removed."
          confirmLabel="Delete"
          loading={del.isPending}
          onConfirm={async () => {
            if (deleteId) {
              await del.mutateAsync(deleteId);
              setDeleteId(null);
            }
          }}
        />
      </div>
    </AppLayout>
  );
}
