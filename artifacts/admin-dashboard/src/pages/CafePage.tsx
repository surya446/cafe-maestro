import { Link } from "wouter";
import { ArrowRight, MapPin, Clock, Instagram, Coffee } from "lucide-react";
import { motion } from "framer-motion";
import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { BookingCTAButton } from "@/contexts/BookingModalContext";
import { OpeningHoursEntry } from "@/types";

/* ── Brand palette ──────────────────────────────────────────────────────── */
const CREAM = "#F2E8D5";
const BROWN = "#3D1E0F";
const TERRA = "#8B4A2B";
const MID   = "#6B3A2A";

/* ── Photo manifest ─────────────────────────────────────────────────────── */
const PHOTOS = {
  hero:      "/admin/cafe-hero.png",
  coffee:    "/admin/cafe-crafted.png",
  artwall:   "/admin/cafe-artwall.png",
  pendant:   "/admin/cafe-pendant.png",
  ringlight: "/admin/cafe-ringlight.png",
  dining:    "/admin/cafe-contact.png",
};

/* ── Animation presets ──────────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] } },
};
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

function todayHours(hours: OpeningHoursEntry[]) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const entry = hours.find((h) => h.day === today);
  if (!entry) return null;
  return entry.closed ? "Closed today" : `${entry.open} – ${entry.close}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════════════════ */
