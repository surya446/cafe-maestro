import { MapPin, Phone, Mail, Clock, ExternalLink, Instagram, Facebook } from "lucide-react";
import { motion } from "framer-motion";
import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { BookingCTAButton } from "@/contexts/BookingModalContext";
import { cn } from "@/lib/utils";
import { OpeningHoursEntry } from "@/types";

const GOLD = "#C9A46C";

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

function HoursTable({ hours }: { hours: OpeningHoursEntry[] }) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  return (
    <div className="divide-y divide-white/[0.05]">
      {hours.map((entry) => {
        const isToday = entry.day === today;
        return (
          <div key={entry.day}
            className={cn("flex items-center justify-between py-3 sm:py-3.5 text-sm transition-colors",
              isToday ? "bg-[#C9A46C]/[0.05] -mx-4 sm:-mx-5 px-4 sm:px-5 rounded-lg" : "")}>
            <span className={cn("font-medium", isToday ? "text-white" : "text-white/40")}>{entry.day}</span>
            {entry.closed ? (
              <span className="text-white/20 italic text-xs">Closed</span>
            ) : (
              <span className={isToday ? "font-semibold" : "text-white/38"} style={isToday ? { color: GOLD } : {}}>
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
  const primaryColor = settings?.primary_color ?? "#1a1a1a";
  const hasHours = Array.isArray(settings?.opening_hours) && settings!.opening_hours.length > 0;

  return (
    <CafeLayout
      cafeName={displayName}
      logoUrl={settings?.logo_url}
      primaryColor={primaryColor}
      settings={settings}
    >

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="relative pt-24 sm:pt-36 pb-12 sm:pb-20 px-4 sm:px-6 text-center overflow-hidden" style={{ background: "#050505" }}>
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `radial-gradient(ellipse at 50% 0%, ${GOLD}, transparent 55%)` }} />
        <motion.div initial="hidden" animate="show" variants={stagger} className="relative z-10 max-w-xl mx-auto">
          <motion.p variants={fadeUp} className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-4" style={{ color: GOLD }}>
            {displayName}
          </motion.p>
          <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-6" style={{ background: GOLD }} />
          <motion.h1 variants={fadeUp} className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light text-white leading-tight tracking-tight">
            Get in Touch
          </motion.h1>
          {settings?.tagline && (
            <motion.p variants={fadeUp} className="text-white/30 mt-4 font-light text-sm sm:text-base">
              {settings.tagline}
            </motion.p>
          )}
        </motion.div>
      </div>

      {/* ── Contact info ────────────────────────────────────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6" style={{ background: "#0B0B0B" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12">

          {/* Left — details */}
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
            <motion.p variants={fadeUp} className="text-[10px] font-semibold uppercase tracking-[0.25em] mb-6 sm:mb-8" style={{ color: GOLD }}>
              Contact
            </motion.p>

            <div className="space-y-3 sm:space-y-4">
              {settings?.address && (
                <motion.div variants={fadeUp}
                  className="flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-xl border border-white/[0.05] group hover:border-[#C9A46C]/18 transition-colors"
                  style={{ background: "#111111" }}>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(201,164,108,0.08)" }}>
                    <MapPin className="w-4 h-4" style={{ color: GOLD }} />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">Address</p>
                    <p className="text-white/65 text-sm leading-relaxed">{settings.address}</p>
                    {settings.google_maps_url && (
                      <a href={settings.google_maps_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium mt-1.5 hover:opacity-70 transition-opacity" style={{ color: GOLD }}>
                        Open in Maps <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </motion.div>
              )}

              {settings?.phone && (
                <motion.a variants={fadeUp} href={`tel:${settings.phone}`}
                  className="flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-xl border border-white/[0.05] group hover:border-[#C9A46C]/18 transition-colors"
                  style={{ background: "#111111" }}>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(201,164,108,0.08)" }}>
                    <Phone className="w-4 h-4" style={{ color: GOLD }} />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">Phone</p>
                    <p className="text-white/65 text-sm group-hover:text-white transition-colors">{settings.phone}</p>
                  </div>
                </motion.a>
              )}

              {settings?.email && (
                <motion.a variants={fadeUp} href={`mailto:${settings.email}`}
                  className="flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-xl border border-white/[0.05] group hover:border-[#C9A46C]/18 transition-colors"
                  style={{ background: "#111111" }}>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(201,164,108,0.08)" }}>
                    <Mail className="w-4 h-4" style={{ color: GOLD }} />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">Email</p>
                    <p className="text-white/65 text-sm group-hover:text-white transition-colors">{settings.email}</p>
                  </div>
                </motion.a>
              )}
            </div>

            {(settings?.instagram_url || settings?.facebook_url) && (
              <motion.div variants={fadeUp} className="mt-6 sm:mt-8">
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] mb-4" style={{ color: GOLD }}>Follow Us</p>
                <div className="flex flex-wrap gap-2.5 sm:gap-3">
                  {settings?.instagram_url && (
                    <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/[0.07] text-white/38 hover:text-white hover:border-[#C9A46C]/28 transition-all text-sm">
                      <Instagram className="w-4 h-4" /> Instagram
                    </a>
                  )}
                  {settings?.facebook_url && (
                    <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/[0.07] text-white/38 hover:text-white hover:border-[#C9A46C]/28 transition-all text-sm">
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
                <Clock className="w-4 h-4" style={{ color: GOLD }} />
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: GOLD }}>Opening Hours</p>
              </motion.div>
              <motion.div variants={fadeUp} className="rounded-2xl p-4 sm:p-6 border border-white/[0.05]" style={{ background: "#111111" }}>
                <HoursTable hours={settings!.opening_hours} />
              </motion.div>
            </motion.div>
          )}
        </div>
      </section>

      {/* ── Book CTA ─────────────────────────────────────────── */}
      <section className="py-16 sm:py-28 px-4 sm:px-6 text-center relative overflow-hidden" style={{ background: "#111111" }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `radial-gradient(circle at 50% 50%, ${GOLD}, transparent 60%)` }} />
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}
          className="relative z-10 max-w-xl mx-auto">
          <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-7" style={{ background: GOLD }} />
          <motion.h2 variants={fadeUp} className="font-serif text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight mb-3">
            Ready to visit?
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/30 text-sm mb-8 sm:mb-10">
            Reserve your table online in seconds.
          </motion.p>
          <motion.div variants={fadeUp}>
            <BookingCTAButton
              className="inline-flex items-center px-7 py-3.5 rounded-full text-sm font-semibold text-[#050505] hover:opacity-90 active:scale-95 transition-all"
              style={{ background: GOLD }}
            >
              Book a Table
            </BookingCTAButton>
          </motion.div>
        </motion.div>
      </section>
    </CafeLayout>
  );
}
