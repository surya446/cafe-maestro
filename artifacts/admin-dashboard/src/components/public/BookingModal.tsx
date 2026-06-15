import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Calendar, Clock, Users, Minus, Plus,
  CheckCircle2, AlertCircle, Coffee,
} from "lucide-react";
import { usePublicCafe, usePublicCreateBooking, PublicBookingResult } from "@/hooks/usePublicBooking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatTime } from "@/lib/utils";
import { useBookingModal } from "@/contexts/BookingModalContext";

function buildTimeSlots() {
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

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export function BookingModal() {
  const { isOpen, closeBooking } = useBookingModal();
  const { data: cafe } = usePublicCafe();
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

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  function handleClose() {
    closeBooking();
    setTimeout(() => {
      setConfirmed(null);
      setName(""); setEmail(""); setPhone("");
      setPartySize(2); setDate(today);
      setTime("12:00"); setNotes("");
      setSubmitError(null);
    }, 300);
  }

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
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="booking-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="booking-panel"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", damping: 30, stiffness: 320, mass: 0.8 }}
            className="fixed inset-0 z-[210] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Book a table"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
                <div className="flex items-center gap-2.5">
                  <Coffee className="w-4.5 h-4.5 text-gray-400" />
                  <h2 className="font-semibold text-gray-900 text-base">
                    {confirmed ? "Booking Received" : "Book a Table"}
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-6">
                {/* Success state */}
                {confirmed ? (
                  <div className="flex flex-col items-center gap-5 text-center py-4">
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-50 text-green-500">
                      <CheckCircle2 className="w-9 h-9" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">Thank you, {confirmed.name.split(" ")[0]}!</h3>
                      <p className="text-gray-500 text-sm leading-relaxed">
                        Your booking confirmation will be shared shortly via email.
                      </p>
                    </div>

                    <div className="w-full bg-gray-50 rounded-xl p-4 text-left space-y-2.5">
                      {[
                        { icon: Calendar, label: new Date(confirmed.booking_date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) },
                        { icon: Clock, label: formatTime(confirmed.booking_time) },
                        { icon: Users, label: `${confirmed.party_size} ${confirmed.party_size === 1 ? "guest" : "guests"}` },
                      ].map(({ icon: Icon, label }) => (
                        <div key={label} className="flex items-center gap-3">
                          <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="text-sm text-gray-700">{label}</span>
                        </div>
                      ))}
                      <div className="pt-1 border-t border-gray-200">
                        <p className="text-xs text-gray-400">Reference: {confirmed.id.slice(0, 8).toUpperCase()}</p>
                      </div>
                    </div>

                    <Button variant="outline" size="sm" onClick={handleClose} className="mt-1">
                      Close
                    </Button>
                  </div>
                ) : (
                  /* Booking form */
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {cafe?.name && (
                      <p className="text-sm text-gray-400 -mt-1 mb-5">at {cafe.name}</p>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="bm-name">Full name *</Label>
                      <Input
                        id="bm-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                        required
                        disabled={createBooking.isPending}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="bm-email">Email *</Label>
                        <Input
                          id="bm-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                          disabled={createBooking.isPending}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="bm-phone">Phone</Label>
                        <Input
                          id="bm-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          disabled={createBooking.isPending}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="bm-date">Date *</Label>
                        <Input
                          id="bm-date"
                          type="date"
                          value={date}
                          min={today}
                          onChange={(e) => setDate(e.target.value)}
                          required
                          disabled={createBooking.isPending}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="bm-time">Time *</Label>
                        <Select value={time} onValueChange={setTime} disabled={createBooking.isPending}>
                          <SelectTrigger id="bm-time">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-52">
                            {TIME_SLOTS.map((slot) => (
                              <SelectItem key={slot.value} value={slot.value}>
                                {slot.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Guests *</Label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                          disabled={partySize <= 1 || createBooking.isPending}
                          className="flex items-center justify-center w-9 h-9 rounded-lg border border-input bg-white hover:bg-gray-50 transition-colors disabled:opacity-40"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-base font-semibold text-gray-900 w-20 text-center">
                          {partySize} {partySize === 1 ? "guest" : "guests"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPartySize((n) => Math.min(20, n + 1))}
                          disabled={partySize >= 20 || createBooking.isPending}
                          className="flex items-center justify-center w-9 h-9 rounded-lg border border-input bg-white hover:bg-gray-50 transition-colors disabled:opacity-40"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="bm-notes">Special requests</Label>
                      <Textarea
                        id="bm-notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Allergies, dietary requirements, special occasions…"
                        rows={2}
                        disabled={createBooking.isPending}
                      />
                    </div>

                    {submitError && (
                      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 text-red-600 border border-red-100">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p className="text-sm">{submitError}</p>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createBooking.isPending || !name.trim() || !email.trim() || !date || !time}
                    >
                      {createBooking.isPending ? "Submitting…" : "Request Booking"}
                    </Button>

                    <p className="text-xs text-gray-400 text-center">
                      We'll confirm your reservation and get back to you shortly.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
