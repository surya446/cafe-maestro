import { useState, useMemo, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  ClipboardList,
  Loader2,
  Clock,
  Users,
  QrCode,
  Receipt,
  ChefHat,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Download,
  Printer,
  RefreshCw,
  Smartphone,
  TableProperties,
  Bell,
  User,
  Trash2,
  RotateCcw,
  DollarSign,
  BellRing,
  Plus,
} from "lucide-react";
import QRCode from "react-qr-code";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrders, StaffOrder, OrderStatus } from "@/hooks/useOrders";
import { useTableSessions, CafeTable } from "@/hooks/useTableSessions";
import { useTableGroups, TableOverview, SessionInGroup } from "@/hooks/useTableGroups";
import { useBillRequests, BillRequest } from "@/hooks/useBillRequests";
import { useTableManagement } from "@/hooks/useTableManagement";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tableLabel(num: number | null, name: string | null) {
  if (name && num !== null) return `${name} (${num})`;
  if (num !== null) return `Table ${num}`;
  return "Unknown table";
}

function timeAgo(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

function expiresIn(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d <= now) return "Expired";
  return `${formatDistanceToNow(d)}`;
}

// ─── Order Card ───────────────────────────────────────────────────────────────

const STATUS_NEXT: Partial<Record<OrderStatus, { label: string; next: OrderStatus }>> = {
  approved:   { label: "Start Preparing", next: "in_kitchen" },
  in_kitchen: { label: "Mark Ready",      next: "ready"      },
  ready:      { label: "Mark Served",     next: "served"      },
};

