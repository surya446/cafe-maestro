import { Link } from "wouter";
import { ArrowRight, MapPin, Phone, Clock, Instagram, Coffee } from "lucide-react";
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

/* ── Photo manifest — each real Cup & Cozy photograph, used individually ── */
const PHOTOS = {
  // Hero — café interior, full-screen background
  hero:       "/admin/cafe-hero.png",
  // Iced Hazelnut Velvet — signature drink
  coffee:     "/admin/cafe-crafted.png",
  // Gallery wall with framed art prints
  artwall:    "/admin/cafe-artwall.png",
  // Geometric diamond pendant light, warm amber glow
  pendant:    "/admin/cafe-pendant.png",
  // Orbital ring light installation
  ringlight:  "/admin/cafe-ringlight.png",
  // Interior seating — arch alcove, ring lights, white lattice chairs
  seating:    "/admin/cafe-seating.png",
  // Bookshelf wall — white shelves, curated books, trailing ivy
  bookshelf:  "/admin/cafe-curated.png",
  // Full interior — staircase, counter, warm wood tones
  staircase:  "/admin/cafe-staircase.png",
  // Dining area with natural light
  dining:     "/admin/cafe-contact.png",
};

/* ── Shared animation presets ───────────────────────────────────────────── */
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

  /* ── Loading ─────────────────────────────────────────────────────────── */
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
          §1  HERO — full-viewport café interior, editorial typography
      ══════════════════════════════════════════════════════════════════ */}
      <section
        className="relative w-full overflow-hidden"
        style={{ height: "100svh", minHeight: 600 }}
        aria-label="Hero"
      >
        {/* Background photograph — slow Ken-Burns zoom */}
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

        {/* Layered overlay — keeps text readable without crushing the photo */}
        <div
          className="absolute inset-0"
          style={{
            background: [
              "linear-gradient(to bottom,",
              "  rgba(20,10,5,0.30) 0%,",
              "  rgba(20,10,5,0.12) 38%,",
              "  rgba(20,10,5,0.18) 62%,",
              "  rgba(20,10,5,0.54) 100%)",
            ].join(" "),
          }}
        />

        {/* Centered editorial text */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="flex flex-col items-center gap-6"
          >
            {/* Pre-title tag */}
            <motion.p
              variants={fadeUp}
              className="text-[10px] sm:text-xs font-semibold tracking-[0.30em] uppercase text-white/60"
            >
              Meringrice · Est. 2023
            </motion.p>

            {/* Main headline */}
            <motion.h1
              variants={fadeUp}
              className="font-serif text-white leading-[1.05] tracking-tight"
              style={{
                fontSize: "clamp(2.8rem, 7.5vw, 5.5rem)",
                textShadow: "0 4px 32px rgba(0,0,0,0.35)",
              }}
            >
              {displayName}
            </motion.h1>

            {/* Tagline */}
            <motion.p
              variants={fadeUp}
              className="font-serif italic text-white/75 leading-snug max-w-xs sm:max-w-md"
              style={{ fontSize: "clamp(1.05rem, 2.4vw, 1.4rem)" }}
            >
              Curated coffee.
              <br />
              Curated conversations.
            </motion.p>

            {/* Thin rule */}
            <motion.div
              variants={fadeUp}
              className="w-12 h-px"
              style={{ background: "rgba(255,255,255,0.35)" }}
            />

            {/* CTA buttons */}
            <motion.div
              variants={fadeUp}
              className="flex flex-col sm:flex-row items-center gap-3 mt-1"
            >
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
                style={{
                  background: TERRA,
                  color: "#fff",
                  letterSpacing: "0.08em",
                }}
              >
                Reserve a Table
              </BookingCTAButton>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll indicator — animated line */}
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
          §2  CURATED CORNERS — editorial photo gallery, each image separate
      ══════════════════════════════════════════════════════════════════ */}
      <section
        className="w-full py-24 sm:py-32"
        style={{ background: CREAM }}
        aria-label="Curated Corners"
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-10">

          {/* Section header */}
          <motion.div
            className="mb-16 sm:mb-20"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={stagger}
          >
            <motion.p
              variants={fadeUp}
              className="text-[10px] font-semibold tracking-[0.28em] uppercase mb-3"
              style={{ color: `${TERRA}99` }}
            >
              The Vibe
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="font-serif leading-none mb-5"
              style={{ fontSize: "clamp(2.2rem, 5vw, 3.8rem)", color: BROWN }}
            >
              Curated Corners
            </motion.h2>
            <motion.div variants={fadeUp} className="w-10 h-px" style={{ background: `${TERRA}60` }} />
          </motion.div>

          {/* ── Editorial grid ──────────────────────────────────────────── */}
          {/*
            Layout intent (desktop):
              [ SEATING — tall, 2 rows ]  [ ARTWALL ]       [ PENDANT  ]
                                          [ COFFEE  ]       [ RINGLIGHT]
                                          [ BOOKSHELF — wide, 2 cols ]
              [ STAIRCASE — wide, 2 cols ]                  [ DINING   ]
          */}

          {/* Row 1: seating (tall) + artwall + pendant/ringlight stack */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-4 sm:mb-5">

            {/* Seating — tall, spans 2 rows on lg */}
            <GalleryPhoto
              src={PHOTOS.seating}
              alt="Interior seating — arch alcove with orbital lights"
              caption="The Alcove"
              className="sm:row-span-2 lg:row-span-2"
              aspectLg="aspect-[9/16]"
              aspect="aspect-[4/3]"
            />

            {/* Artwall */}
            <GalleryPhoto
              src={PHOTOS.artwall}
              alt="Gallery wall — framed art prints above the staircase"
              caption="Gallery Wall"
              aspect="aspect-[4/3]"
              aspectLg="aspect-[4/3]"
            />

            {/* Coffee */}
            <GalleryPhoto
              src={PHOTOS.coffee}
              alt="Signature Hazelnut Velvet iced coffee"
              caption="Signature Hazelnut Velvet"
              aspect="aspect-[4/3]"
              aspectLg="aspect-[4/3]"
            />
          </div>

          {/* Row 2: bookshelf (wide) + pendant + ringlight */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-5 mb-4 sm:mb-5">

            {/* Bookshelf — wide */}
            <div className="lg:col-span-5">
              <GalleryPhoto
                src={PHOTOS.bookshelf}
                alt="Curated bookshelf with trailing ivy"
                caption="Bookshelf Corner"
                aspect="aspect-[4/3]"
                aspectLg="aspect-[4/3]"
              />
            </div>

            {/* Pendant */}
            <div className="lg:col-span-3">
              <GalleryPhoto
                src={PHOTOS.pendant}
                alt="Geometric diamond pendant light, warm amber"
                caption="The Pendant"
                aspect="aspect-square"
                aspectLg="aspect-square"
              />
            </div>

            {/* Ring light */}
            <div className="lg:col-span-4">
              <GalleryPhoto
                src={PHOTOS.ringlight}
                alt="Orbital ring light installation"
                caption="Ring Light"
                aspect="aspect-square"
                aspectLg="aspect-square"
              />
            </div>
          </div>

          {/* Row 3: staircase (wide) + dining */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5">

            {/* Staircase — wide */}
            <div className="lg:col-span-3">
              <GalleryPhoto
                src={PHOTOS.staircase}
                alt="Interior — staircase, counter, warm wood tones"
                caption="The Space"
                aspect="aspect-[4/3]"
                aspectLg="aspect-[16/9]"
              />
            </div>

            {/* Dining */}
            <div className="lg:col-span-2">
              <GalleryPhoto
                src={PHOTOS.dining}
                alt="Dining area with natural light"
                caption="Dining Room"
                aspect="aspect-[4/3]"
                aspectLg="aspect-[4/3]"
              />
            </div>
          </div>

          {/* Reservation nudge */}
          <motion.div
            className="mt-14 sm:mt-16 text-center"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <p className="font-serif text-lg sm:text-xl mb-6" style={{ color: MID }}>
              Come find your corner.
            </p>
            <BookingCTAButton
              className="inline-flex items-center gap-2.5 px-10 py-4 text-[13px] font-semibold text-white rounded-sm transition-all hover:opacity-90 active:scale-95"
              style={{ background: BROWN, letterSpacing: "0.08em" }}
            >
              Reserve Your Table <ArrowRight className="w-4 h-4" />
            </BookingCTAButton>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          §3  CONTACT / FOOTER SECTION — warm editorial info bar
      ══════════════════════════════════════════════════════════════════ */}
      <section
        style={{ background: BROWN }}
        aria-label="Contact and location"
      >
        {/* Top accent line */}
        <div className="w-full h-px" style={{ background: `${TERRA}55` }} />

        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-16 sm:py-20">
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 sm:gap-12"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
          >

            {/* Brand + tagline */}
            <motion.div variants={fadeUp} className="lg:col-span-1">
              <p className="font-serif text-2xl text-white mb-2">{displayName}</p>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.40)" }}>
                Your daily retreat of curated flavors and curated corners.
              </p>
            </motion.div>

            {/* Address */}
            <motion.div variants={fadeUp}>
              <p className="text-[10px] font-semibold tracking-[0.22em] uppercase mb-4" style={{ color: `${TERRA}bb` }}>
                Address
              </p>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: `${TERRA}90` }} />
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                  {settings?.address ?? "Roconomarch Road, Meringrice, ia 28312 Calerod"}
                </p>
              </div>
            </motion.div>

            {/* Opening hours */}
            <motion.div variants={fadeUp}>
              <p className="text-[10px] font-semibold tracking-[0.22em] uppercase mb-4" style={{ color: `${TERRA}bb` }}>
                Opening Hours
              </p>
              <div className="flex items-start gap-2.5">
                <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: `${TERRA}90` }} />
                <div>
                  {hasHours && openLabel ? (
                    <>
                      <p className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>{openLabel}</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Today</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>1:30 pm – 5:00 pm</p>
                      <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>1:00 pm – 5:90 pm</p>
                    </>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Social + CTA */}
            <motion.div variants={fadeUp} className="flex flex-col gap-5">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.22em] uppercase mb-4" style={{ color: `${TERRA}bb` }}>
                  Connect
                </p>
                <div className="flex items-center gap-3 mb-3">
                  {settings?.instagram_url ? (
                    <a
                      href={settings.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
                      style={{ color: "rgba(255,255,255,0.60)" }}
                    >
                      <Instagram className="w-4 h-4" />
                      @Cup & Cozy
                    </a>
                  ) : (
                    <span className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.40)" }}>
                      <Instagram className="w-4 h-4" />
                      @Cup_&_Cozy
                    </span>
                  )}
                </div>
                {settings?.phone && (
                  <a
                    href={`tel:${settings.phone}`}
                    className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
                    style={{ color: "rgba(255,255,255,0.50)" }}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {settings.phone}
                  </a>
                )}
              </div>
              <BookingCTAButton
                className="inline-flex items-center justify-center gap-2 px-7 py-3 text-[12px] font-semibold rounded-sm transition-all hover:opacity-90 active:scale-95 self-start"
                style={{ background: TERRA, color: "#fff", letterSpacing: "0.08em" }}
              >
                Reservations
              </BookingCTAButton>
            </motion.div>
          </motion.div>

          {/* Divider */}
          <div className="mt-14 mb-6 w-full h-px" style={{ background: "rgba(255,255,255,0.08)" }} />

          {/* Copyright row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>
              © {new Date().getFullYear()} {displayName}. All rights reserved.
            </p>
            <Link
              href="/cafe/menu"
              className="text-[11px] flex items-center gap-1 transition-opacity hover:opacity-60"
              style={{ color: "rgba(255,255,255,0.30)" }}
            >
              View Menu <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </section>

    </CafeLayout>
  );
}

/* ── GalleryPhoto — reusable editorial photo tile ───────────────────────── */
interface GalleryPhotoProps {
  src: string;
  alt: string;
  caption: string;
  aspect?: string;
  aspectLg?: string;
  className?: string;
}

function GalleryPhoto({ src, alt, caption, aspect = "aspect-[4/3]", aspectLg, className = "" }: GalleryPhotoProps) {
  return (
    <motion.figure
      className={`relative group overflow-hidden ${aspect} ${className}`}
      style={{ background: `${BROWN}12` }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* When lg breakpoint applies a different aspect, use inline override via CSS var */}
      {aspectLg && (
        <style>{`
          @media (min-width: 1024px) {
            .lg-aspect-override-${caption.replace(/\s+/g, '-').toLowerCase()} {
              aspect-ratio: ${aspectLg.replace('aspect-[', '').replace(']', '').replace('aspect-', '')};
            }
          }
        `}</style>
      )}

      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
      />

      {/* Hover caption overlay */}
      <figcaption
        className="absolute inset-0 flex items-end p-5 opacity-0 group-hover:opacity-100 transition-opacity duration-400"
        style={{
          background: "linear-gradient(to top, rgba(20,10,5,0.72) 0%, rgba(20,10,5,0) 55%)",
        }}
      >
        <span
          className="text-xs font-semibold tracking-[0.16em] uppercase text-white/90"
        >
          {caption}
        </span>
      </figcaption>
    </motion.figure>
  );
}
