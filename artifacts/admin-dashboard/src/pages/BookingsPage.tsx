import { useState } from "react";
import { Plus, Pencil, Trash2, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
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
import {
  useBookings,
  useCreateBooking,
  useUpdateBooking,
  useUpdateBookingStatus,
  useDeleteBooking,
} from "@/hooks/useBookings";
import { Booking, BookingStatus } from "@/types";
import { formatTime, BOOKING_STATUS_LABELS } from "@/lib/utils";

const STATUS_OPTIONS: BookingStatus[] = [
  "pending",
  "confirmed",
  "seated",
  "cancelled",
  "no_show",
];

function BookingForm({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Partial<Booking>;
  onSubmit: (data: Omit<Booking, "id" | "cafe_id" | "created_at" | "updated_at" | "confirmed_at" | "confirmed_by">) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [partySize, setPartySize] = useState(String(initial?.party_size ?? "2"));
  const [date, setDate] = useState(initial?.booking_date ?? today);
  const [time, setTime] = useState(initial?.booking_time ?? "12:00");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [status, setStatus] = useState<BookingStatus>(initial?.status ?? "pending");

  function handle(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      party_size: parseInt(partySize),
      booking_date: date,
      booking_time: time,
      notes: notes.trim() || null,
      staff_notes: null,
      table_id: null,
      status,
    });
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Guest name" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+61 …" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Date *</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Time *</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Party size *</Label>
          <Input type="number" min="1" max="50" value={partySize} onChange={(e) => setPartySize(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as BookingStatus)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{BOOKING_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Special requests, allergies…" rows={2} />
      </div>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading || !name.trim()}>
          {loading ? "Saving…" : initial?.name ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function displayDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function BookingsPage() {
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const { data: bookings = [], isLoading } = useBookings(selectedDate);
  const create = useCreateBooking();
  const update = useUpdateBooking();
  const updateStatus = useUpdateBookingStatus();
  const del = useDeleteBooking();

  const [dialog, setDialog] = useState(false);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const confirmed = bookings.filter((b) => b.status === "confirmed").length;
  const pending = bookings.filter((b) => b.status === "pending").length;

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl mx-auto">
        <PageHeader
          title="Bookings"
          subtitle={`${bookings.length} bookings — ${confirmed} confirmed, ${pending} pending`}
          actions={
            <Button onClick={() => { setEditBooking(null); setDialog(true); }}>
              <Plus className="w-4 h-4 mr-1.5" />
              New booking
            </Button>
          }
        />

        {/* Date nav */}
        <div className="flex items-center gap-3 mb-6 bg-card border border-card-border rounded-xl p-3 w-fit">
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center min-w-48">
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDate(today)}
            disabled={selectedDate === today}
          >
            Today
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No bookings on this day"
            description="Add a booking or check another date."
            action={
              <Button onClick={() => { setEditBooking(null); setDialog(true); }}>
                <Plus className="w-4 h-4 mr-1.5" />
                Add booking
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center gap-4 p-4 bg-card border border-card-border rounded-xl shadow-sm"
              >
                <div className="text-center w-14 shrink-0">
                  <p className="text-base font-bold text-foreground">
                    {formatTime(booking.booking_time)}
                  </p>
                </div>
                <div className="w-px h-10 bg-border shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{booking.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {booking.party_size} guests
                    {booking.phone && ` · ${booking.phone}`}
                    {booking.email && ` · ${booking.email}`}
                  </p>
                  {booking.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">
                      "{booking.notes}"
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={booking.status}
                    onValueChange={(v) =>
                      updateStatus.mutate({ id: booking.id, status: v as BookingStatus })
                    }
                  >
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {BOOKING_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => { setEditBooking(booking); setDialog(true); }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteId(booking.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={dialog} onOpenChange={setDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editBooking ? "Edit booking" : "New booking"}</DialogTitle>
            </DialogHeader>
            <BookingForm
              initial={editBooking ?? { booking_date: selectedDate }}
              onSubmit={async (data) => {
                if (editBooking) {
                  await update.mutateAsync({ id: editBooking.id, ...data });
                } else {
                  await create.mutateAsync(data);
                }
                setDialog(false);
                setEditBooking(null);
              }}
              onCancel={() => { setDialog(false); setEditBooking(null); }}
              loading={create.isPending || update.isPending}
            />
          </DialogContent>
        </Dialog>

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
