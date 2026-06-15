import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Calendar, Clock, Users, Minus, Plus,
  CheckCircle2, AlertCircle, Coffee, ChevronDown,
} from "lucide-react";
import { usePublicCafe, usePublicCreateBooking, PublicBookingResult } from "@/hooks/usePublicBooking";
import { formatTime } from "@/lib/utils";
import { useBookingModal } from "@/contexts/BookingModalContext";

const GOLD = "#C9A46C";

function buildTimeSlots() {
  const slots: { value: string; label: string }[] = [];
  for (let h = 7; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 22 && m === 30) break;
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      slots.push({ value: `${hh}:${mm}`, label: formatTime(`${hh}:${mm}`) });
    }
  }
  return slots;
}
const TIME_SLOTS = buildTimeSlots();

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

/* ── Shared input style ─────────────────────────────── */
const inputCls = [
  "w-full h-10 rounded-xl px-3 text-sm text-white placeholder:text-white/25",
  "border border-white/[0.08] focus:border-[#C9A46C]/50 focus:outline-none",
  "transition-colors duration-200",
].join(" ");

const inputStyle = { background: "#171717", colorScheme: "dark" as const };

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35 mb-1">
      {children}
    </p>
  );
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
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
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
    }, 350);
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
          {/* ── Backdrop ─────────────────────────────────────── */}
          <motion.div
            key="bm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="fixed inset-0 z-[200]"
            style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)" }}
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* ── Panel ─────────────────────────────────────────── */}
          <motion.div
            key="bm-panel-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[210] flex flex-col sm:items-center sm:justify-center sm:p-5"
            onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "60%", opacity: 0 }}
              transition={{ type: "spring", damping: 32, stiffness: 340, mass: 0.85 }}
              className="relative w-full flex flex-col overflow-hidden flex-1 sm:flex-initial sm:max-w-[460px] sm:rounded-[28px]"
              style={{
                background: "#0B0B0B",
                border: "1px solid rgba(255,255,255,0.06)",
                boxShadow: "0 40px 120px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.03)",
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Book a table"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Modal header ─────────────────────────────── */}
              <div
                className="shrink-0 flex items-center justify-between px-5 sm:px-6 h-[54px] border-b border-white/[0.05]"
                style={{ background: "#050505" }}
              >
                <div className="flex items-center gap-2.5">
                  <Coffee className="w-4 h-4" style={{ color: GOLD }} />
                  <h2 className="font-serif text-[15px] font-medium text-white tracking-tight">
                    {confirmed ? "Booking Received" : "Reserve a Table"}
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-white/35 hover:text-white hover:bg-white/[0.08] transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ── Content ──────────────────────────────────── */}
              <div className="flex-1 sm:flex-initial px-5 sm:px-6 pt-4 pb-5 sm:pb-6 flex flex-col">

                {/* Success state */}
                {confirmed ? (
                  <div className="flex flex-col items-center gap-5 text-center py-6 sm:py-4">
                    <div
                      className="flex items-center justify-center w-16 h-16 rounded-full"
                      style={{ background: "rgba(201,164,108,0.1)", border: `1px solid rgba(201,164,108,0.25)` }}
                    >
                      <CheckCircle2 className="w-8 h-8" style={{ color: GOLD }} />
                    </div>

                    <div>
                      <h3 className="font-serif text-xl font-light text-white mb-1.5">
                        Thank you, {confirmed.name.split(" ")[0]}!
                      </h3>
                      <p className="text-white/40 text-sm leading-relaxed max-w-xs">
                        Your booking request has been received. We'll confirm via email shortly.
                      </p>
                    </div>

                    <div
                      className="w-full rounded-2xl p-4 border border-white/[0.06] text-left space-y-3"
                      style={{ background: "#111111" }}
                    >
                      {[
                        {
                          icon: Calendar,
                          label: new Date(confirmed.booking_date + "T00:00:00").toLocaleDateString("en-IN", {
                            weekday: "long", day: "numeric", month: "long", year: "numeric",
                          }),
                        },
                        { icon: Clock, label: formatTime(confirmed.booking_time) },
                        {
                          icon: Users,
                          label: `${confirmed.party_size} ${confirmed.party_size === 1 ? "guest" : "guests"}`,
                        },
                      ].map(({ icon: Icon, label }) => (
                        <div key={label} className="flex items-center gap-3">
                          <Icon className="w-3.5 h-3.5 text-white/30 shrink-0" />
                          <span className="text-sm text-white/65">{label}</span>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-white/[0.06]">
                        <p className="text-[11px] text-white/25">
                          Ref: <span className="font-mono">{confirmed.id.slice(0, 8).toUpperCase()}</span>
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleClose}
                      className="mt-1 px-6 py-2.5 rounded-full text-sm font-semibold text-[#050505] transition-opacity hover:opacity-90"
                      style={{ background: GOLD }}
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  /* ── Booking form ──────────────────────────── */
                  <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 sm:gap-3 flex-1 sm:flex-initial">
                    {cafe?.name && (
                      <p className="text-[11px] text-white/30 -mt-0.5 mb-0.5">at {cafe.name}</p>
                    )}

                    {/* Full name */}
                    <div>
                      <FieldLabel>Full name *</FieldLabel>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                        required
                        disabled={createBooking.isPending}
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>

                    {/* Email + Phone */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <FieldLabel>Email *</FieldLabel>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                          disabled={createBooking.isPending}
                          className={inputCls}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <FieldLabel>Phone</FieldLabel>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          disabled={createBooking.isPending}
                          className={inputCls}
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    {/* Date + Time */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <FieldLabel>Date *</FieldLabel>
                        <input
                          type="date"
                          value={date}
                          min={today}
                          onChange={(e) => setDate(e.target.value)}
                          required
                          disabled={createBooking.isPending}
                          className={inputCls}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <FieldLabel>Time *</FieldLabel>
                        <div className="relative">
                          <select
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            disabled={createBooking.isPending}
                            className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                            style={{ ...inputStyle, paddingRight: "2rem" }}
                          >
                            {TIME_SLOTS.map((slot) => (
                              <option key={slot.value} value={slot.value}
                                style={{ background: "#171717", color: "#fff" }}>
                                {slot.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Guests stepper */}
                    <div>
                      <FieldLabel>Guests *</FieldLabel>
                      <div className="flex items-center gap-3 h-10">
                        <button
                          type="button"
                          onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                          disabled={partySize <= 1 || createBooking.isPending}
                          className="flex items-center justify-center w-10 h-10 rounded-xl border border-white/[0.08] text-white/50 hover:text-white hover:border-white/20 transition-colors disabled:opacity-30"
                          style={{ background: "#171717" }}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="flex-1 text-center text-sm font-medium text-white">
                          {partySize} {partySize === 1 ? "guest" : "guests"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPartySize((n) => Math.min(20, n + 1))}
                          disabled={partySize >= 20 || createBooking.isPending}
                          className="flex items-center justify-center w-10 h-10 rounded-xl border border-white/[0.08] text-white/50 hover:text-white hover:border-white/20 transition-colors disabled:opacity-30"
                          style={{ background: "#171717" }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <FieldLabel>Special requests</FieldLabel>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Allergies, dietary requirements, special occasions…"
                        rows={2}
                        disabled={createBooking.isPending}
                        className={`${inputCls} h-auto py-2.5 resize-none`}
                        style={{ ...inputStyle, height: "auto" }}
                      />
                    </div>

                    {/* Error */}
                    {submitError && (
                      <div
                        className="flex items-start gap-2.5 p-3 rounded-xl text-sm border"
                        style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)", color: "#f87171" }}
                      >
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>{submitError}</p>
                      </div>
                    )}

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={createBooking.isPending || !name.trim() || !email.trim() || !date || !time}
                      className="w-full h-11 rounded-xl text-sm font-semibold text-[#050505] transition-opacity hover:opacity-90 active:scale-[0.99] disabled:opacity-40 mt-0.5"
                      style={{ background: GOLD }}
                    >
                      {createBooking.isPending ? "Submitting…" : "Request Booking"}
                    </button>

                    <p className="text-[11px] text-white/20 text-center">
                      We'll confirm your reservation and get back to you shortly.
                    </p>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
