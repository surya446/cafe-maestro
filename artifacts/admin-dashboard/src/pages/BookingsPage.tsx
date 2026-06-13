import { useState } from "react";
import {
  Plus, Pencil, Trash2, CalendarDays, ChevronLeft, ChevronRight,
  StickyNote, CheckCircle2, XCircle, Armchair, UserX, Wifi, AlertCircle,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { StatusBadge, bookingStatusVariant } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";
import {
  useBookings,
  useCreateBooking,
  useUpdateBooking,
  useUpdateBookingStatus,
  useUpdateStaffNotes,
  useAssignTable,
  useDeleteBooking,
  useCafeTables,
} from "@/hooks/useBookings";
import { useAuth } from "@/hooks/useAuth";
import { Booking, BookingStatus } from "@/types";
import { formatTime, BOOKING_STATUS_LABELS } from "@/lib/utils";

// ── Constants ──────────────────────────────────────────────────

const ALL_STATUSES: BookingStatus[] = [
  "pending", "confirmed", "seated", "cancelled", "no_show",
];

const STATUS_FILTER_TABS: { value: BookingStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "seated", label: "Seated" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No Show" },
];

// ── Helpers ────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function displayDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

// ── Booking form (create / edit) ───────────────────────────────

interface BookingFormData {
  name: string;
  email: string | null;
  phone: string | null;
  party_size: number;
  booking_date: string;
  booking_time: string;
  notes: string | null;
  staff_notes: string | null;
  status: BookingStatus;
  table_id: string | null;
}

function BookingForm({
  initial,
  onSubmit,
  onCancel,
  loading,
  tables,
  isManagerOrAbove,
}: {
  initial?: Partial<Booking>;
  onSubmit: (data: BookingFormData) => void;
  onCancel: () => void;
  loading: boolean;
  tables: { id: string; number: number; name: string | null }[];
  isManagerOrAbove: boolean;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [partySize, setPartySize] = useState(String(initial?.party_size ?? "2"));
  const [date, setDate] = useState(initial?.booking_date ?? today);
  const [time, setTime] = useState(initial?.booking_time ?? "12:00");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [staffNotes, setStaffNotes] = useState(initial?.staff_notes ?? "");
  const [status, setStatus] = useState<BookingStatus>(initial?.status ?? "pending");
  const [tableId, setTableId] = useState<string | null>(initial?.table_id ?? null);
  const [formError, setFormError] = useState<string | null>(null);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await onSubmit({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        party_size: parseInt(partySize) || 1,
        booking_date: date,
        booking_time: time,
        notes: notes.trim() || null,
        staff_notes: staffNotes.trim() || null,
        status,
        table_id: tableId,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to save booking. Please try again.";
      setFormError(msg);
    }
  }

  return (
    <form onSubmit={handle} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      {/* Name */}
      <div className="space-y-1.5">
        <Label>Name *</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Guest name"
          disabled={loading}
        />
      </div>

      {/* Email + Phone */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            disabled={loading}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+61 4xx xxx xxx"
            disabled={loading}
          />
        </div>
      </div>

      {/* Date + Time + Party size */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Date *</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Time *</Label>
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Guests *</Label>
          <Input
            type="number"
            min="1"
            max="50"
            value={partySize}
            onChange={(e) => setPartySize(e.target.value)}
            required
            disabled={loading}
          />
        </div>
      </div>

      {/* Status */}
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as BookingStatus)}
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {BOOKING_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table assignment */}
      {tables.length > 0 && (
        <div className="space-y-1.5">
          <Label>Table assignment</Label>
          <Select
            value={tableId ?? "none"}
            onValueChange={(v) => setTableId(v === "none" ? null : v)}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder="No table assigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No table assigned</SelectItem>
              {tables.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  Table {t.number}{t.name ? ` — ${t.name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Guest notes */}
      <div className="space-y-1.5">
        <Label>Guest notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Special requests, allergies…"
          rows={2}
          disabled={loading}
        />
      </div>

      {/* Staff notes (manager/owner only in form) */}
      {isManagerOrAbove && (
        <div className="space-y-1.5">
          <Label>
            Staff notes{" "}
            <span className="text-xs text-muted-foreground font-normal">
              (internal only)
            </span>
          </Label>
          <Textarea
            value={staffNotes}
            onChange={(e) => setStaffNotes(e.target.value)}
            placeholder="Internal notes for staff…"
            rows={2}
            disabled={loading}
          />
        </div>
      )}

      {formError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <DialogFooter>
        <Button
          variant="outline"
          type="button"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !name.trim()}>
          {loading ? "Saving…" : initial?.name ? "Update booking" : "Create booking"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── Inline staff notes editor ──────────────────────────────────

function StaffNotesInline({
  booking,
}: {
  booking: Booking;
}) {
  const updateNotes = useUpdateStaffNotes();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(booking.staff_notes ?? "");

  async function save() {
    await updateNotes.mutateAsync({
      id: booking.id,
      staff_notes: draft.trim() || null,
    });
    setEditing(false);
  }

  function cancel() {
    setDraft(booking.staff_notes ?? "");
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(booking.staff_notes ?? ""); setEditing(true); }}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
      >
        <StickyNote className="w-3 h-3 shrink-0" />
        <span className="italic truncate max-w-48">
          {booking.staff_notes
            ? booking.staff_notes
            : <span className="not-italic opacity-60">Add staff note</span>
          }
        </span>
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Internal note…"
        rows={2}
        className="text-xs"
        autoFocus
        disabled={updateNotes.isPending}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-6 text-xs px-2"
          onClick={save}
          disabled={updateNotes.isPending}
        >
          {updateNotes.isPending ? "Saving…" : "Save"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs px-2"
          onClick={cancel}
          disabled={updateNotes.isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Table assignment inline ────────────────────────────────────

function TableAssignInline({
  booking,
  tables,
}: {
  booking: Booking;
  tables: { id: string; number: number; name: string | null }[];
}) {
  const assignTable = useAssignTable();

  if (tables.length === 0) return null;

  const assigned = tables.find((t) => t.id === booking.table_id);

  return (
    <div className="flex items-center gap-1.5">
      <Armchair className="w-3 h-3 text-muted-foreground shrink-0" />
      <Select
        value={booking.table_id ?? "none"}
        onValueChange={(v) =>
          assignTable.mutate({ id: booking.id, table_id: v === "none" ? null : v })
        }
        disabled={assignTable.isPending}
      >
        <SelectTrigger className="h-6 text-xs border-0 bg-transparent p-0 shadow-none focus:ring-0 w-auto gap-1">
          <SelectValue>
            {assigned
              ? `Table ${assigned.number}${assigned.name ? ` — ${assigned.name}` : ""}`
              : <span className="text-muted-foreground/60">Assign table</span>
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No table</SelectItem>
          {tables.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              Table {t.number}{t.name ? ` — ${t.name}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Quick action buttons ───────────────────────────────────────

function QuickActions({
  booking,
}: {
  booking: Booking;
}) {
  const updateStatus = useUpdateBookingStatus();
  const busy = updateStatus.isPending;

  function act(status: BookingStatus) {
    updateStatus.mutate({ id: booking.id, status });
  }

  if (booking.status === "pending") {
    return (
      <div className="flex gap-1.5 shrink-0">
        <button
          onClick={() => act("confirmed")}
          disabled={busy}
          title="Confirm"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
        >
          <CheckCircle2 className="w-3 h-3" />
          Confirm
        </button>
        <button
          onClick={() => act("cancelled")}
          disabled={busy}
          title="Cancel"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          <XCircle className="w-3 h-3" />
          Cancel
        </button>
      </div>
    );
  }

  if (booking.status === "confirmed") {
    return (
      <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
        <button
          onClick={() => act("seated")}
          disabled={busy}
          title="Seat"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50"
        >
          <Armchair className="w-3 h-3" />
          Seat
        </button>
        <button
          onClick={() => act("no_show")}
          disabled={busy}
          title="No show"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
        >
          <UserX className="w-3 h-3" />
          No Show
        </button>
        <button
          onClick={() => act("cancelled")}
          disabled={busy}
          title="Cancel"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          <XCircle className="w-3 h-3" />
          Cancel
        </button>
      </div>
    );
  }

  if (booking.status === "seated") {
    return (
      <div className="flex gap-1.5 shrink-0">
        <button
          onClick={() => act("no_show")}
          disabled={busy}
          title="Mark no show"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
        >
          <UserX className="w-3 h-3" />
          No Show
        </button>
      </div>
    );
  }

  return null;
}

// ── Booking card ───────────────────────────────────────────────

function BookingCard({
  booking,
  tables,
  onEdit,
  onDelete,
  canDelete,
}: {
  booking: Booking;
  tables: { id: string; number: number; name: string | null }[];
  onEdit: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const isArchived =
    booking.status === "cancelled" || booking.status === "no_show";

  return (
    <div
      className={cn(
        "p-4 bg-card border border-card-border rounded-xl shadow-sm",
        isArchived && "opacity-60"
      )}
    >
      {/* Top row */}
      <div className="flex items-start gap-3">
        {/* Time */}
        <div className="text-center w-14 shrink-0 pt-0.5">
          <p className="text-base font-bold text-foreground leading-tight">
            {formatTime(booking.booking_time)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {booking.party_size}p
          </p>
        </div>

        <div className="w-px h-10 bg-border shrink-0 mt-0.5" />

        {/* Guest info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{booking.name}</p>
          <p className="text-sm text-muted-foreground truncate">
            {[booking.phone, booking.email].filter(Boolean).join(" · ")}
          </p>
          {booking.notes && (
            <p className="text-xs text-muted-foreground/80 mt-0.5 italic truncate">
              "{booking.notes}"
            </p>
          )}
        </div>

        {/* Status badge + edit/delete */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusBadge
            label={BOOKING_STATUS_LABELS[booking.status]}
            variant={bookingStatusVariant(booking.status)}
          />
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {canDelete && (
              <button
                onClick={onDelete}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row — staff tools */}
      {!isArchived && (
        <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5 min-w-0">
            <TableAssignInline booking={booking} tables={tables} />
            <StaffNotesInline booking={booking} />
          </div>
          <QuickActions booking={booking} />
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────

export function BookingsPage() {
  const today = new Date().toISOString().split("T")[0];
  const { isManagerOrAbove } = useAuth();

  const [selectedDate, setSelectedDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");

  const { data: allBookings = [], isLoading } = useBookings(selectedDate);
  const { data: tables = [] } = useCafeTables();

  const create = useCreateBooking();
  const update = useUpdateBooking();
  const del = useDeleteBooking();

  const [dialog, setDialog] = useState(false);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Apply status filter
  const bookings =
    statusFilter === "all"
      ? allBookings
      : allBookings.filter((b) => b.status === statusFilter);

  // Status counts for tab badges
  const counts = ALL_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = allBookings.filter((b) => b.status === s).length;
    return acc;
  }, {});

  function openCreate() {
    setEditBooking(null);
    setDialog(true);
  }
  function openEdit(booking: Booking) {
    setEditBooking(booking);
    setDialog(true);
  }
  function closeDialog() {
    setDialog(false);
    setEditBooking(null);
  }

  async function handleFormSubmit(data: BookingFormData) {
    if (editBooking) {
      await update.mutateAsync({ id: editBooking.id, ...data });
    } else {
      await create.mutateAsync(data);
    }
    closeDialog();
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <PageHeader
          title="Bookings"
          subtitle={`${allBookings.length} booking${allBookings.length !== 1 ? "s" : ""} on this day`}
          actions={
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" />
              New booking
            </Button>
          }
        />

        {/* Date navigator */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex items-center gap-2 bg-card border border-card-border rounded-xl p-2.5">
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center min-w-44">
              <p className="text-sm font-semibold text-foreground">
                {displayDate(selectedDate)}
              </p>
              {selectedDate === today && (
                <p className="text-xs text-primary font-medium">Today</p>
              )}
            </div>
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDate(today)}
            disabled={selectedDate === today}
          >
            Today
          </Button>
          <div className="flex items-center gap-1 ml-auto text-xs text-muted-foreground">
            <Wifi className="w-3 h-3" />
            <span>Live</span>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {STATUS_FILTER_TABS.map(({ value, label }) => {
            const count =
              value === "all" ? allBookings.length : counts[value] ?? 0;
            const active = statusFilter === value;
            return (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-card-border text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {label}
                {count > 0 && (
                  <span
                    className={cn(
                      "inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold",
                      active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted-foreground/20 text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Booking list */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={
              statusFilter !== "all"
                ? `No ${BOOKING_STATUS_LABELS[statusFilter]?.toLowerCase()} bookings`
                : "No bookings on this day"
            }
            description={
              statusFilter !== "all"
                ? "Try a different status filter or date."
                : "Add a booking or check another date."
            }
            action={
              statusFilter === "all" ? (
                <Button onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add booking
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-2">
            {bookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                tables={tables}
                onEdit={() => openEdit(booking)}
                onDelete={() => setDeleteId(booking.id)}
                canDelete={isManagerOrAbove}
              />
            ))}
          </div>
        )}

        {/* Create / Edit dialog */}
        <Dialog open={dialog} onOpenChange={(o) => !o && closeDialog()}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editBooking ? "Edit booking" : "New booking"}
              </DialogTitle>
            </DialogHeader>
            <BookingForm
              initial={editBooking ?? { booking_date: selectedDate }}
              onSubmit={handleFormSubmit}
              onCancel={closeDialog}
              loading={create.isPending || update.isPending}
              tables={tables}
              isManagerOrAbove={isManagerOrAbove}
            />
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <ConfirmDialog
          open={!!deleteId}
          onOpenChange={(o) => !o && setDeleteId(null)}
          title="Delete booking?"
          description="This booking will be permanently removed."
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
