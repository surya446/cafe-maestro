import { useState, useRef } from "react";
import {
  TableProperties,
  Plus,
  Pencil,
  QrCode,
  Archive,
  RotateCcw,
  Loader2,
  Copy,
  Download,
  RefreshCw,
  Users,
  CheckCircle2,
  Layers,
  ChevronDown,
  ChevronRight,
  Printer,
} from "lucide-react";
import QRCode from "react-qr-code";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTableManagement, ManagedTable } from "@/hooks/useTableManagement";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tableLabel(number: number, name: string) {
  return name ? `${name} (${number})` : `Table ${number}`;
}

function qrUrl(token: string | null): string | null {
  if (!token) return null;
  return `${window.location.origin}${import.meta.env.BASE_URL}table/${token}`;
}

// ─── Add / Edit Dialog ────────────────────────────────────────────────────────

interface TableFormState {
  name: string;
  number: string;
  capacity: string;
  section: string;
  displayOrder: string;
}

function TableFormDialog({
  open,
  onOpenChange,
  title,
  initial,
  onSubmit,
  isSaving,
  autoNumber,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  initial: TableFormState;
  onSubmit: (data: TableFormState) => Promise<void>;
  isSaving: boolean;
  autoNumber?: number;
}) {
  const [form, setForm] = useState<TableFormState>(initial);

  function set(k: keyof TableFormState, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Fill in the table details below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="t-name">Table name <span className="text-destructive">*</span></Label>
            <Input
              id="t-name"
              placeholder="e.g. Window Seat"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>

          {/* Number + Display Order row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-number">
                Table number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="t-number"
                type="number"
                min={1}
                placeholder={String(autoNumber ?? "")}
                value={form.number}
                onChange={(e) => set("number", e.target.value)}
                required
              />
              {autoNumber !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Next available: {autoNumber}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-order">Display order</Label>
              <Input
                id="t-order"
                type="number"
                min={0}
                value={form.displayOrder}
                onChange={(e) => set("displayOrder", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Lower = appears first
              </p>
            </div>
          </div>

          {/* Capacity + Section row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-capacity">
                Capacity <span className="text-destructive">*</span>
              </Label>
              <Input
                id="t-capacity"
                type="number"
                min={1}
                max={999}
                placeholder="4"
                value={form.capacity}
                onChange={(e) => set("capacity", e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-section">Section / Zone</Label>
              <Input
                id="t-section"
                placeholder="e.g. Patio"
                value={form.section}
                onChange={(e) => set("section", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save table
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── QR Dialog ────────────────────────────────────────────────────────────────

function QRDialog({
  table,
  open,
  onOpenChange,
  onRegenerate,
  isRegenerating,
  canManage,
}: {
  table: ManagedTable | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRegenerate: (id: string) => Promise<unknown>;
  isRegenerating: boolean;
  canManage: boolean;
}) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  if (!table) return null;

  const url = qrUrl(table.qrCodeToken);
  const label = tableLabel(table.number, table.name);

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
      type: "image/svg+xml",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${label.replace(/\s+/g, "-").toLowerCase()}-qr.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handlePrint() {
    if (!url) return;
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const win = window.open("", "_blank", "width=480,height=600");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR — ${label}</title>
          <style>
            body { margin: 0; display: flex; flex-direction: column;
                   align-items: center; justify-content: center;
                   min-height: 100vh; font-family: sans-serif; gap: 16px; }
            h2 { margin: 0; font-size: 22px; }
            p { margin: 0; font-size: 13px; color: #666; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <h2>${label}</h2>
          ${new XMLSerializer().serializeToString(svg)}
          <p>Scan to view menu &amp; order</p>
          <script>window.onload = function() { window.print(); }<\/script>
        </body>
      </html>
    `);
    win.document.close();
  }

  async function handleRegenerate() {
    await onRegenerate(table.id);
    toast({ title: "QR code regenerated", description: "Old QR code is now invalid." });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{label} — QR Code</DialogTitle>
          {table.section && (
            <DialogDescription>{table.section}</DialogDescription>
          )}
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {url ? (
            <div ref={qrRef} className="bg-white p-3 rounded-xl border shadow-sm">
              <QRCode value={url} size={180} />
            </div>
          ) : (
            <div className="w-[204px] h-[204px] rounded-xl border-2 border-dashed bg-muted flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <QrCode className="h-10 w-10 opacity-30" />
              <span className="text-xs text-center px-3">No QR token — regenerate to create one</span>
            </div>
          )}

          {url && (
            <div className="w-full bg-muted rounded-lg px-3 py-2">
              <p className="text-xs text-muted-foreground font-mono break-all line-clamp-2">{url}</p>
            </div>
          )}

          <div className="w-full grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" disabled={!url} onClick={handleCopy}>
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              {copied ? "Copied!" : "Copy URL"}
            </Button>
            <Button size="sm" variant="outline" disabled={!url} onClick={handleDownload}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download
            </Button>
            <Button size="sm" variant="outline" disabled={!url} onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Print
            </Button>
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRegenerate}
                disabled={isRegenerating}
              >
                {isRegenerating ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Regenerate
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function TableRow({
  table,
  canManage,
  onEdit,
  onQR,
  onArchive,
  onRestore,
  isArchiving,
  isRestoring,
}: {
  table: ManagedTable;
  canManage: boolean;
  onEdit: (t: ManagedTable) => void;
  onQR: (t: ManagedTable) => void;
  onArchive: (t: ManagedTable) => void;
  onRestore: (t: ManagedTable) => void;
  isArchiving: boolean;
  isRestoring: boolean;
}) {
  const url = qrUrl(table.qrCodeToken);
  const label = tableLabel(table.number, table.name);

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border bg-card hover:bg-accent/30 transition-colors",
        !table.isActive && "opacity-60"
      )}
    >
      {/* Number badge */}
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary text-sm font-bold shrink-0">
        {table.number}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{label}</span>
          {table.section && (
            <Badge variant="secondary" className="text-xs">
              {table.section}
            </Badge>
          )}
          {!table.isActive && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Archived
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />
            {table.capacity} seats
          </span>
          {url ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <QrCode className="h-3 w-3" />
              QR ready
            </span>
          ) : (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <QrCode className="h-3 w-3" />
              No QR
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          title="View QR code"
          onClick={() => onQR(table)}
        >
          <QrCode className="h-4 w-4" />
        </Button>

        {canManage && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              title="Edit table"
              onClick={() => onEdit(table)}
            >
              <Pencil className="h-4 w-4" />
            </Button>

            {table.isActive ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                title="Archive table"
                disabled={isArchiving}
                onClick={() => onArchive(table)}
              >
                {isArchiving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                title="Restore table"
                disabled={isRestoring}
                onClick={() => onRestore(table)}
              >
                {isRestoring ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TablesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = user?.role === "owner" || user?.role === "manager";

  const {
    activeTables,
    archivedTables,
    isLoading,
    nextNumber,
    createTable,
    isCreating,
    updateTable,
    isUpdating,
    updatingTableId,
    archiveTable,
    isArchiving,
    archivingTableId,
    restoreTable,
    isRestoring,
    restoringTableId,
    regenerateQr,
    isRegeneratingQr,
    regeneratingTableId,
  } = useTableManagement();

  // ── Dialog state ─────────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ManagedTable | null>(null);
  const [qrTarget, setQrTarget] = useState<ManagedTable | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ManagedTable | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // ── Add ──────────────────────────────────────────────────────────────────
  function openAdd() {
    setAddOpen(true);
  }

  async function handleCreate(form: TableFormState) {
    const num = parseInt(form.number) || nextNumber;
    try {
      await createTable({
        name:         form.name,
        number:       num,
        capacity:     parseInt(form.capacity) || 4,
        section:      form.section || undefined,
        displayOrder: parseInt(form.displayOrder) || num,
      });
      setAddOpen(false);
      toast({ title: "Table added", description: `${form.name} is ready with a QR code.` });
    } catch (err: any) {
      const msg = err?.message ?? "Failed to create table";
      const isUnique = msg.includes("unique") || msg.includes("duplicate");
      toast({
        title: "Could not add table",
        description: isUnique
          ? `Table number ${num} is already taken. Choose a different number.`
          : msg,
        variant: "destructive",
      });
    }
  }

  // ── Edit ─────────────────────────────────────────────────────────────────
  async function handleEdit(form: TableFormState) {
    if (!editTarget) return;
    try {
      await updateTable({
        id: editTarget.id,
        input: {
          name:         form.name,
          number:       parseInt(form.number) || editTarget.number,
          capacity:     parseInt(form.capacity) || editTarget.capacity,
          section:      form.section || null,
          displayOrder: parseInt(form.displayOrder) || editTarget.displayOrder,
        },
      });
      setEditTarget(null);
      toast({ title: "Table updated" });
    } catch (err: any) {
      const msg = err?.message ?? "Failed to update table";
      toast({ title: "Could not update table", description: msg, variant: "destructive" });
    }
  }

  // ── Archive ───────────────────────────────────────────────────────────────
  async function confirmArchive() {
    if (!archiveTarget) return;
    try {
      await archiveTable(archiveTarget.id);
      setArchiveTarget(null);
      toast({ title: "Table archived", description: "It won't appear to customers anymore." });
    } catch (err: any) {
      toast({ title: "Archive failed", description: err?.message, variant: "destructive" });
    }
  }

  // ── Restore ───────────────────────────────────────────────────────────────
  async function handleRestore(table: ManagedTable) {
    try {
      await restoreTable(table.id);
      toast({ title: "Table restored", description: `${tableLabel(table.number, table.name)} is active again.` });
    } catch (err: any) {
      toast({ title: "Restore failed", description: err?.message, variant: "destructive" });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <PageHeader
        icon={TableProperties}
        title="Tables"
        description="Manage your café tables, sections, and QR codes."
        action={
          canManage ? (
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add table
            </Button>
          ) : undefined
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          {
            label: "Total tables",
            value: activeTables.length + archivedTables.length,
            icon: Layers,
          },
          {
            label: "Active",
            value: activeTables.length,
            icon: CheckCircle2,
            accent: true,
          },
          {
            label: "Archived",
            value: archivedTables.length,
            icon: Archive,
          },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={cn("text-2xl font-bold mt-0.5", s.accent ? "text-primary" : "text-foreground")}>
                  {isLoading ? "—" : s.value}
                </p>
              </div>
              <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg", s.accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                <s.icon className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Active tables */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : activeTables.length === 0 ? (
        <EmptyState
          icon={TableProperties}
          title="No tables yet"
          description={
            canManage
              ? "Add your first table to generate a QR code for customers."
              : "No tables have been set up yet."
          }
          action={
            canManage ? (
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add table
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {activeTables.map((t) => (
            <TableRow
              key={t.id}
              table={t}
              canManage={canManage}
              onEdit={setEditTarget}
              onQR={setQrTarget}
              onArchive={setArchiveTarget}
              onRestore={handleRestore}
              isArchiving={isArchiving && archivingTableId === t.id}
              isRestoring={isRestoring && restoringTableId === t.id}
            />
          ))}
        </div>
      )}

      {/* Archived section */}
      {archivedTables.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowArchived((p) => !p)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            {showArchived ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Archived tables ({archivedTables.length})
          </button>

          {showArchived && (
            <div className="space-y-2">
              {archivedTables.map((t) => (
                <TableRow
                  key={t.id}
                  table={t}
                  canManage={canManage}
                  onEdit={setEditTarget}
                  onQR={setQrTarget}
                  onArchive={setArchiveTarget}
                  onRestore={handleRestore}
                  isArchiving={isArchiving && archivingTableId === t.id}
                  isRestoring={isRestoring && restoringTableId === t.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}

      {/* Add */}
      <TableFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add table"
        autoNumber={nextNumber}
        initial={{
          name: "",
          number: String(nextNumber),
          capacity: "4",
          section: "",
          displayOrder: String(nextNumber),
        }}
        onSubmit={handleCreate}
        isSaving={isCreating}
      />

      {/* Edit */}
      {editTarget && (
        <TableFormDialog
          open={!!editTarget}
          onOpenChange={(v) => { if (!v) setEditTarget(null); }}
          title={`Edit — ${tableLabel(editTarget.number, editTarget.name)}`}
          initial={{
            name:         editTarget.name,
            number:       String(editTarget.number),
            capacity:     String(editTarget.capacity),
            section:      editTarget.section ?? "",
            displayOrder: String(editTarget.displayOrder),
          }}
          onSubmit={handleEdit}
          isSaving={isUpdating && updatingTableId === editTarget.id}
        />
      )}

      {/* QR */}
      <QRDialog
        table={qrTarget}
        open={!!qrTarget}
        onOpenChange={(v) => { if (!v) setQrTarget(null); }}
        onRegenerate={regenerateQr}
        isRegenerating={isRegeneratingQr && regeneratingTableId === qrTarget?.id}
        canManage={canManage}
      />

      {/* Archive confirm */}
      <AlertDialog
        open={!!archiveTarget}
        onOpenChange={(v) => { if (!v) setArchiveTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this table?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget && (
                <>
                  <strong>{tableLabel(archiveTarget.number, archiveTarget.name)}</strong> will
                  be hidden from customers. Existing sessions and QR codes will stop working.
                  You can restore it at any time.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmArchive}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Archive table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

