import { useState } from "react";
import { Coffee, Users, Calendar, Clock, CheckCircle2, AlertCircle, Minus, Plus } from "lucide-react";
import { usePublicCafe, usePublicCreateBooking, PublicBookingResult } from "@/hooks/usePublicBooking";
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
import { formatTime } from "@/lib/utils";

// ── Time slots ─────────────────────────────────────────────────
function buildTimeSlots(): { value: string; label: string }[] {
  const slots: { value: string; label: string }[] = [];
  for (let h = 7; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 22 && m === 30) break;
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const value = `${hh}:${mm}`;
      slots.push({ value, label: formatTime(value) });
    }
  }
  return slots;
}
const TIME_SLOTS = buildTimeSlots();

// ── Helpers ────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatDisplayDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Page ───────────────────────────────────────────────────────
export function BookingFormPage() {
  const { data: cafe, isLoading: cafeLoading, error: cafeError } = usePublicCafe();
  const createBooking = usePublicCreateBooking();

  const today = todayStr();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("12:00");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<PublicBookingResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cafe) return;
    setSubmitError(null);

    try {
      const result = await createBooking.mutateAsync({
        cafe_id: cafe.id,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        party_size: partySize,
        booking_date: date,
        booking_time: time,
        notes: notes.trim() || null,
      });
      setConfirmed(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setSubmitError(msg);
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-96 bg-sidebar p-10 shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sidebar-primary/20 text-sidebar-primary">
              <Coffee className="w-6 h-6" />
            </div>
            <span className="text-lg font-bold text-sidebar-foreground">
              {cafeLoading ? "Loading…" : (cafe?.name ?? "Cup & Cozy")}
            </span>
          </div>
          <h2 className="text-3xl font-bold text-sidebar-foreground leading-tight">
            Reserve your
            <br />
            <span className="text-sidebar-primary">table today.</span>
          </h2>
          <p className="mt-4 text-sm text-sidebar-foreground/60 leading-relaxed">
            Book a table in seconds. We'll confirm your reservation and look
            forward to welcoming you.
          </p>
        </div>

        <div className="space-y-4">
          {[
            { icon: Calendar, text: "Available 7 days a week" },
            { icon: Clock, text: "Flexible time slots" },
            { icon: Users, text: "Groups of any size welcome" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-sidebar-primary/20 text-sidebar-primary shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-sm text-sidebar-foreground/70">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right content */}
      <div className="flex-1 flex items-start justify-center p-6 py-10 overflow-auto">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary">
              <Coffee className="w-5 h-5" />
            </div>
            <span className="text-base font-bold text-foreground">
              {cafeLoading ? "Loading…" : (cafe?.name ?? "Cup & Cozy")}
            </span>
          </div>

          {/* Loading cafe */}
          {cafeLoading && (
            <div className="flex flex-col items-center gap-3 py-16">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
          )}

          {/* Cafe not found */}
          {!cafeLoading && (cafeError || !cafe) && (
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Bookings unavailable
              </h1>
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-sm">
                  Online bookings are not available right now. Please call us
                  to reserve a table.
                </p>
              </div>
            </div>
          )}

          {/* Success confirmation */}
          {confirmed && (
            <div className="flex flex-col items-center gap-5 py-8 text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 text-green-600">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">
                  Booking confirmed!
                </h1>
                <p className="text-sm text-muted-foreground">
                  We've received your reservation and will be in touch shortly.
                </p>
              </div>

              <div className="w-full bg-card border border-card-border rounded-xl p-5 text-left space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Your booking details
                </p>
                <div className="space-y-2">
                  {[
                    { label: "Name", value: confirmed.name },
                    { label: "Email", value: confirmed.email },
                    { label: "Date", value: formatDisplayDate(confirmed.booking_date) },
                    { label: "Time", value: formatTime(confirmed.booking_time) },
                    { label: "Guests", value: `${confirmed.party_size} ${confirmed.party_size === 1 ? "guest" : "guests"}` },
                    { label: "Reference", value: confirmed.id.slice(0, 8).toUpperCase() },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between gap-4">
                      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
                      <span className="text-sm font-medium text-foreground text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Please arrive a few minutes before your reserved time. We look
                forward to seeing you!
              </p>

              <Button
                variant="outline"
                onClick={() => {
                  setConfirmed(null);
                  setName(""); setEmail(""); setPhone("");
                  setPartySize(2); setDate(today);
                  setTime("12:00"); setNotes("");
                }}
              >
                Make another booking
              </Button>
            </div>
          )}

          {/* Booking form */}
          {!cafeLoading && cafe && !confirmed && (
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">
                Make a reservation
              </h1>
              <p className="text-sm text-muted-foreground mb-8">
                at {cafe.name}
                {cafe.address && (
                  <span className="text-muted-foreground/60"> · {cafe.address}</span>
                )}
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    required
                    disabled={createBooking.isPending}
                  />
                </div>

                {/* Email + Phone */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      disabled={createBooking.isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+61 4xx xxx xxx"
                      disabled={createBooking.isPending}
                    />
                  </div>
                </div>

                {/* Date + Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      min={today}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      disabled={createBooking.isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="time">Time *</Label>
                    <Select
                      value={time}
                      onValueChange={setTime}
                      disabled={createBooking.isPending}
                    >
                      <SelectTrigger id="time">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {TIME_SLOTS.map((slot) => (
                          <SelectItem key={slot.value} value={slot.value}>
                            {slot.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Guest count */}
                <div className="space-y-1.5">
                  <Label>Number of guests *</Label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                      disabled={partySize <= 1 || createBooking.isPending}
                      className="flex items-center justify-center w-9 h-9 rounded-lg border border-input bg-background hover:bg-muted transition-colors disabled:opacity-40"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-base font-semibold text-foreground w-12 text-center">
                      {partySize} {partySize === 1 ? "guest" : "guests"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPartySize((n) => Math.min(20, n + 1))}
                      disabled={partySize >= 20 || createBooking.isPending}
                      className="flex items-center justify-center w-9 h-9 rounded-lg border border-input bg-background hover:bg-muted transition-colors disabled:opacity-40"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-muted-foreground ml-1">
                      Max 20. Call us for larger groups.
                    </span>
                  </div>
                </div>

                {/* Special requests */}
                <div className="space-y-1.5">
                  <Label htmlFor="notes">Special requests</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Allergies, dietary requirements, special occasions…"
                    rows={3}
                    disabled={createBooking.isPending}
                  />
                </div>

                {submitError && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-sm">{submitError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    createBooking.isPending ||
                    !name.trim() ||
                    !email.trim() ||
                    !date ||
                    !time
                  }
                >
                  {createBooking.isPending ? "Submitting…" : "Request booking"}
                </Button>
              </form>

              <p className="text-xs text-muted-foreground text-center mt-6">
                Your booking is pending confirmation. We'll contact you via
                email or phone to confirm.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
