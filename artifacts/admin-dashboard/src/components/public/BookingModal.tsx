import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Calendar, Clock, Users, Minus, Plus,
  CheckCircle2, AlertCircle, Coffee, ChevronDown,
} from "lucide-react";
import { usePublicCafe, usePublicCreateBooking, PublicBookingResult } from "@/hooks/usePublicBooking";
import { formatTime } from "@/lib/utils";
import { useBookingModal } from "@/contexts/BookingModalContext";

/* ── Brand palette (matches public website) ─────────────────────────── */
const BG_WARM      = "#F8F3EA";   /* primary modal background            */
const BG_SECONDARY = "#F2E8D8";   /* header strip                        */
const BG_INPUT     = "#FFFDF8";   /* input / card surface                */
const HEADING      = "#4B2E1F";   /* dark coffee headings                */
const BODY         = "#6D5845";   /* warm body text                      */
const ACCENT       = "#A66A3F";   /* terracotta accent / CTA             */
const BORDER       = "#D9CBB7";   /* soft warm border                    */

/* ── Time slots (unchanged) ─────────────────────────────────────────── */
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

/* ── Shared input style ─────────────────────────────────────────────── */
const inputCls = [
  "w-full h-10 rounded-xl px-3 text-sm placeholder:text-[#A8937E]",
  "border focus:outline-none focus:ring-0",
  "transition-colors duration-200",
].join(" ");

const inputStyle = {
  background: BG_INPUT,
  color: HEADING,
  borderColor: BORDER,
  colorScheme: "light" as const,
};

const inputFocusStyle = {
  ...inputStyle,
  borderColor: ACCENT,
};

/* ── Tiny helper to handle focus border swap ────────────────────────── */
function WarmInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      className={`${inputCls} ${props.className ?? ""}`}
      style={focused ? inputFocusStyle : inputStyle}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e)  => { setFocused(false); props.onBlur?.(e); }}
    />
  );
}

function WarmTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      {...props}
      className={`${inputCls} h-auto py-2.5 resize-none ${props.className ?? ""}`}
      style={focused ? inputFocusStyle : inputStyle}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e)  => { setFocused(false); props.onBlur?.(e); }}
    />
  );
}

function WarmSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      {...props}
      className={`${inputCls} appearance-none pr-8 cursor-pointer ${props.className ?? ""}`}
      style={focused ? inputFocusStyle : inputStyle}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e)  => { setFocused(false); props.onBlur?.(e); }}
    />
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-1"
      style={{ color: `${BODY}90` }}
    >
      {children}
    </p>
  );
}