function OrderCard({
  order,
  onUpdate,
  isUpdating,
}: {
  order: StaffOrder;
  onUpdate: (id: string, status: OrderStatus, note?: string | null) => Promise<void>;
  isUpdating: boolean;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [busy, setBusy] = useState(false);

  const label = tableLabel(order.tableNumber, order.tableName);
  const advance = STATUS_NEXT[order.status];

  async function handleAction(status: OrderStatus, note?: string | null) {
    setBusy(true);
    try {
      await onUpdate(order.id, status, note);
    } finally {
      setBusy(false);
      setRejecting(false);
      setRejectNote("");
    }
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="min-w-0">
          <span className="font-semibold text-sm">{label}</span>
          {order.customerName && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {order.customerName}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground shrink-0 ml-2">{timeAgo(order.createdAt)}</span>
      </div>

      {/* Items */}
      <div className="px-3 py-2 space-y-1 flex-1">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-start gap-2 text-sm">
            <span className="shrink-0 font-medium text-primary w-5 text-right">{item.quantity}×</span>
            <div className="min-w-0">
              <span className="text-foreground">{item.name}</span>
              {item.notes && (
                <p className="text-xs text-muted-foreground italic truncate">{item.notes}</p>
              )}
            </div>
            <span className="ml-auto shrink-0 text-muted-foreground text-xs">
              {formatCurrency(item.unitPrice * item.quantity)}
            </span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t bg-muted/30">
        <span className="text-xs text-muted-foreground">Total</span>
        <span className="text-sm font-semibold">{formatCurrency(order.total)}</span>
      </div>

      {/* Staff note display */}
      {order.staffNote && (
        <div className="px-3 py-1.5 bg-amber-50 border-t border-amber-100">
          <p className="text-xs text-amber-800">{order.staffNote}</p>
        </div>
      )}

      {/* Actions */}
      <div className="px-3 py-2.5 border-t space-y-2">
        {order.status === "pending_approval" && !rejecting && (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={busy}
              onClick={() => handleAction("approved")}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-destructive border-destructive/40 hover:bg-destructive/10"
              disabled={busy}
              onClick={() => setRejecting(true)}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Reject
            </Button>
          </div>
        )}

        {order.status === "pending_approval" && rejecting && (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Reason for rejection (optional)"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-destructive"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                disabled={busy}
                onClick={() => handleAction("cancelled", rejectNote || null)}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Confirm Reject
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="flex-1"
                onClick={() => { setRejecting(false); setRejectNote(""); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {advance && (
          <Button
            size="sm"
            className="w-full"
            disabled={busy}
            onClick={() => handleAction(advance.next)}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            {advance.label}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Orders Tab ───────────────────────────────────────────────────────────────

function KitchenColumn({
  title,
  color,
  orders,
  onUpdate,
  isUpdating,
  emptyText,
}: {
  title: string;
  color: string;
  orders: StaffOrder[];
  onUpdate: (id: string, status: OrderStatus, note?: string | null) => Promise<void>;
  isUpdating: boolean;
  emptyText: string;
}) {
  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className={cn("flex items-center justify-between px-3 py-2 rounded-lg font-medium text-sm", color)}>
        <span>{title}</span>
        <span className="ml-2 bg-white/30 rounded-full px-2 py-0.5 text-xs font-bold">{orders.length}</span>
      </div>
      <div className="space-y-2">
        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onUpdate={onUpdate}
              isUpdating={isUpdating}
            />
          ))
        )}
      </div>
    </div>
  );
}

function OrdersTab() {
  const { pendingOrders, preparingOrders, readyOrders, isLoading, updateStatus, isUpdating } =
    useOrders();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <KitchenColumn
        title="Pending Approval"
        color="bg-amber-100 text-amber-900"
        orders={pendingOrders}
        onUpdate={updateStatus}
        isUpdating={isUpdating}
        emptyText="No orders waiting"
      />
      <KitchenColumn
        title="Preparing"
        color="bg-blue-100 text-blue-900"
        orders={preparingOrders}
        onUpdate={updateStatus}
        isUpdating={isUpdating}
        emptyText="Kitchen is clear"
      />
      <KitchenColumn
        title="Ready to Serve"
        color="bg-emerald-100 text-emerald-900"
        orders={readyOrders}
        onUpdate={updateStatus}
        isUpdating={isUpdating}
        emptyText="Nothing ready yet"
      />
    </div>
  );
}

// ─── Tables Tab ───────────────────────────────────────────────────────────────

function TableStatusBadge({ status }: { status: "active" | "bill_requested" }) {
  if (status === "bill_requested") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
        <BellRing className="h-3 w-3" />
        Bill Requested
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Active
    </span>
  );
}

function TableCard({
  table,
  onEndSession,
  isEndingSession,
  endingSessionId,
  onRequestBill,
  isRequestingBill,
  onClearTable,
  isClearingTable,
}: {
  table: TableOverview;
  onEndSession: (sessionId: string) => Promise<void>;
  isEndingSession: boolean;
  endingSessionId: string | undefined;
  onRequestBill: (tableId: string) => Promise<string>;
  isRequestingBill: boolean;
  onClearTable: (tableId: string) => Promise<void>;
  isClearingTable: boolean;
}) {
  const label = tableLabel(table.tableNumber, table.tableName);
  const [confirmEndId, setConfirmEndId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busyEnd, setBusyEnd] = useState(false);
  const [busyBill, setBusyBill] = useState(false);
  const [busyClear, setBusyClear] = useState(false);

  async function handleEndSession(sessionId: string) {
    setBusyEnd(true);
    try {
      await onEndSession(sessionId);
    } catch (err) {
      console.error("[end_session]", err);
    } finally {
      setBusyEnd(false);
      setConfirmEndId(null);
    }
  }

  async function handleRequestBill() {
    setBusyBill(true);
    try {
      await onRequestBill(table.tableId);
    } catch (err) {
      console.error("[staff_request_bill]", err);
    } finally {
      setBusyBill(false);
    }
  }

  async function handleClearTable() {
    setBusyClear(true);
    try {
      await onClearTable(table.tableId);
    } catch (err) {
      console.error("[clear_table]", err);
    } finally {
      setBusyClear(false);
      setConfirmClear(false);
    }
  }

  return (
    <div className="rounded-xl border overflow-hidden shadow-sm">
      {/* ── Table header ──────────────────────────────────────────── */}
      <div
        className={cn(
          "px-4 py-3 border-b",
          table.tableStatus === "bill_requested"
            ? "bg-amber-50"
            : "bg-muted/40"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Left: label + status + guests */}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <TableProperties className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-semibold text-sm">{label}</span>
              <TableStatusBadge status={table.tableStatus} />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground pl-6">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {table.guestCount} {table.guestCount === 1 ? "guest" : "guests"}
              </span>
              <span className="flex items-center gap-1 font-semibold text-foreground">
                <DollarSign className="h-3 w-3" />
                {formatCurrency(table.total)}
              </span>
              {table.billRequestedAt && (
                <span className="flex items-center gap-1 text-amber-700">
                  <BellRing className="h-3 w-3" />
                  {timeAgo(table.billRequestedAt)}
                </span>
              )}
            </div>
          </div>

          {/* Right: Request Bill */}
          {table.tableStatus === "active" && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
              disabled={busyBill || isRequestingBill}
              onClick={handleRequestBill}
            >
              {busyBill ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Receipt className="h-3.5 w-3.5" />
              )}
              Request Bill
            </Button>
          )}
        </div>
      </div>

      {/* ── Guest rows ────────────────────────────────────────────── */}
      {table.sessions.length === 0 ? (
        <div className="px-4 py-4 text-xs text-muted-foreground italic">
          No active guests — sessions may have expired.
        </div>
      ) : (
        <div className="divide-y">
          {table.sessions.map((session) => {
            const isConfirming = confirmEndId === session.id;
            const isEnding = isEndingSession && endingSessionId === session.id;

            return (
              <div
                key={session.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
              >
                {/* Avatar + name */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {session.customerName || "Guest"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Started {format(new Date(session.createdAt), "HH:mm")}
                    </p>
                  </div>
                </div>

                {/* Expiry */}
                <div className="hidden sm:block shrink-0">
                  <span
                    className={cn(
                      "text-xs",
                      new Date(session.expiresAt) <= new Date()
                        ? "text-destructive font-medium"
                        : "text-muted-foreground"
                    )}
                  >
                    {expiresIn(session.expiresAt)}
                  </span>
                </div>

                {/* Devices */}
                <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Smartphone className="h-3.5 w-3.5" />
                  {session.activeDeviceCount}
                </div>

                {/* End Session action — only for non-expired sessions */}
                <div className="shrink-0">
                  {new Date(session.expiresAt) <= new Date() ? null : isConfirming ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground hidden sm:block">End?</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isEnding || busyEnd}
                        onClick={() => handleEndSession(session.id)}
                      >
                        {isEnding || busyEnd
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : "Yes"
                        }
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmEndId(null)}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive/40 hover:bg-destructive/10"
                      onClick={() => {
                        setConfirmClear(false);
                        setConfirmEndId(session.id);
                      }}
                    >
                      End Session
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Clear Table footer ────────────────────────────────────── */}
      <div
        className={cn(
          "px-4 py-3 border-t flex items-center justify-end gap-2",
          table.tableStatus === "bill_requested"
            ? "bg-amber-50/60"
            : "bg-muted/20"
        )}
      >
        {confirmClear ? (
          <>
            <span className="text-xs text-muted-foreground mr-auto">
              End all sessions and reset table?
            </span>
            <Button
              size="sm"
              variant="destructive"
              disabled={busyClear || isClearingTable}
              onClick={handleClearTable}
            >
              {busyClear || isClearingTable ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
              )}
              Yes, Clear Table
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmClear(false)}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant={table.tableStatus === "bill_requested" ? "default" : "outline"}
            className={
              table.tableStatus === "bill_requested"
                ? "bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                : "gap-1.5"
            }
            onClick={() => {
              setConfirmEndId(null);
              setConfirmClear(true);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear Table
          </Button>
        )}
      </div>
    </div>
  );
}

function AddTableDialog({
  open,
  onOpenChange,
  nextNumber,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nextNumber: number;
}) {
  const { createTable, isCreating } = useTableManagement();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [number, setNumber] = useState(String(nextNumber));
  const [capacity, setCapacity] = useState("4");
  const [section, setSection] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(number) || nextNumber;
    try {
      await createTable({
        name,
        number: num,
        capacity: parseInt(capacity) || 4,
        section: section.trim() || undefined,
        displayOrder: num,
      });
      onOpenChange(false);
      setName("");
      setNumber(String(nextNumber + 1));
      setCapacity("4");
      setSection("");
      toast({ title: "Table added", description: `${name} is ready with a QR code.` });
    } catch (err: any) {
      const msg = err?.message ?? "Failed to create table";
      toast({
        title: "Could not add table",
        description: msg.includes("unique") || msg.includes("duplicate")
          ? `Table number ${num} is already taken.`
          : msg,
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add table</DialogTitle>
          <DialogDescription>Fill in the table details below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="at-name">Table name <span className="text-destructive">*</span></Label>
            <Input
              id="at-name"
              placeholder="e.g. Window Seat"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="at-number">Table number <span className="text-destructive">*</span></Label>
              <Input
                id="at-number"
                type="number"
                min={1}
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">Next available: {nextNumber}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="at-capacity">Capacity <span className="text-destructive">*</span></Label>
              <Input
                id="at-capacity"
                type="number"
                min={1}
                max={999}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="at-section">Section / Zone</Label>
            <Input
              id="at-section"
              placeholder="e.g. Patio"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save table
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TablesTab() {
  const {
    tableOverview,
    isLoading,
    clearTable,
    isClearingTable,
    clearingTableId,
    staffRequestBill,
    isRequestingBill,
    requestingBillTableId,
    endSession,
    isEndingSession,
    endingSessionId,
  } = useTableGroups();

  const { nextNumber } = useTableManagement();
  const { user } = useAuth();
  const canManage = user?.role === "owner" || user?.role === "manager";
  const [addOpen, setAddOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tableOverview.length === 0 ? (
        <EmptyState
          icon={TableProperties}
          title="No active sessions"
          description="Guest sessions will appear here automatically when customers scan a table QR code."
        />
      ) : (
        tableOverview.map((table) => (
          <TableCard
            key={table.groupId}
            table={table}
            onEndSession={endSession}
            isEndingSession={isEndingSession}
            endingSessionId={endingSessionId}
            onRequestBill={staffRequestBill}
            isRequestingBill={isRequestingBill && requestingBillTableId === table.tableId}
            onClearTable={clearTable}
            isClearingTable={isClearingTable && clearingTableId === table.tableId}
          />
        ))
      )}

      {canManage && (
        <AddTableDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          nextNumber={nextNumber}
        />
      )}
    </div>
  );
}

// ─── Bills Tab ────────────────────────────────────────────────────────────────

function BillCard({
  bill,
  onAcknowledge,
  isAcknowledging,
}: {
  bill: BillRequest;
  onAcknowledge: (id: string) => Promise<void>;
  isAcknowledging: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const label = tableLabel(bill.tableNumber, bill.tableName);

  async function handle() {
    setBusy(true);
    try {
      await onAcknowledge(bill.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-4 flex items-center justify-between gap-4",
        bill.status === "pending"
          ? "bg-amber-50 border-amber-200"
          : "bg-card border-border opacity-60"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-full shrink-0",
            bill.status === "pending"
              ? "bg-amber-200 text-amber-900"
              : "bg-muted text-muted-foreground"
          )}
        >
          <Bell className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">{timeAgo(bill.requestedAt)}</p>
          {bill.acknowledgedAt && (
            <p className="text-xs text-muted-foreground">
              Delivered {timeAgo(bill.acknowledgedAt)}
            </p>
          )}
        </div>
      </div>

      {bill.status === "pending" && (
        <Button
          size="sm"
          className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
          disabled={busy}
          onClick={handle}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
          Mark Delivered
        </Button>
      )}

      {bill.status === "acknowledged" && (
        <Badge variant="secondary" className="shrink-0">Delivered</Badge>
      )}
    </div>
  );
}

function BillsTab() {
  const { pendingBills, acknowledgedBills, isLoading, acknowledge, isAcknowledging } =
    useBillRequests();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allBills = [...pendingBills, ...acknowledgedBills];

  if (allBills.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No bill requests"
        description="Bill requests appear here when guests tap 'Request the Bill' on their device."
      />
    );
  }

  return (
    <div className="space-y-6">
      {pendingBills.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Pending ({pendingBills.length})
          </h3>
          <div className="space-y-2">
            {pendingBills.map((b) => (
              <BillCard key={b.id} bill={b} onAcknowledge={acknowledge} isAcknowledging={isAcknowledging} />
            ))}
          </div>
        </div>
      )}

      {acknowledgedBills.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Delivered ({acknowledgedBills.length})
          </h3>
          <div className="space-y-2">
            {acknowledgedBills.map((b) => (
              <BillCard key={b.id} bill={b} onAcknowledge={acknowledge} isAcknowledging={isAcknowledging} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── QR Tab ───────────────────────────────────────────────────────────────────

function QRTableCard({
  table,
  onRegenerate,
  isRegenerating,
  canManage,
}: {
  table: CafeTable;
  onRegenerate: (id: string) => Promise<unknown>;
  isRegenerating: boolean;
  canManage: boolean;
}) {
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const guestUrl = table.qrCodeToken
    ? `${window.location.origin}${import.meta.env.BASE_URL}table/${table.qrCodeToken}`
    : null;

  const label = tableLabel(table.number, table.name);

  async function handleCopy() {
    if (!guestUrl) return;
    await navigator.clipboard.writeText(guestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const svg = qrContainerRef.current?.querySelector("svg");
    if (!svg) return;
    const svgString = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label.replace(/\s+/g, "-").toLowerCase()}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    if (!guestUrl) return;
    const svg = qrContainerRef.current?.querySelector("svg");
    if (!svg) return;
    const svgString = new XMLSerializer().serializeToString(svg);
    const win = window.open("", "_blank", "width=480,height=600");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code — ${label}</title>
          <style>
            body { margin: 0; display: flex; flex-direction: column; align-items: center;
                   justify-content: center; min-height: 100vh; font-family: sans-serif; gap: 16px; }
            h2 { margin: 0; font-size: 22px; }
            p { margin: 0; font-size: 13px; color: #666; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <h2>${label}</h2>
          ${svgString}
          <p>Scan to view menu &amp; order</p>
          <script>window.onload = function() { window.print(); }<\/script>
        </body>
      </html>
    `);
    win.document.close();
  }

  async function handleRegenerate() {
    setBusy(true);
    try {
      await onRegenerate(table.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm flex flex-col">
      {/* Header */}
      <div className="px-3 py-2.5 border-b flex items-center justify-between">
        <span className="font-semibold text-sm">{label}</span>
        {!table.isActive && (
          <Badge variant="secondary" className="text-xs">Inactive</Badge>
        )}
      </div>

      {/* QR display */}
      <div className="flex flex-col px-3 py-3 gap-2">
        {guestUrl ? (
          <div
            ref={qrContainerRef}
            className="w-full bg-white p-2 rounded-lg border shadow-sm"
          >
            <QRCode
              value={guestUrl}
              size={256}
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
        ) : (
          <div className="w-full aspect-square rounded-lg border-2 border-dashed bg-muted flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <QrCode className="h-8 w-8 opacity-30" />
            <span className="text-xs text-center px-3">No QR token</span>
          </div>
        )}

        {guestUrl && (
          <div className="w-full bg-muted rounded-md px-2.5 py-1.5">
            <p className="text-[10px] text-muted-foreground font-mono break-all line-clamp-1">
              {guestUrl}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-2 pb-2 grid grid-cols-2 gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={!guestUrl}
          onClick={handleCopy}
          className="flex-col h-auto py-1.5 px-1 gap-0.5 min-w-0 text-[10px] font-medium"
        >
          <Copy className="h-3 w-3 shrink-0" />
          <span className="break-words text-center leading-none w-full">
            {copied ? "Copied!" : "Copy URL"}
          </span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          disabled={!guestUrl}
          onClick={handleDownload}
          className="flex-col h-auto py-1.5 px-1 gap-0.5 min-w-0 text-[10px] font-medium"
        >
          <Download className="h-3 w-3 shrink-0" />
          <span className="break-words text-center leading-none w-full">Download</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          disabled={!guestUrl}
          onClick={handlePrint}
          className="flex-col h-auto py-1.5 px-1 gap-0.5 min-w-0 text-[10px] font-medium"
        >
          <Printer className="h-3 w-3 shrink-0" />
          <span className="break-words text-center leading-none w-full">Print</span>
        </Button>

        {canManage && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy || isRegenerating}
            onClick={handleRegenerate}
            className="flex-col h-auto py-1.5 px-1 gap-0.5 min-w-0 text-[10px] font-medium text-amber-700 border-amber-300 hover:bg-amber-50"
          >
            {busy ? (
              <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 shrink-0" />
            )}
            <span className="break-words text-center leading-none w-full">
              {table.qrCodeToken ? "Regenerate" : "Generate"}
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}

function QRTab() {
  const { tables, tablesLoading, regenerateQr, isRegeneratingQr, regeneratingTableId } =
    useTableSessions();
  const { user } = useAuth();
  const canManage =
    user?.role === "owner" || user?.role === "manager";

  if (tablesLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <EmptyState
        icon={QrCode}
        title="No tables configured"
        description="Add tables in your cafe settings to generate QR codes for them."
      />
    );
  }

  const activeTables   = tables.filter((t) => t.isActive);
  const inactiveTables = tables.filter((t) => !t.isActive);

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Regenerating a QR code <strong>invalidates the old URL immediately</strong>. All
            existing guest sessions will not be affected, but guests who scan the old code
            will fail to join.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {activeTables.map((table) => (
          <QRTableCard
            key={table.id}
            table={table}
            onRegenerate={regenerateQr}
            isRegenerating={isRegeneratingQr && regeneratingTableId === table.id}
            canManage={canManage}
          />
        ))}
        {inactiveTables.map((table) => (
          <QRTableCard
            key={table.id}
            table={table}
            onRegenerate={regenerateQr}
            isRegenerating={isRegeneratingQr && regeneratingTableId === table.id}
            canManage={canManage}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function OrdersPage() {
  const qc = useQueryClient();
  const pendingOrders = (qc.getQueryData<StaffOrder[]>(["staff_orders"]) ?? []).filter(
    (o) => o.status === "pending_approval"
  );
  const pendingBills = (qc.getQueryData<BillRequest[]>(["staff_bill_requests"]) ?? []).filter(
    (b) => b.status === "pending"
  );

  return (
    <>
      <PageHeader
        title="Orders & Sessions"
        icon={ClipboardList}
        description="Kitchen queue, live session status, and bill requests"
      />

      <Tabs defaultValue="orders" className="mt-4">
        <div className="overflow-x-auto mb-6 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
          <TabsList className="flex-nowrap gap-1 h-auto w-max min-w-full">
            <TabsTrigger value="orders" className="flex items-center gap-1 shrink-0 whitespace-nowrap text-xs px-2 py-1.5 sm:gap-2 sm:text-sm sm:px-3">
              <ChefHat className="h-3.5 w-3.5 hidden sm:inline" />
              Orders
              {pendingOrders.length > 0 && (
                <span className="ml-1 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold w-4.5 h-4.5 min-w-[18px] px-1">
                  {pendingOrders.length}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger value="tables" className="flex items-center gap-1 shrink-0 whitespace-nowrap text-xs px-2 py-1.5 sm:gap-2 sm:text-sm sm:px-3">
              <TableProperties className="h-3.5 w-3.5 hidden sm:inline" />
              Sessions
            </TabsTrigger>

            <TabsTrigger value="bills" className="flex items-center gap-1 shrink-0 whitespace-nowrap text-xs px-2 py-1.5 sm:gap-2 sm:text-sm sm:px-3">
              <Receipt className="h-3.5 w-3.5 hidden sm:inline" />
              Bill Requests
              {pendingBills.length > 0 && (
                <span className="ml-1 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold w-4.5 h-4.5 min-w-[18px] px-1">
                  {pendingBills.length}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger value="qr" className="flex items-center gap-1 shrink-0 whitespace-nowrap text-xs px-2 py-1.5 sm:gap-2 sm:text-sm sm:px-3">
              <QrCode className="h-3.5 w-3.5 hidden sm:inline" />
              QR Codes
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="orders">
          <OrdersTab />
        </TabsContent>

        <TabsContent value="tables">
          <TablesTab />
        </TabsContent>

        <TabsContent value="bills">
          <BillsTab />
        </TabsContent>

        <TabsContent value="qr">
          <QRTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
