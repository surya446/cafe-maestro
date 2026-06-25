import { useState, useRef, useEffect } from "react";
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
  Layers,
  ChevronDown,
  ChevronRight,
  Printer,
  Wrench,
  Trash2,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import QRCode from "react-qr-code";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { useTableManagement, ManagedTable, TableStatus } from "@/hooks/useTableManagement";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tableLabel(number: number, name: string) {
  return name ? `${name} (${number})` : `Table ${number}`;
}

function qrUrl(token: string | null): string | null {
  if (!token) return null;
  return `${window.location.origin}${import.meta.env.BASE_URL}table/${token}`;
}

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  TableStatus,
  { label: string; icon: React.FC<{ className?: string }>; badgeCls: string; cardCls: string; cardActiveCls: string }
> = {
  free:        { label: "Free",        icon: Circle,        badgeCls: "bg-emerald-100 text-emerald-700 border-emerald-200", cardCls: "text-emerald-700",  cardActiveCls: "ring-2 ring-emerald-400 bg-emerald-50/50" },
  busy:        { label: "Busy",        icon: Clock,         badgeCls: "bg-blue-100 text-blue-700 border-blue-200",         cardCls: "text-blue-700",     cardActiveCls: "ring-2 ring-blue-400 bg-blue-50/50" },
  booked:      { label: "Booked",      icon: CalendarClock, badgeCls: "bg-amber-100 text-amber-700 border-amber-200",      cardCls: "text-amber-700",    cardActiveCls: "ring-2 ring-amber-400 bg-amber-50/50" },
  maintenance: { label: "Maintenance", icon: Wrench,        badgeCls: "bg-orange-100 text-orange-700 border-orange-200",   cardCls: "text-orange-700",   cardActiveCls: "ring-2 ring-orange-400 bg-orange-50/50" },
  archived:    { label: "Archived",    icon: Archive,       badgeCls: "bg-zinc-100 text-zinc-500 border-zinc-200",         cardCls: "text-zinc-500",     cardActiveCls: "ring-2 ring-zinc-400 bg-zinc-50/50" },
};

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TableStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.free;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border", cfg.badgeCls)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
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
          <DialogDescription>Fill in the table details below.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-number">Table number <span className="text-destructive">*</span></Label>
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
                <p className="text-xs text-muted-foreground">Next available: {autoNumber}</p>
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
              <p className="text-xs text-muted-foreground">Lower = appears first</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-capacity">Capacity <span className="text-destructive">*</span></Label>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
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

  const url   = qrUrl(table.qrCodeToken);
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
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
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
    win.document.write(`<!DOCTYPE html><html><head><title>QR — ${label}</title>
      <style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;gap:16px}h2{margin:0;font-size:22px}p{margin:0;font-size:13px;color:#666}@media print{body{padding:20px}}</style>
      </head><body><h2>${label}</h2>${new XMLSerializer().serializeToString(svg)}<p>Scan to view menu &amp; order</p>
      <script>window.onload=function(){window.print()}<\/script></body></html>`);
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
          {table.section && <DialogDescription>{table.section}</DialogDescription>}
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
              <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={isRegenerating}>
                {isRegenerating
                  ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                Regenerate
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bookings Panel ───────────────────────────────────────────────────────────

function BookingsPanel({ table }: { table: ManagedTable }) {
  const [open, setOpen] = useState(false);
  const count = table.todayBookings.length;

  if (count === 0) return null;

  const confirmedCount = table.todayBookings.filter(b => b.status === "confirmed").length;

  return (
    <div className="mt-2 border-t border-border/50 pt-2">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <CalendarClock className="h-3.5 w-3.5" />
        Today: {confirmedCount} confirmed booking{confirmedCount !== 1 ? "s" : ""}
        {count > confirmedCount && <span className="text-muted-foreground/60">({count - confirmedCount} pending)</span>}
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {table.todayBookings
            .slice()
            .sort((a, b) => a.bookingTime.localeCompare(b.bookingTime))
            .map((b) => (
              <div key={b.id} className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-lg">
                <div>
                  <span className="text-sm font-medium">{b.guestName}</span>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span>{fmtTime(b.bookingTime)}</span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <Users className="h-3 w-3" />
                      {b.partySize} guests
                    </span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs capitalize",
                    b.status === "confirmed" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                    b.status === "pending"   && "border-amber-200 bg-amber-50 text-amber-700"
                  )}
                >
                  {b.status}
                </Badge>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ─── Table Card ───────────────────────────────────────────────────────────────

function TableCard({
  table,
  canManage,
  onEdit,
  onQR,
  onArchive,
  onRestore,
  onToggleMaintenance,
  onPermanentDelete,
  isArchiving,
  isRestoring,
  isTogglingMaintenance,
  isCheckingDelete,
}: {
  table: ManagedTable;
  canManage: boolean;
  onEdit: (t: ManagedTable) => void;
  onQR: (t: ManagedTable) => void;
  onArchive: (t: ManagedTable) => void;
  onRestore: (t: ManagedTable) => void;
  onToggleMaintenance: (t: ManagedTable) => void;
  onPermanentDelete: (t: ManagedTable) => void;
  isArchiving: boolean;
  isRestoring: boolean;
  isTogglingMaintenance: boolean;
  isCheckingDelete: boolean;
}) {
  const isArchived = !table.isActive;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md",
        isArchived && "opacity-60",
        table.status === "maintenance" && "border-orange-200 bg-orange-50/20"
      )}
    >
      <div className="px-4 py-4">
        {/* Responsive layout: stacked on mobile, single row on sm+ */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">

          {/* ── Level 1 + 2: Identity block ───────────────────────── */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Number badge */}
            <div className={cn(
              "flex items-center justify-center w-10 h-10 rounded-xl text-sm font-bold shrink-0",
              isArchived
                ? "bg-zinc-100 text-zinc-500"
                : table.status === "busy"        ? "bg-blue-100 text-blue-700"
                : table.status === "booked"      ? "bg-amber-100 text-amber-700"
                : table.status === "maintenance" ? "bg-orange-100 text-orange-700"
                : "bg-emerald-50 text-emerald-700"
            )}>
              {table.number}
            </div>

            <div className="min-w-0 flex-1">
              {/* Level 1: Name + Status */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm leading-snug">
                  {table.name || `Table ${table.number}`}
                </span>
                <StatusBadge status={table.status} />
              </div>
              {/* Level 2: Seats + QR + Section */}
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />{table.capacity} seats
                </span>
                <span className="opacity-40">•</span>
                {table.qrCodeToken
                  ? <span className="flex items-center gap-1 text-emerald-600"><QrCode className="h-3 w-3" />QR ready</span>
                  : <span className="flex items-center gap-1 text-amber-600"><QrCode className="h-3 w-3" />No QR</span>
                }
                {table.section && (
                  <><span className="opacity-40">•</span><span className="truncate">{table.section}</span></>
                )}
              </div>
            </div>
          </div>

          {/* ── Level 3: Maintenance toggle ───────────────────────── */}
          {/* Mobile: indented row with label; sm+: compact inline */}
          {canManage && !isArchived && (
            <div className="flex items-center justify-between sm:justify-normal gap-3 pl-[52px] sm:pl-0 sm:shrink-0">
              <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 sm:hidden">
                <Wrench className="h-3 w-3" />
                Maintenance
              </span>
              <div className="flex items-center gap-2">
                {isTogglingMaintenance
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  : table.isUnderMaintenance
                  ? <Wrench className="h-3.5 w-3.5 text-orange-500 hidden sm:block" />
                  : null
                }
                <Switch
                  id={`maint-${table.id}`}
                  checked={table.isUnderMaintenance}
                  onCheckedChange={() => onToggleMaintenance(table)}
                  disabled={isTogglingMaintenance}
                  aria-label={table.isUnderMaintenance ? "Under maintenance" : "Mark as under maintenance"}
                />
              </div>
            </div>
          )}

          {/* ── Level 4: Actions ──────────────────────────────────── */}
          {/* Mobile: indented row; sm+: right-aligned group */}
          <div className="flex items-center gap-1 pl-[52px] sm:pl-0 sm:shrink-0">
            <Button
              size="sm" variant="ghost"
              className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
              title="View QR code"
              onClick={() => onQR(table)}
            >
              <QrCode className="h-4 w-4" />
            </Button>

            {canManage && (
              <>
                {!isArchived && (
                  <Button
                    size="sm" variant="ghost"
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
                    title="Edit table"
                    onClick={() => onEdit(table)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}

                {isArchived ? (
                  <>
                    <Button
                      size="sm" variant="ghost"
                      className="h-9 w-9 p-0 text-muted-foreground hover:text-primary"
                      title="Restore table" disabled={isRestoring}
                      onClick={() => onRestore(table)}
                    >
                      {isRestoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                      title="Permanently delete" disabled={isCheckingDelete}
                      onClick={() => onPermanentDelete(table)}
                    >
                      {isCheckingDelete ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm" variant="ghost"
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                    title="Archive table" disabled={isArchiving}
                    onClick={() => onArchive(table)}
                  >
                    {isArchiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                  </Button>
                )}
              </>
            )}
          </div>

        </div>
      </div>

      {/* Today's bookings (expandable) */}
      <BookingsPanel table={table} />
    </div>
  );
}

// ─── Delete check helpers ─────────────────────────────────────────────────────

type DeleteFlow =
  | null
  | { phase: "confirm";  table: ManagedTable }
  | { phase: "blocked";  table: ManagedTable; refs: { orders: number; sessions: number; bookings: number } };

async function checkTableRefs(tableId: string) {
  const [ordersRes, sessionsRes, bookingsRes] = await Promise.all([
    supabase.from("orders")        .select("id", { count: "exact", head: true }).eq("table_id", tableId),
    supabase.from("table_sessions").select("id", { count: "exact", head: true }).eq("table_id", tableId),
    supabase.from("bookings")      .select("id", { count: "exact", head: true }).eq("table_id", tableId),
  ]);
  return {
    orders:   ordersRes.count   ?? 0,
    sessions: sessionsRes.count ?? 0,
    bookings: bookingsRes.count ?? 0,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TablesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = user?.role === "owner" || user?.role === "manager";

  const {
    activeTables,
    archivedTables,
    tables,
    isLoading,
    nextNumber,
    createTable,         isCreating,
    updateTable,         isUpdating,       updatingTableId,
    toggleMaintenance,   isTogglingMaintenance, togglingMaintenanceId,
    archiveTable,        isArchiving,      archivingTableId,
    restoreTable,        isRestoring,      restoringTableId,
    permanentDelete,     isDeletingPermanent,
    regenerateQr,        isRegeneratingQr, regeneratingTableId,
  } = useTableManagement();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState<TableStatus | null>(null);

  function toggleFilter(s: TableStatus) {
    setActiveFilter((p) => (p === s ? null : s));
  }

  // ── Derived counts ────────────────────────────────────────────────────────
  const statusCounts = {
    free:        activeTables.filter((t) => t.status === "free").length,
    busy:        activeTables.filter((t) => t.status === "busy").length,
    booked:      activeTables.filter((t) => t.status === "booked").length,
    maintenance: activeTables.filter((t) => t.status === "maintenance").length,
    archived:    archivedTables.length,
  };

  // ── Filtered display lists ─────────────────────────────────────────────────
  const displayedActive = activeFilter === null || activeFilter === "archived"
    ? (activeFilter === "archived" ? [] : activeTables)
    : activeTables.filter((t) => t.status === activeFilter);

  const displayedArchived = activeFilter === null
    ? archivedTables
    : activeFilter === "archived"
    ? archivedTables
    : [];

  const showArchivedAsMain = activeFilter === "archived";

  // ── Stats grid: measure container width to drive column count ────────────
  const statsGridRef = useRef<HTMLDivElement>(null);
  const [statsWidth, setStatsWidth] = useState(9999);

  useEffect(() => {
    const el = statsGridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setStatsWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // <380px → 2 cols (mobile), <640px → 3×2 rows (narrow/sidebar expanded), ≥640px → 6×1 row
  const statsGridCols =
    statsWidth < 380 ? "grid-cols-2" :
    statsWidth < 640 ? "grid-cols-3" :
    "grid-cols-6";

  // ── Dialog state ─────────────────────────────────────────────────────────
  const [addOpen,        setAddOpen]        = useState(false);
  const [editTarget,     setEditTarget]     = useState<ManagedTable | null>(null);
  const [qrTarget,       setQrTarget]       = useState<ManagedTable | null>(null);
  const [archiveTarget,  setArchiveTarget]  = useState<ManagedTable | null>(null);
  const [showArchived,   setShowArchived]   = useState(false);
  const [deleteFlow,     setDeleteFlow]     = useState<DeleteFlow>(null);
  const [checkingDeleteId, setCheckingDeleteId] = useState<string | null>(null);

  // ── Handlers ─────────────────────────────────────────────────────────────

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
      toast({
        title: "Could not add table",
        description: (msg.includes("unique") || msg.includes("duplicate"))
          ? `Table number ${num} is already taken.`
          : msg,
        variant: "destructive",
      });
    }
  }

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
      toast({ title: "Could not update table", description: err?.message, variant: "destructive" });
    }
  }

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

  async function handleRestore(table: ManagedTable) {
    try {
      await restoreTable(table.id);
      toast({ title: "Table restored", description: `${tableLabel(table.number, table.name)} is active again.` });
    } catch (err: any) {
      toast({ title: "Restore failed", description: err?.message, variant: "destructive" });
    }
  }

  async function handleToggleMaintenance(table: ManagedTable) {
    const next = !table.isUnderMaintenance;
    try {
      await toggleMaintenance({ tableId: table.id, maintenance: next });
      toast({
        title: next ? "Table under maintenance" : "Maintenance ended",
        description: next
          ? `${tableLabel(table.number, table.name)} is now blocked from new sessions.`
          : `${tableLabel(table.number, table.name)} is available again.`,
      });
    } catch (err: any) {
      toast({ title: "Could not update maintenance status", description: err?.message, variant: "destructive" });
    }
  }

  async function handleStartDeleteCheck(table: ManagedTable) {
    setCheckingDeleteId(table.id);
    try {
      const refs = await checkTableRefs(table.id);
      if (refs.orders > 0 || refs.sessions > 0 || refs.bookings > 0) {
        setDeleteFlow({ phase: "blocked", table, refs });
      } else {
        setDeleteFlow({ phase: "confirm", table });
      }
    } catch {
      toast({ title: "Could not check references", variant: "destructive" });
    } finally {
      setCheckingDeleteId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteFlow || deleteFlow.phase !== "confirm") return;
    const table = deleteFlow.table;
    try {
      await permanentDelete(table.id);
      setDeleteFlow(null);
      toast({ title: "Table permanently deleted", description: `${tableLabel(table.number, table.name)} has been removed.` });
    } catch (err: any) {
      if (err.message === "HAS_REFERENCES") {
        setDeleteFlow({ phase: "blocked", table, refs: { orders: err.orders, sessions: err.sessions, bookings: err.bookings } });
      } else {
        toast({ title: "Delete failed", description: err?.message, variant: "destructive" });
      }
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
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add table
            </Button>
          ) : undefined
        }
      />

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div ref={statsGridRef} className={`grid ${statsGridCols} gap-2 mb-6 transition-[grid-template-columns] duration-300`}>
        <button
          onClick={() => setActiveFilter(null)}
          className={cn(
            "text-left bg-card border border-border rounded-xl px-4 py-4 shadow-sm transition-all hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            activeFilter === null && "ring-2 ring-primary bg-primary/5"
          )}
        >
          <p className="text-2xl font-bold tabular-nums text-foreground leading-none">
            {isLoading ? "—" : tables.length}
          </p>
          <p className="text-xs text-muted-foreground mt-2 leading-none">Total</p>
        </button>

        {(["free", "busy", "booked", "maintenance", "archived"] as TableStatus[]).map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => toggleFilter(s)}
              className={cn(
                "text-left bg-card border border-border rounded-xl px-4 py-4 shadow-sm transition-all hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                activeFilter === s && cfg.cardActiveCls
              )}
            >
              <p className={cn("text-2xl font-bold tabular-nums leading-none", cfg.cardCls)}>
                {isLoading ? "—" : statusCounts[s]}
              </p>
              <p className="text-xs text-muted-foreground mt-2 leading-none">{cfg.label}</p>
            </button>
          );
        })}
      </div>

      {/* ── Active filter pill ─────────────────────────────────────────────── */}
      {activeFilter !== null && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">Showing:</span>
          <button
            onClick={() => setActiveFilter(null)}
            className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border cursor-pointer hover:opacity-80", STATUS_CONFIG[activeFilter].badgeCls)}
          >
            {STATUS_CONFIG[activeFilter].label}
            <span className="text-xs opacity-60">✕</span>
          </button>
        </div>
      )}

      {/* ── Main table list ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : showArchivedAsMain ? (
        /* Archived filter selected — show archived tables as main content */
        archivedTables.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="No archived tables"
            description="Tables you archive will appear here. They can be restored or permanently deleted."
          />
        ) : (
          <div className="space-y-3">
            {archivedTables.map((t) => (
              <TableCard
                key={t.id}
                table={t}
                canManage={canManage}
                onEdit={setEditTarget}
                onQR={setQrTarget}
                onArchive={setArchiveTarget}
                onRestore={handleRestore}
                onToggleMaintenance={handleToggleMaintenance}
                onPermanentDelete={handleStartDeleteCheck}
                isArchiving={false}
                isRestoring={isRestoring && restoringTableId === t.id}
                isTogglingMaintenance={false}
                isCheckingDelete={checkingDeleteId === t.id}
              />
            ))}
          </div>
        )
      ) : displayedActive.length === 0 && activeFilter !== null ? (
        <EmptyState
          icon={STATUS_CONFIG[activeFilter].icon}
          title={`No ${STATUS_CONFIG[activeFilter].label.toLowerCase()} tables`}
          description={`There are currently no tables with status "${STATUS_CONFIG[activeFilter].label.toLowerCase()}".`}
          action={
            <Button variant="outline" size="sm" onClick={() => setActiveFilter(null)}>
              Show all tables
            </Button>
          }
        />
      ) : activeTables.length === 0 && activeFilter === null ? (
        <EmptyState
          icon={TableProperties}
          title="No tables yet"
          description={canManage ? "Add your first table to generate a QR code for customers." : "No tables have been set up yet."}
          action={
            canManage ? (
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add table
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {displayedActive.map((t) => (
            <TableCard
              key={t.id}
              table={t}
              canManage={canManage}
              onEdit={setEditTarget}
              onQR={setQrTarget}
              onArchive={setArchiveTarget}
              onRestore={handleRestore}
              onToggleMaintenance={handleToggleMaintenance}
              onPermanentDelete={handleStartDeleteCheck}
              isArchiving={isArchiving && archivingTableId === t.id}
              isRestoring={false}
              isTogglingMaintenance={isTogglingMaintenance && togglingMaintenanceId === t.id}
              isCheckingDelete={checkingDeleteId === t.id}
            />
          ))}
        </div>
      )}

      {/* ── Archived section (collapsible, shown when filter is null) ────── */}
      {!showArchivedAsMain && displayedArchived.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowArchived((p) => !p)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Archived tables ({displayedArchived.length})
          </button>

          {showArchived && (
            <div className="space-y-3">
              {displayedArchived.map((t) => (
                <TableCard
                  key={t.id}
                  table={t}
                  canManage={canManage}
                  onEdit={setEditTarget}
                  onQR={setQrTarget}
                  onArchive={setArchiveTarget}
                  onRestore={handleRestore}
                  onToggleMaintenance={handleToggleMaintenance}
                  onPermanentDelete={handleStartDeleteCheck}
                  isArchiving={false}
                  isRestoring={isRestoring && restoringTableId === t.id}
                  isTogglingMaintenance={false}
                  isCheckingDelete={checkingDeleteId === t.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Dialogs ────────────────────────────────────────────────────────── */}

      {/* Add */}
      <TableFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add table"
        autoNumber={nextNumber}
        initial={{ name: "", number: String(nextNumber), capacity: "4", section: "", displayOrder: String(nextNumber) }}
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
      <AlertDialog open={!!archiveTarget} onOpenChange={(v) => { if (!v) setArchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this table?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget && (
                <>
                  <strong>{tableLabel(archiveTarget.number, archiveTarget.name)}</strong> will be hidden from customers.
                  Existing sessions and QR codes will stop working. You can restore it at any time.
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

      {/* Permanent delete — confirmation */}
      <AlertDialog
        open={deleteFlow?.phase === "confirm"}
        onOpenChange={(v) => { if (!v) setDeleteFlow(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Permanently delete table?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteFlow?.phase === "confirm" && (
                <>
                  <strong>{tableLabel(deleteFlow.table.number, deleteFlow.table.name)}</strong> has no historical
                  records and will be permanently removed. This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingPermanent}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeletingPermanent}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingPermanent && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent delete — blocked by references */}
      <Dialog
        open={deleteFlow?.phase === "blocked"}
        onOpenChange={(v) => { if (!v) setDeleteFlow(null); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Cannot delete — historical records exist
            </DialogTitle>
            <DialogDescription>
              {deleteFlow?.phase === "blocked" && (
                <>
                  <strong>{tableLabel(deleteFlow.table.number, deleteFlow.table.name)}</strong> has historical
                  data that must be preserved.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {deleteFlow?.phase === "blocked" && (
            <div className="space-y-2 py-2">
              {deleteFlow.refs.orders > 0 && (
                <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg text-sm">
                  <span>Orders</span>
                  <Badge variant="secondary">{deleteFlow.refs.orders}</Badge>
                </div>
              )}
              {deleteFlow.refs.sessions > 0 && (
                <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg text-sm">
                  <span>Sessions</span>
                  <Badge variant="secondary">{deleteFlow.refs.sessions}</Badge>
                </div>
              )}
              {deleteFlow.refs.bookings > 0 && (
                <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg text-sm">
                  <span>Bookings</span>
                  <Badge variant="secondary">{deleteFlow.refs.bookings}</Badge>
                </div>
              )}
              <p className="text-xs text-muted-foreground pt-1">
                Archived tables with historical records are kept for reporting and audit purposes.
                You can restore this table if you need to reuse it.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFlow(null)}>Got it</Button>
            {deleteFlow?.phase === "blocked" && (
              <Button
                variant="secondary"
                onClick={() => {
                  const t = deleteFlow.table;
                  setDeleteFlow(null);
                  handleRestore(t);
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restore instead
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