export function BookingModal() {
  const { isOpen, closeBooking } = useBookingModal();
  const { data: cafe } = usePublicCafe();
  const createBooking = usePublicCreateBooking();

  const today = todayStr();
  const [name,        setName       ] = useState("");
  const [email,       setEmail      ] = useState("");
  const [phone,       setPhone      ] = useState("");
  const [partySize,   setPartySize  ] = useState(2);
  const [date,        setDate       ] = useState(today);
  const [time,        setTime       ] = useState("12:00");
  const [notes,       setNotes      ] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed,   setConfirmed  ] = useState<PublicBookingResult | null>(null);

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
        cafe_id:      cafe.id,
        name:         name.trim(),
        email:        email.trim(),
        phone:        phone.trim() || null,
        party_size:   partySize,
        booking_date: date,
        booking_time: time,
        notes:        notes.trim() || null,
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
          {/* ── Backdrop ──────────────────────────────────────────────── */}
          <motion.div
            key="bm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[200]"
            style={{ background: "rgba(60,45,35,0.38)", backdropFilter: "blur(6px)" }}
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* ── Panel wrapper ─────────────────────────────────────────── */}
          <motion.div
            key="bm-panel-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[210] flex flex-col sm:items-center sm:justify-center sm:p-5"
            onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", damping: 30, stiffness: 320, mass: 0.8 }}
              className="relative w-full flex flex-col overflow-hidden flex-1 sm:flex-initial sm:max-w-[480px] sm:rounded-[22px]"
              style={{
                background: BG_WARM,
                border: `1px solid ${BORDER}`,
                boxShadow: "0 24px 64px rgba(61,30,15,0.18), 0 4px 16px rgba(61,30,15,0.08)",
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Book a table"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Header ──────────────────────────────────────────── */}
              <div
                className="shrink-0 flex items-center justify-between px-5 sm:px-6 h-[56px] border-b"
                style={{ background: BG_SECONDARY, borderColor: BORDER }}
              >
                <div className="flex items-center gap-2.5">
                  <Coffee className="w-4 h-4" style={{ color: ACCENT }} />
                  <h2
                    className="font-serif text-[15px] font-medium tracking-tight"
                    style={{ color: HEADING }}
                  >
                    {confirmed ? "Booking Received" : "Reserve a Table"}
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  className="flex items-center justify-center w-8 h-8 rounded-full transition-colors"
                  style={{ color: BODY, border: `1px solid ${BORDER}` }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = BORDER;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                  aria-label="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* ── Content ─────────────────────────────────────────── */}
              <div className="flex-1 sm:flex-initial px-5 sm:px-6 pt-4 pb-5 sm:pb-6 flex flex-col overflow-y-auto">

                {/* ── Success state ────────────────────────────────── */}
                {confirmed ? (
                  <div className="flex flex-col items-center gap-5 text-center py-6 sm:py-4">

                    <div
                      className="flex items-center justify-center w-16 h-16 rounded-full"
                      style={{ background: `${ACCENT}15`, border: `1.5px solid ${ACCENT}40` }}
                    >
                      <CheckCircle2 className="w-8 h-8" style={{ color: ACCENT }} />
                    </div>

                    <div>
                      <h3
                        className="font-serif text-xl font-light mb-1.5"
                        style={{ color: HEADING }}
                      >
                        Thank you, {confirmed.name.split(" ")[0]}!
                      </h3>
                      <p className="text-sm leading-relaxed max-w-xs" style={{ color: BODY }}>
                        Your booking request has been received. We'll confirm via email shortly.
                      </p>
                    </div>

                    {/* Confirmation card */}
                    <div
                      className="w-full rounded-2xl p-4 text-left space-y-3 border"
                      style={{ background: BG_INPUT, borderColor: BORDER }}
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
                          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: `${BODY}80` }} />
                          <span className="text-sm" style={{ color: BODY }}>{label}</span>
                        </div>
                      ))}
                      <div className="pt-2 border-t" style={{ borderColor: BORDER }}>
                        <p className="text-[11px]" style={{ color: `${BODY}60` }}>
                          Ref:{" "}
                          <span className="font-mono">{confirmed.id.slice(0, 8).toUpperCase()}</span>
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleClose}
                      className="mt-1 px-8 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
                      style={{ background: ACCENT }}
                    >
                      Close
                    </button>
                  </div>

                ) : (
                  /* ── Booking form ─────────────────────────────────── */
                  <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 sm:gap-3 flex-1 sm:flex-initial">

                    {cafe?.name && (
                      <p className="text-[11px] -mt-0.5 mb-0.5" style={{ color: `${BODY}70` }}>
                        at {cafe.name}
                      </p>
                    )}

                    {/* Full name */}
                    <div>
                      <FieldLabel>Full name *</FieldLabel>
                      <WarmInput
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                        required
                        disabled={createBooking.isPending}
                      />
                    </div>

                    {/* Email + Phone */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <FieldLabel>Email *</FieldLabel>
                        <WarmInput
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                          disabled={createBooking.isPending}
                        />
                      </div>
                      <div>
                        <FieldLabel>Phone</FieldLabel>
                        <WarmInput
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          disabled={createBooking.isPending}
                        />
                      </div>
                    </div>

                    {/* Date + Time */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <FieldLabel>Date *</FieldLabel>
                        <WarmInput
                          type="date"
                          value={date}
                          min={today}
                          onChange={(e) => setDate(e.target.value)}
                          required
                          disabled={createBooking.isPending}
                        />
                      </div>
                      <div>
                        <FieldLabel>Time *</FieldLabel>
                        <div className="relative">
                          <WarmSelect
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            disabled={createBooking.isPending}
                          >
                            {TIME_SLOTS.map((slot) => (
                              <option key={slot.value} value={slot.value}>
                                {slot.label}
                              </option>
                            ))}
                          </WarmSelect>
                          <ChevronDown
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                            style={{ color: `${BODY}70` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Guests stepper */}
                    <div>
                      <FieldLabel>Guests *</FieldLabel>
                      <div
                        className="flex items-center h-10 rounded-xl border overflow-hidden"
                        style={{ borderColor: BORDER, background: BG_INPUT }}
                      >
                        <button
                          type="button"
                          onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                          disabled={partySize <= 1 || createBooking.isPending}
                          className="flex items-center justify-center w-10 h-full border-r shrink-0 transition-colors disabled:opacity-30"
                          style={{
                            color: BODY,
                            borderColor: BORDER,
                          }}
                          onMouseEnter={(e) => {
                            if (!e.currentTarget.disabled)
                              (e.currentTarget as HTMLButtonElement).style.background = BG_SECONDARY;
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                          }}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span
                          className="flex-1 text-center text-sm font-medium"
                          style={{ color: HEADING }}
                        >
                          {partySize} {partySize === 1 ? "guest" : "guests"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPartySize((n) => Math.min(20, n + 1))}
                          disabled={partySize >= 20 || createBooking.isPending}
                          className="flex items-center justify-center w-10 h-full border-l shrink-0 transition-colors disabled:opacity-30"
                          style={{
                            color: BODY,
                            borderColor: BORDER,
                          }}
                          onMouseEnter={(e) => {
                            if (!e.currentTarget.disabled)
                              (e.currentTarget as HTMLButtonElement).style.background = BG_SECONDARY;
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                          }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Special requests */}
                    <div>
                      <FieldLabel>Special requests</FieldLabel>
                      <WarmTextarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Allergies, dietary requirements, special occasions…"
                        rows={2}
                        disabled={createBooking.isPending}
                      />
                    </div>

                    {/* Error */}
                    {submitError && (
                      <div
                        className="flex items-start gap-2.5 p-3 rounded-xl text-sm border"
                        style={{
                          background: "rgba(180,60,40,0.07)",
                          borderColor: "rgba(180,60,40,0.22)",
                          color: "#9B3A28",
                        }}
                      >
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>{submitError}</p>
                      </div>
                    )}

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={createBooking.isPending || !name.trim() || !email.trim() || !date || !time}
                      className="w-full h-11 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-40 mt-1"
                      style={{ background: ACCENT, letterSpacing: "0.04em" }}
                    >
                      {createBooking.isPending ? "Submitting…" : "Request Booking"}
                    </button>

                    <p className="text-[11px] text-center" style={{ color: `${BODY}55` }}>
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