export function CafePage() {
  const { data: cafe, isLoading: cafeLoading } = usePublicCafe();
  const { data: settings, isLoading: settingsLoading } = usePublicWebsiteSettings(cafe?.id);

  const isLoading    = cafeLoading || settingsLoading;
  const displayName  = settings?.cafe_name ?? cafe?.name ?? "Cup & Cozy";
  const primaryColor = settings?.primary_color ?? TERRA;
  const heroImg      = settings?.hero_image_url ?? PHOTOS.hero;
  const hasHours     = Array.isArray(settings?.opening_hours) && settings!.opening_hours.length > 0;
  const openLabel    = hasHours ? todayHours(settings!.opening_hours) : null;

  if (isLoading) {
    return (
      <CafeLayout cafeName="Loading…" primaryColor={primaryColor}>
        <div className="h-screen flex items-center justify-center" style={{ background: CREAM }}>
          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }}>
            <Coffee className="w-10 h-10" style={{ color: TERRA }} />
          </motion.div>
        </div>
      </CafeLayout>
    );
  }

  if (!cafe) {
    return (
      <CafeLayout cafeName="Cafe" primaryColor={primaryColor}>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ background: CREAM }}>
          <Coffee className="w-14 h-14" style={{ color: TERRA }} />
          <p className="text-base font-light" style={{ color: MID }}>Coming soon</p>
        </div>
      </CafeLayout>
    );
  }

  return (
    <CafeLayout
      cafeName={displayName}
      logoUrl={settings?.logo_url}
      primaryColor={primaryColor}
      settings={settings}
    >

      {/* ══════════════════════════════════════════════════════════════════
          §1  HERO — full-viewport interior, editorial typography
      ══════════════════════════════════════════════════════════════════ */}
      <section
        className="relative w-full overflow-hidden"
        style={{ height: "100svh", minHeight: 600 }}
        aria-label="Hero"
      >
        <motion.img
          src={heroImg}
          alt="Cup & Cozy café interior"
          className="absolute inset-0 w-full h-full object-cover object-center"
          fetchPriority="high"
          decoding="async"
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 8, ease: "easeOut" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(20,10,5,0.30) 0%, rgba(20,10,5,0.12) 38%, rgba(20,10,5,0.18) 62%, rgba(20,10,5,0.54) 100%)",
          }}
        />

        <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="flex flex-col items-center gap-6"
          >
            <motion.p
              variants={fadeUp}
              className="text-[10px] sm:text-xs font-semibold tracking-[0.30em] uppercase text-white/60"
            >
              Meringrice · Est. 2023
            </motion.p>

            <motion.h1
              variants={fadeUp}
              className="font-serif text-white leading-[1.05] tracking-tight"
              style={{ fontSize: "clamp(2.8rem, 7.5vw, 5.5rem)", textShadow: "0 4px 32px rgba(0,0,0,0.35)" }}
            >
              {displayName}
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="font-serif italic text-white/75 leading-snug max-w-xs sm:max-w-md"
              style={{ fontSize: "clamp(1.05rem, 2.4vw, 1.4rem)" }}
            >
              Curated coffee.<br />Curated conversations.
            </motion.p>

            <motion.div variants={fadeUp} className="w-12 h-px" style={{ background: "rgba(255,255,255,0.35)" }} />

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-3 mt-1">
              <Link
                href="/cafe/menu"
                className="inline-flex items-center gap-2 px-8 py-3.5 text-[13px] font-semibold text-white rounded-sm transition-all duration-300 hover:bg-white hover:text-[#3D1E0F] active:scale-95"
                style={{
                  border: "1.5px solid rgba(255,255,255,0.80)",
                  background: "rgba(255,255,255,0.08)",
                  backdropFilter: "blur(8px)",
                  letterSpacing: "0.08em",
                }}
              >
                View Menu
              </Link>
              <BookingCTAButton
                className="inline-flex items-center gap-2 px-8 py-3.5 text-[13px] font-semibold rounded-sm transition-all duration-300 hover:opacity-90 active:scale-95"
                style={{ background: TERRA, color: "#fff", letterSpacing: "0.08em" }}
              >
                Reserve a Table
              </BookingCTAButton>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.2, duration: 1 }}
        >
          <p className="text-[9px] tracking-[0.22em] uppercase text-white/40">Scroll</p>
          <motion.div
            className="w-px rounded-full"
            style={{ height: 42, background: "linear-gradient(to bottom, rgba(255,255,255,0.1), rgba(255,255,255,0.55))" }}
            animate={{ scaleY: [1, 0.4, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          §2  CRAFTED — coffee photo left, editorial text right
          Reference: image_1784647790831
      ══════════════════════════════════════════════════════════════════ */}
      <section
        className="w-full flex flex-col sm:flex-row overflow-hidden"
        style={{ minHeight: 460 }}
        aria-label="Crafted to Cup & Cozy"
      >
        {/* Left — photograph */}
        <motion.div
          className="sm:w-[48%] relative overflow-hidden"
          style={{ minHeight: 300 }}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <img
            src={PHOTOS.coffee}
            alt="Signature Hazelnut Velvet iced coffee"
            className="absolute inset-0 w-full h-full object-cover object-center"
            loading="lazy"
            decoding="async"
          />
        </motion.div>

        {/* Right — cream text panel */}
        <motion.div
          className="flex-1 flex flex-col justify-center px-10 sm:px-14 lg:px-20 py-16 sm:py-20"
          style={{ background: CREAM }}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger}
        >
          <motion.h2
            variants={fadeUp}
            className="font-serif leading-[1.08] mb-5"
            style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)", color: BROWN }}
          >
            Crafted to<br />{displayName}
          </motion.h2>

          <motion.p
            variants={fadeUp}
            className="text-sm leading-relaxed mb-7"
            style={{ color: MID, maxWidth: 320 }}
          >
            Your daily retreat of curated flavors and curved corners.
          </motion.p>

          <motion.div
            variants={fadeUp}
            style={{ width: 48, height: 1, background: `${BROWN}30`, marginBottom: 28 }}
          />

          <motion.p
            variants={fadeUp}
            className="font-serif leading-snug"
            style={{ fontSize: "clamp(1.05rem, 1.9vw, 1.3rem)", color: BROWN, maxWidth: 310 }}
          >
            Try our signature Hazelnut Velvet, where artistry meets taste.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8">
            <Link
              href="/cafe/menu"
              className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.10em] uppercase transition-opacity hover:opacity-60"
              style={{ color: TERRA }}
            >
              View Menu <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          §3  CURATED CORNERS — art wall large left, lights stacked right
          Reference: image_1784647798915
      ══════════════════════════════════════════════════════════════════ */}
      <section
        style={{ background: CREAM }}
        aria-label="Curated Corners"
      >
        {/* Section label — flush left, generous top padding */}
        <div className="px-8 sm:px-12 lg:px-14 pt-14 pb-7">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeUp}
              className="font-serif leading-none mb-1.5"
              style={{ fontSize: "clamp(2rem, 4.5vw, 3.4rem)", color: BROWN }}
            >
              Curated Corners
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-sm"
              style={{ color: `${MID}75` }}
            >
              The Vibe
            </motion.p>
          </motion.div>
        </div>

        {/* Photo grid — edge-to-edge with small gaps */}
        <div className="flex flex-col sm:flex-row gap-1.5 px-1.5 pb-1.5">

          {/* Large left — art/gallery wall */}
          <motion.div
            className="sm:w-[63%] overflow-hidden"
            style={{ minHeight: 280 }}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          >
            <img
              src={PHOTOS.artwall}
              alt="Gallery wall — framed art prints beside the staircase"
              className="w-full h-full object-cover object-center transition-transform duration-700 hover:scale-[1.025]"
              style={{ aspectRatio: "4/3", display: "block" }}
              loading="lazy"
              decoding="async"
            />
          </motion.div>

          {/* Right column — pendant (top) + ring light (bottom) */}
          <div className="flex-1 flex flex-col gap-1.5">
            <motion.div
              className="overflow-hidden"
              initial={{ opacity: 0, x: 18 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.12 }}
              transition={{ duration: 0.8, delay: 0.07, ease: [0.16, 1, 0.3, 1] }}
            >
              <img
                src={PHOTOS.pendant}
                alt="Geometric diamond pendant light, warm amber glow"
                className="w-full object-cover object-center transition-transform duration-700 hover:scale-[1.035]"
                style={{ aspectRatio: "1/1", display: "block" }}
                loading="lazy"
                decoding="async"
              />
            </motion.div>
            <motion.div
              className="overflow-hidden"
              initial={{ opacity: 0, x: 18 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.12 }}
              transition={{ duration: 0.8, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              <img
                src={PHOTOS.ringlight}
                alt="Orbital ring light installation"
                className="w-full object-cover object-center transition-transform duration-700 hover:scale-[1.035]"
                style={{ aspectRatio: "1/1", display: "block" }}
                loading="lazy"
                decoding="async"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          §4  CONTACT — full-width interior photo + info bar
          Reference: image_1784647802773
      ══════════════════════════════════════════════════════════════════ */}
      <section aria-label="Visit us" className="w-full">

        {/* Full-width interior photograph */}
        <div className="w-full overflow-hidden" style={{ height: "min(580px, 62vw)", minHeight: 280 }}>
          <motion.img
            src={PHOTOS.dining}
            alt="Cup & Cozy — interior dining area with staircase and counter"
            className="w-full h-full object-cover object-center"
            loading="lazy"
            decoding="async"
            initial={{ scale: 1.04 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          />
        </div>

        {/* Info bar — cream strip */}
        <motion.div
          className="w-full flex flex-wrap items-start justify-between gap-x-8 gap-y-5 px-6 sm:px-10 lg:px-14 py-6 sm:py-7"
          style={{ background: CREAM, borderTop: `1.5px solid ${BROWN}18` }}
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Address */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] mb-1.5" style={{ color: `${MID}65` }}>
              Address
            </p>
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 mt-[2px] shrink-0" style={{ color: TERRA }} />
              <p className="text-sm leading-snug" style={{ color: BROWN }}>
                {settings?.address
                  ? settings.address
                  : <>Rocnowasan Road,<br />Meringrice, ia 28312<br />Calerod</>}
              </p>
            </div>
          </div>

          {/* Opening hours */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] mb-1.5" style={{ color: `${MID}65` }}>
              Opening hours
            </p>
            <div className="flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 mt-[2px] shrink-0" style={{ color: TERRA }} />
              <div className="text-sm leading-snug" style={{ color: BROWN }}>
                {hasHours && openLabel ? (
                  <p>{openLabel}</p>
                ) : (
                  <>
                    <p>1:30 am – 5:00 pm</p>
                    <p>1:00 am – 5:90 pm</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Social icons + handle */}
          <div className="flex items-center gap-2.5">
            {/* Facebook */}
            <a
              href={settings?.facebook_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="flex items-center justify-center w-8 h-8 rounded-full border transition-all hover:border-[#3D1E0F]"
              style={{ borderColor: `${BROWN}30`, color: MID }}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>
            {/* Instagram */}
            <a
              href={settings?.instagram_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="flex items-center justify-center w-8 h-8 rounded-full border transition-all hover:border-[#3D1E0F]"
              style={{ borderColor: `${BROWN}30`, color: MID }}
            >
              <Instagram className="w-3.5 h-3.5" />
            </a>
            {/* YouTube */}
            <a
              href="#"
              aria-label="YouTube"
              className="flex items-center justify-center w-8 h-8 rounded-full border transition-all hover:border-[#3D1E0F]"
              style={{ borderColor: `${BROWN}30`, color: MID }}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.97C18.88 4 12 4 12 4s-6.88 0-8.59.45A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.97C5.12 20 12 20 12 20s6.88 0 8.59-.45a2.78 2.78 0 0 0 1.95-1.97A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
              </svg>
            </a>
            <span className="text-sm ml-0.5" style={{ color: MID }}>@Cup &amp; Cozy</span>
          </div>

          {/* Reservations CTA */}
          <BookingCTAButton
            className="inline-flex items-center gap-2 px-7 py-2.5 rounded-sm text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-95 shrink-0"
            style={{ background: TERRA, letterSpacing: "0.06em" }}
          >
            Reservations
          </BookingCTAButton>
        </motion.div>
      </section>

    </CafeLayout>
  );
}
