import { Link } from "wouter";
import { ArrowRight, MapPin, Phone, Clock, Facebook, Instagram, Coffee } from "lucide-react";
import { motion } from "framer-motion";
import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { usePublicGallery } from "@/hooks/usePublicGallery";
import { usePublicReviews } from "@/hooks/usePublicReviews";
import { BookingCTAButton } from "@/contexts/BookingModalContext";
import { OpeningHoursEntry } from "@/types";
import { cn } from "@/lib/utils";

/* ── Brand palette ──────────────────────────────────────────────────────── */
const CREAM = "#F2E8D5";
const BROWN = "#3D1E0F";
const TERRA = "#8B4A2B";
const MID   = "#6B3A2A";

/* ── Photos ─────────────────────────────────────────────────────────────── */
// Hero — warm café interior with pendant lights & bookshelves
const HERO_BG =
  "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1800&q=90";

// "Crafted to" left panel — iced latte in a glass
const CRAFTED_BG =
  "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=900&q=85";

// Curated corners mosaic photos
const CURATED = [
  "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&q=80",
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80",
  "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=600&q=80",
  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80",
];

// Pendant light vibe photo
const PENDANT_PHOTO =
  "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=600&q=80";

// Bottom contact photo — café with staircase / dining area
const CONTACT_BG =
  "https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=1800&q=85";

