import { MapPin, Phone, Mail, Clock, ExternalLink, Instagram, Facebook } from "lucide-react";
import { motion } from "framer-motion";
import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { BookingCTAButton } from "@/contexts/BookingModalContext";
import { cn } from "@/lib/utils";
import { OpeningHoursEntry } from "@/types";

/* ── Brand palette (cream theme) ────────────────────────────────────────── */
const BG1    = "#F8F3EA";
const BG2    = "#F2E8D8";
const CARD   = "#FFFDF8";
const HEAD   = "#4B2E1F";
const BODY   = "#6D5845";
const ACCENT = "#A66A3F";
const BORDER = "#D9CBB7";
const GOLD   = "#C9A46C";

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

function HoursTable({ hours }: { hours: OpeningHoursEntry[] }) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  return (
    <div style={{ borderColor: BORDER }} className="divide-y divide-[#D9CBB7]">
      {hours.map((entry) => {
        const isToday = entry.day === today;
        return (
          <div key={entry.day}
            className={cn("flex items-center justify-between py-3 sm:py-3.5 text-sm transition-colors",
              isToday ? "-mx-4 sm:-mx-5 px-4 sm:px-5 rounded-lg" : "")}
            style={isToday ? { background: `rgba(166,106,63,0.07)` } : {}}>
            <span className="font-medium" style={{ color: isToday ? HEAD : BODY }}>{entry.day}</span>
            {entry.closed ? (
              <span className="italic text-xs" style={{ color: BORDER }}>Closed</span>
            ) : (
              <span className="font-semibold" style={{ color: isToday ? ACCENT : BODY }}>
                {entry.open} – {entry.close}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CafeContactPage() {
  const { data: cafe, isLoading: cafeLoading } = usePublicCafe();
  const { data: settings, isLoading: settingsLoading } = usePublicWebsiteSettings(cafe?.id);
  const isLoading = cafeLoading || settingsLoading;
  const displayName = settings?.cafe_name ?? cafe?.name ?? "Contact";
  const primaryColor = settings?.primary_color ?? ACCENT;
  const hasHours = Array.isArray(settings?.opening_hours) && settings!.opening_hours.length > 0;

  return (
    <CafeLayout
      cafeName={displayName}
      logoUrl={settings?.logo_url}
      primaryColor={primaryColor}
      settings={settings}
    >

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="relative pt-20 sm:pt-28 pb-5 sm:pb-10 px-4 sm:px-6 text-center overflow-hidden" style={{ background: BG1 }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `radial-gradient(ellipse at 50% 0%, ${GOLD}, transparent 55%)` }} />
        <motion.div initial="hidden" animate="show" variants={stagger} className="relative z-10 max-w-xl mx-auto">
          <motion.p variants={fadeUp} className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-4" style={{ color: ACCENT }}>
            {displayName}
          </motion.p>
          <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-6" style={{ background: GOLD }} />
          <motion.h1 variants={fadeUp} className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light leading-tight tracking-tight" style={{ color: HEAD }}>
            Get in Touch
          </motion.h1>
          {settings?.tagline && (
            <motion.p variants={fadeUp} className="mt-4 font-light text-sm sm:text-base" style={{ color: BODY }}>
              {settings.tagline}
            </motion.p>
          )}
        </motion.div>
      </div>

      {/* ── Contact info ────────────────────────────────────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6" style={{ background: BG2 }}>
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12">

          {/* Left — details */}
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
            <motion.p variants={fadeUp} className="text-[10px] font-semibold uppercase tracking-[0.25em] mb-6 sm:mb-8" style={{ color: ACCENT }}>
              Contact
            </motion.p>

            <div className="space-y-3 sm:space-y-4">
              {settings?.address && (
                <motion.div variants={fadeUp}
                  className="flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-xl border group transition-colors hover:shadow-sm"
                  style={{ background: CARD, borderColor: BORDER }}>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `rgba(166,106,63,0.10)` }}>
                    <MapPin className="w-4 h-4" style={{ color: ACCENT }} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: BORDER }}>Address</p>
                    <p className="text-sm leading-relaxed" style={{ color: BODY }}>{settings.address}</p>
                    {settings.google_maps_url && (
                      <a href={settings.google_maps_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium mt-1.5 hover:opacity-70 transition-opacity" style={{ color: ACCENT }}>
                        Open in Maps <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </motion.div>
              )}

              {settings?.phone && (
                <motion.a variants={fadeUp} href={`tel:${settings.phone}`}
                  className="flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-xl border group transition-colors hover:shadow-sm"
                  style={{ background: CARD, borderColor: BORDER }}>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `rgba(166,106,63,0.10)` }}>
                    <Phone className="w-4 h-4" style={{ color: ACCENT }} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: BORDER }}>Phone</p>
                    <p className="text-sm transition-colors" style={{ color: BODY }}>{settings.phone}</p>
                  </div>
                </motion.a>
              )}

              {settings?.email && (
                <motion.a variants={fadeUp} href={`mailto:${settings.email}`}
                  className="flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-xl border group transition-colors hover:shadow-sm"
                  style={{ background: CARD, borderColor: BORDER }}>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `rgba(166,106,63,0.10)` }}>
                    <Mail className="w-4 h-4" style={{ color: ACCENT }} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: BORDER }}>Email</p>
                    <p className="text-sm transition-colors" style={{ color: BODY }}>{settings.email}</p>
                  </div>
                </motion.a>
              )}
            </div>

            {(settings?.instagram_url || settings?.facebook_url) && (
              <motion.div variants={fadeUp} className="mt-6 sm:mt-8">
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] mb-4" style={{ color: ACCENT }}>Follow Us</p>
                <div className="flex flex-wrap gap-2.5 sm:gap-3">
                  {settings?.instagram_url && (
                    <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all text-sm hover:shadow-sm"
                      style={{ borderColor: BORDER, color: BODY }}>
                      <Instagram className="w-4 h-4" /> Instagram
                    </a>
                  )}
                  {settings?.facebook_url && (
                    <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all text-sm hover:shadow-sm"
                      style={{ borderColor: BORDER, color: BODY }}>
                      <Facebook className="w-4 h-4" /> Facebook
                    </a>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Right — hours */}
          {hasHours && (
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
              <motion.div variants={fadeUp} className="flex items-center gap-3 mb-6 sm:mb-8">
                <Clock className="w-4 h-4" style={{ color: ACCENT }} />
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: ACCENT }}>Opening Hours</p>
              </motion.div>
              <motion.div variants={fadeUp} className="rounded-2xl p-4 sm:p-6 border" style={{ background: CARD, borderColor: BORDER }}>
                <HoursTable hours={settings!.opening_hours} />
              </motion.div>
            </motion.div>
          )}
        </div>
      </section>

      {/* ── Book CTA ─────────────────────────────────────────── */}
      <section className="py-16 sm:py-28 px-4 sm:px-6 text-center relative overflow-hidden" style={{ background: BG1 }}>
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: `radial-gradient(circle at 50% 50%, ${GOLD}, transparent 60%)` }} />
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}
          className="relative z-10 max-w-xl mx-auto">
          <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-7" style={{ background: GOLD }} />
          <motion.h2 variants={fadeUp} className="font-serif text-2xl sm:text-3xl lg:text-4xl font-light tracking-tight mb-3" style={{ color: HEAD }}>
            Ready to visit?
          </motion.h2>
          <motion.p variants={fadeUp} className="text-sm mb-8 sm:mb-10" style={{ color: BODY }}>
            Reserve your table online in seconds.
          </motion.p>
          <motion.div variants={fadeUp}>
            <BookingCTAButton
              className="inline-flex items-center px-7 py-3.5 rounded-full text-sm font-semibold hover:opacity-90 active:scale-95 transition-all"
              style={{ background: ACCENT, color: "#fff" }}
            >
              Book a Table
            </BookingCTAButton>
          </motion.div>
        </motion.div>
      </section>
    </CafeLayout>
  );
}