/* ── Animations ─────────────────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] } },
};
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

/* ── Opening hours helper ────────────────────────────────────────────────── */
function todayHours(hours: OpeningHoursEntry[]) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const entry = hours.find((h) => h.day === today);
  if (!entry) return null;
  return entry.closed ? "Closed today" : `${entry.open} – ${entry.close}`;
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export function CafePage() {
  const { data: cafe, isLoading: cafeLoading } = usePublicCafe();
  const { data: settings, isLoading: settingsLoading } = usePublicWebsiteSettings(cafe?.id);
  const { data: gallery } = usePublicGallery(cafe?.id);
  const { data: reviews } = usePublicReviews(cafe?.id);

  const isLoading   = cafeLoading || settingsLoading;
  const displayName = settings?.cafe_name ?? cafe?.name ?? "Cup & Cozy";
  const primaryColor = settings?.primary_color ?? TERRA;
  const hasHours    = Array.isArray(settings?.opening_hours) && settings!.opening_hours.length > 0;
  const openLabel   = hasHours ? todayHours(settings!.opening_hours) : null;
  const heroImg     = settings?.hero_image_url ?? HERO_BG;

  /* Gallery photos for mosaic */
  const galleryUrls = (gallery ?? []).slice(0, 4).map((g) => g.url);
  const mosaicPhotos = galleryUrls.length >= 4 ? galleryUrls : [...galleryUrls, ...CURATED].slice(0, 4);

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
          HERO — full-bleed café photo, text centered, floating labels
      ══════════════════════════════════════════════════════════════════ */}
      <section
        className="relative w-full overflow-hidden"
        style={{ height: "100svh", minHeight: 560 }}
      >
        {/* Background photo */}
        <motion.img
          src={heroImg}
          alt="Café interior"
          className="absolute inset-0 w-full h-full object-cover object-center"
          fetchPriority="high"
          decoding="async"
          initial={{ scale: 1.06 }}
          animate={{ scale: 1 }}
          transition={{ duration: 6, ease: "easeOut" }}
        />

        {/* Subtle dark overlay for text legibility */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.32) 100%)",
          }}
        />

        {/* ── Floating hotspot — left ── */}
        <motion.div
          className="absolute left-6 sm:left-12 top-1/2 -translate-y-1/2 z-20 hidden sm:flex flex-col gap-1"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.2, duration: 0.7 }}
        >
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-white backdrop-blur-sm mb-2"
            style={{ background: "rgba(61,30,15,0.55)", border: "1px solid rgba(255,255,255,0.2)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white/70 shrink-0" />
            Our Local Sources
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-white backdrop-blur-sm mt-24 sm:mt-32"
            style={{ background: "rgba(61,30,15,0.55)", border: "1px solid rgba(255,255,255,0.2)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white/70 shrink-0" />
            Seasonal Special
          </div>
        </motion.div>

        {/* ── Floating hotspot — right ── */}
        <motion.div
          className="absolute right-6 sm:right-12 top-1/2 -translate-y-1/2 z-20 hidden sm:flex flex-col items-end"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.4, duration: 0.7 }}
        >
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-white backdrop-blur-sm"
            style={{ background: "rgba(61,30,15,0.55)", border: "1px solid rgba(255,255,255,0.2)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white/70 shrink-0" />
            Discover Our Curated Collection
          </div>
        </motion.div>

        {/* ── Centered hero text ── */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 text-center">
          <motion.h1
            className="font-serif text-white leading-[1.1] tracking-tight mb-6"
            style={{ fontSize: "clamp(2.2rem, 6vw, 4rem)", textShadow: "0 2px 24px rgba(0,0,0,0.40)" }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {settings?.hero_title ?? "A Haven for Coffee,\nConnection, and Calm"}
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7 }}
          >
            <Link
              href="/cafe/menu"
              className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-semibold text-white rounded transition-all hover:bg-white hover:text-[#3D1E0F] active:scale-95"
              style={{
                border: "1.5px solid rgba(255,255,255,0.85)",
                background: "rgba(0,0,0,0.18)",
                backdropFilter: "blur(6px)",
              }}
            >
              Explore Our Menu
            </Link>
          </motion.div>
        </div>

        {/* Scroll nudge */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 0.8 }}
        >
          <motion.div
            animate={{ y: [0, 7, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="w-px h-10 rounded-full"
            style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.7))" }}
          />
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SPLIT PANEL — "Crafted to Cup & Cozy" | "Curated Corners"
      ══════════════════════════════════════════════════════════════════ */}
      <section className="flex flex-col lg:flex-row" style={{ minHeight: 380 }}>

        {/* Left — dark panel with iced coffee photo + text */}
        <div className="relative lg:w-[38%] overflow-hidden" style={{ minHeight: 320 }}>
          <img
            src={CRAFTED_BG}
            alt="Signature drink"
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          {/* dark overlay */}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to right, rgba(20,10,5,0.85) 0%, rgba(20,10,5,0.60) 100%)" }}
          />
          <div className="relative z-10 h-full flex flex-col justify-center p-8 sm:p-10 lg:p-12">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={stagger}
            >
              <motion.h2 variants={fadeUp} className="font-serif text-2xl sm:text-3xl text-white leading-snug mb-3">
                Crafted to<br />
                <span style={{ color: `${CREAM}cc` }}>{displayName}</span>
              </motion.h2>
              <motion.p variants={fadeUp} className="text-xs sm:text-sm leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.55)" }}>
                Your daily retreat of curated flavors and curated corners.
              </motion.p>
              <motion.p variants={fadeUp} className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.40)" }}>
                {settings?.about_content
                  ? settings.about_content.slice(0, 120) + "…"
                  : "Try our signature Hazelnut Velvet, where artistry meets taste."}
              </motion.p>
              <motion.div variants={fadeUp} className="mt-6">
                <Link
                  href="/cafe/menu"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
                  style={{ color: `${CREAM}cc` }}
                >
                  View Menu <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Right — cream panel "Curated Corners / The Vibe" */}
        <div
          className="flex-1 flex flex-col sm:flex-row overflow-hidden"
          style={{ background: CREAM }}
        >
          {/* Text + mosaic */}
          <div className="flex-1 p-8 sm:p-10 lg:p-12 flex flex-col">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={stagger}
            >
              <motion.h2 variants={fadeUp} className="font-serif text-2xl sm:text-3xl mb-1" style={{ color: BROWN }}>
                Curated Corners
              </motion.h2>
              <motion.p variants={fadeUp} className="text-xs font-semibold uppercase tracking-[0.18em] mb-6" style={{ color: `${MID}70` }}>
                The Vibe
              </motion.p>

              {/* Photo mosaic grid */}
              <motion.div
                variants={fadeUp}
                className="grid grid-cols-2 gap-2 flex-1"
              >
                {mosaicPhotos.map((url, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg overflow-hidden",
                      i === 0 ? "row-span-2" : ""
                    )}
                    style={{
                      aspectRatio: i === 0 ? "3/4" : "4/3",
                      border: `1px solid ${BROWN}12`,
                    }}
                  >
                    <img
                      src={url}
                      alt={`Vibe ${i + 1}`}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>

          {/* Pendant / accent photo strip */}
          <div className="hidden sm:block w-[180px] lg:w-[200px] relative overflow-hidden shrink-0">
            <img
              src={PENDANT_PHOTO}
              alt="Café vibe"
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to bottom, transparent 60%, rgba(61,30,15,0.35) 100%)" }}
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          ABOUT STRIP — optional (only if content exists)
      ══════════════════════════════════════════════════════════════════ */}
      {settings?.about_content && (
        <section className="py-14 sm:py-20 px-6 sm:px-14" style={{ background: `${BROWN}07` }}>
          <div className="max-w-4xl mx-auto text-center">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="font-serif text-xl sm:text-2xl leading-relaxed"
              style={{ color: BROWN }}
            >
              "{settings.about_content.split(".")[0]}."
            </motion.p>
            <Link href="/cafe/about" className="inline-flex items-center gap-1.5 text-sm font-semibold mt-7 hover:opacity-70 transition-opacity" style={{ color: TERRA }}>
              Our Story <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          CONTACT PHOTO — full-width interior shot with info bar
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ minHeight: 480 }}>
        {/* Background photo */}
        <motion.img
          src={settings?.hero_image_url
            ? "https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=1800&q=85"
            : CONTACT_BG}
          alt="Café interior"
          className="w-full object-cover"
          style={{ height: "min(520px, 60vw)", minHeight: 320 }}
          loading="lazy"
          initial={{ scale: 1.04 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />

        {/* Info bar at bottom */}
        <motion.div
          className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 px-6 sm:px-12 py-5"
          style={{ background: CREAM, borderTop: `2px solid ${BROWN}18` }}
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Address */}
          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: TERRA }} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] mb-0.5" style={{ color: `${MID}60` }}>Address</p>
              <p className="text-sm" style={{ color: BROWN }}>
                {settings?.address ?? "Roconomarch Road, Hansagina, ia 28012"}
              </p>
              {settings?.address && (
                <p className="text-xs" style={{ color: `${MID}60` }}>
                  {settings?.email ?? ""}
                </p>
              )}
            </div>
          </div>

          {/* Opening hours */}
          <div className="flex items-start gap-2.5">
            <Clock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: TERRA }} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] mb-0.5" style={{ color: `${MID}60` }}>Opening hours</p>
              {hasHours ? (
                <>
                  <p className="text-sm" style={{ color: BROWN }}>
                    {openLabel ?? "1:30 am – 5:00 pm"}
                  </p>
                  <p className="text-xs" style={{ color: `${MID}60` }}>1:00 am – 3:00 pm</p>
                </>
              ) : (
                <p className="text-sm" style={{ color: BROWN }}>1:30 am – 5:00 pm</p>
              )}
            </div>
          </div>

          {/* Social */}
          <div className="flex items-center gap-3">
            {settings?.facebook_url ? (
              <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center w-8 h-8 rounded-full border transition-colors hover:opacity-70"
                style={{ borderColor: `${BROWN}25`, color: MID }}>
                <Facebook className="w-3.5 h-3.5" />
              </a>
            ) : (
              <span className="flex items-center justify-center w-8 h-8 rounded-full border"
                style={{ borderColor: `${BROWN}15`, color: `${MID}50` }}>
                <Facebook className="w-3.5 h-3.5" />
              </span>
            )}
            {settings?.instagram_url ? (
              <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center w-8 h-8 rounded-full border transition-colors hover:opacity-70"
                style={{ borderColor: `${BROWN}25`, color: MID }}>
                <Instagram className="w-3.5 h-3.5" />
              </a>
            ) : (
              <span className="flex items-center justify-center w-8 h-8 rounded-full border"
                style={{ borderColor: `${BROWN}15`, color: `${MID}50` }}>
                <Instagram className="w-3.5 h-3.5" />
              </span>
            )}
            <span className="text-sm font-medium" style={{ color: MID }}>@Cup_&_Cozy</span>
          </div>

          {/* Reservations CTA */}
          <BookingCTAButton
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 shrink-0"
            style={{ background: TERRA }}
          >
            Reservations
          </BookingCTAButton>
        </motion.div>
      </section>

    </CafeLayout>
  );
}
