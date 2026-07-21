import { useRef } from "react";
import { Link } from "wouter";
import { MapPin, Phone, Mail, ExternalLink, ArrowRight, ArrowDown, Coffee, Star, Clock, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { usePublicGallery } from "@/hooks/usePublicGallery";
import { usePublicOffers } from "@/hooks/usePublicOffers";
import { usePublicReviews } from "@/hooks/usePublicReviews";
import { BookingCTAButton } from "@/contexts/BookingModalContext";
import { OpeningHoursEntry } from "@/types";
import { cn } from "@/lib/utils";

/* ── Brand palette ──────────────────────────────────────────────────────── */
const CREAM   = "#F2E8D5";
const BROWN   = "#3D1E0F";
const TERRA   = "#8B4A2B";
const MID     = "#6B3A2A";
const CARD_BG = "#FDFAF5";

/* ── Curated Unsplash photos ────────────────────────────────────────────── */
const HERO_PHOTOS = [
  {
    url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=900&q=85",
    label: "Our Interior",
    rotate: "-rotate-2",
    zIndex: "z-10",
    offset: "translate-x-0 translate-y-0",
  },
  {
    url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=700&q=85",
    label: "Our Shelves",
    rotate: "rotate-3",
    zIndex: "z-20",
    offset: "translate-x-28 -translate-y-20",
  },
  {
    url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=700&q=85",
    label: "Latte Art",
    rotate: "rotate-1",
    zIndex: "z-30",
    offset: "translate-x-16 translate-y-16",
  },
];

const FEATURE_CARDS = [
  {
    url: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=85",
    title: "Meet Our Local Partners: Rooted in Community",
    desc: "We work with trusted local farmers and producers to bring the freshest ingredients to your cup.",
    btnLabel: "Local Supplier",
    href: "/cafe/about",
  },
  {
    url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=85",
    title: "Seasonal Specialties",
    desc: "Come and discover our seasonal pastries and limited-edition coffee specials, crafted with love.",
    btnLabel: null,
    href: "/cafe/menu",
  },
  {
    url: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&q=85",
    title: "Explore Our Curated Collection",
    desc: "Browse our hand-picked selection of books, goods, and gifts available in-store.",
    btnLabel: "Explore Now",
    href: "/cafe/menu",
  },
];

const CURATED_GALLERY = [
  "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1200&q=85",
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900&q=85",
  "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=900&q=85",
  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=900&q=85",
  "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&q=85",
];

const COLLECTION_BG =
  "https://images.unsplash.com/photo-1493857671505-72967e2e2760?w=1200&q=85";

/* ── Animations ─────────────────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] } },
};
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.08, delayChildren: 0.02 } },
};

/* ── Helper components ──────────────────────────────────────────────────── */
function OpeningHoursCard({ hours }: { hours: OpeningHoursEntry[] }) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  return (
    <div className="divide-y" style={{ borderColor: `${BROWN}10` }}>
      {hours.map((entry) => {
        const isToday = entry.day === today;
        return (
          <div
            key={entry.day}
            className={cn("flex items-center justify-between py-3 text-sm", isToday ? "font-semibold" : "")}
          >
            <span style={{ color: isToday ? BROWN : `${MID}80` }}>{entry.day}</span>
            {entry.closed ? (
              <span style={{ color: `${MID}50` }} className="italic text-xs">Closed</span>
            ) : (
              <span style={{ color: isToday ? TERRA : `${MID}80` }}>
                {entry.open} – {entry.close}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export function CafePage() {
  const marqueeRef = useRef<HTMLDivElement>(null);
  const { data: cafe, isLoading: cafeLoading } = usePublicCafe();
  const { data: settings, isLoading: settingsLoading } = usePublicWebsiteSettings(cafe?.id);
  const { data: gallery } = usePublicGallery(cafe?.id);
  const { data: offers }  = usePublicOffers(cafe?.id);
  const { data: reviews } = usePublicReviews(cafe?.id);

  const isLoading  = cafeLoading || settingsLoading;
  const displayName = settings?.cafe_name ?? cafe?.name ?? "Cup & Cozy";
  const primaryColor = settings?.primary_color ?? TERRA;

  const galleryPhotos = (gallery ?? []).slice(0, 6);
  const mappedGallery = galleryPhotos.map((g) => ({ url: g.url, label: g.caption ?? g.alt_text ?? displayName }));
  const showcasePhotos =
    mappedGallery.length >= 3
      ? mappedGallery
      : [...mappedGallery, ...CURATED_GALLERY.map((u) => ({ url: u, label: "Our Café" }))].slice(0, 5);

  const previewOffers  = (offers ?? []).slice(0, 3);
  const previewReviews = (reviews ?? []).slice(0, 6);
  const avgRating =
    reviews && reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null;

  const directionsUrl = settings?.google_maps_url
    ?? (settings?.address ? `https://maps.google.com/?q=${encodeURIComponent(settings.address)}` : null);

  const hasHours = Array.isArray(settings?.opening_hours) && settings!.opening_hours.length > 0;

  const marqueeItems = ["Specialty Coffee", "Reserve Your Table", "Crafted with Care", "Est. 2024", "Artisan Roasts", "Community Café"];

  /* Loading */
  if (isLoading) {
    return (
      <CafeLayout cafeName="Loading…" primaryColor={primaryColor}>
        <div className="h-screen flex items-center justify-center" style={{ background: CREAM }}>
          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }}>
            <Heart className="w-10 h-10" style={{ color: TERRA }} />
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
    <>
      <style>{`
        @keyframes cafe-marquee-x {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .cafe-marquee { animation: cafe-marquee-x 38s linear infinite; }
        .cafe-marquee:hover { animation-play-state: paused; }
      `}</style>

      <CafeLayout
        cafeName={displayName}
        logoUrl={settings?.logo_url}
        primaryColor={primaryColor}
        settings={settings}
      >

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <section
          className="relative pt-[68px] overflow-hidden"
          style={{ background: CREAM, minHeight: "88svh" }}
        >
          <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-14 py-16 sm:py-20 lg:py-24 flex flex-col lg:flex-row items-center gap-12 lg:gap-8">

            {/* Left — text */}
            <motion.div
              className="flex-1 max-w-xl"
              initial="hidden"
              animate="show"
              variants={stagger}
            >
              <motion.h1
                variants={fadeUp}
                className="font-serif leading-[1.08] tracking-tight mb-5"
                style={{ color: BROWN, fontSize: "clamp(2.4rem, 5vw, 3.5rem)" }}
              >
                {settings?.hero_title ?? "A Haven for Coffee, Connection, and Calm"}
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="text-base leading-relaxed mb-9"
                style={{ color: MID, maxWidth: "38ch" }}
              >
                {settings?.hero_subtitle ??
                  "A community gathering place built on a local mission of friendship, coffee, connection, and calm."}
              </motion.p>

              <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
                <Link
                  href="/cafe/menu"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                  style={{ background: TERRA }}
                >
                  Explore Our Menu
                </Link>
                <BookingCTAButton
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg text-sm font-semibold border transition-all hover:opacity-80"
                  style={{ color: TERRA, borderColor: `${TERRA}60`, background: "transparent" }}
                >
                  Reserve a Table
                </BookingCTAButton>
              </motion.div>
            </motion.div>

            {/* Right — photo collage */}
            <div className="flex-1 flex items-center justify-center relative h-[420px] sm:h-[460px] lg:h-[500px] w-full lg:max-w-[520px]">
              {HERO_PHOTOS.map((photo, i) => (
                <motion.div
                  key={i}
                  className={cn("absolute w-[220px] sm:w-[260px] aspect-[4/3] rounded-sm overflow-hidden shadow-xl", photo.rotate, photo.zIndex, photo.offset)}
                  style={{
                    border: "8px solid #fff",
                    boxShadow: "0 8px 32px rgba(61,30,15,0.18)",
                  }}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 + i * 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  <img
                    src={photo.url}
                    alt={photo.label}
                    className="w-full h-full object-cover"
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── MARQUEE DIVIDER ────────────────────────────────────────────── */}
        <div
          className="overflow-hidden py-3.5 border-y"
          style={{ background: `${BROWN}08`, borderColor: `${BROWN}12` }}
        >
          <div ref={marqueeRef} className="flex cafe-marquee whitespace-nowrap" style={{ width: "max-content" }}>
            {[...marqueeItems, ...marqueeItems].map((item, i) => (
              <span key={i} className="inline-flex items-center gap-5 mr-10 text-xs font-semibold tracking-[0.16em]" style={{ color: `${MID}70` }}>
                {item}
                <span className="w-1 h-1 rounded-full shrink-0" style={{ background: TERRA }} />
              </span>
            ))}
          </div>
        </div>

        {/* ── OUR FEATURES + COLLECTION PANEL ──────────────────────────── */}
        <section style={{ background: CREAM }} className="py-16 sm:py-20 px-6 sm:px-10">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-8">

              {/* Left — Features cards */}
              <div className="flex-1">
                <motion.h2
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="font-serif text-2xl sm:text-3xl mb-7"
                  style={{ color: BROWN }}
                >
                  Our Features
                </motion.h2>

                <motion.div
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-40px" }}
                  variants={stagger}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                >
                  {FEATURE_CARDS.map((card, i) => (
                    <motion.div
                      key={i}
                      variants={fadeUp}
                      className="rounded-2xl overflow-hidden flex flex-col"
                      style={{
                        background: CARD_BG,
                        border: `1px solid ${BROWN}12`,
                        boxShadow: "0 2px 12px rgba(61,30,15,0.06)",
                      }}
                    >
                      {/* Image */}
                      <div className="h-36 overflow-hidden">
                        <img
                          src={card.url}
                          alt={card.title}
                          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                      {/* Body */}
                      <div className="p-4 flex flex-col flex-1">
                        <h3
                          className="font-serif text-[15px] leading-snug mb-2"
                          style={{ color: BROWN }}
                        >
                          {card.title}
                        </h3>
                        {i === 1 ? (
                          /* Dot indicators for seasonal card */
                          <div className="flex items-center gap-1.5 mt-auto pt-3">
                            <span className="w-2 h-2 rounded-full" style={{ background: TERRA }} />
                            <span className="w-2 h-2 rounded-full" style={{ background: `${TERRA}40` }} />
                            <span className="w-2 h-2 rounded-full" style={{ background: `${TERRA}40` }} />
                          </div>
                        ) : (
                          <>
                            <p className="text-xs leading-relaxed mb-3" style={{ color: `${MID}90` }}>{card.desc}</p>
                            {card.btnLabel && (
                              <Link
                                href={card.href}
                                className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs font-semibold text-white mt-auto transition-all hover:opacity-90"
                                style={{ background: TERRA }}
                              >
                                {card.btnLabel}
                              </Link>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </div>

              {/* Right — Curated Collection dark panel */}
              <motion.div
                className="lg:w-[340px] xl:w-[380px] rounded-2xl overflow-hidden relative flex-shrink-0"
                style={{ minHeight: 360 }}
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                <img
                  src={COLLECTION_BG}
                  alt="Our curated collection"
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(to top, rgba(10,5,3,0.90) 0%, rgba(10,5,3,0.50) 60%, rgba(10,5,3,0.25) 100%)" }}
                />
                <div className="relative z-10 h-full flex flex-col justify-end p-6 sm:p-8" style={{ minHeight: 360 }}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] mb-3" style={{ color: `${CREAM}90` }}>
                    Our Curated Collection
                  </p>
                  <h3 className="font-serif text-xl sm:text-2xl font-light text-white leading-snug mb-3">
                    A thoughtfully curated space for depth and discovery
                  </h3>
                  <p className="text-xs text-white/55 leading-relaxed mb-6">
                    Every corner of our café is arranged with care — books, goods, and quiet moments that invite you to slow down and stay a while.
                  </p>
                  <div className="flex items-center justify-between">
                    <Link
                      href="/cafe/gallery"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
                      style={{ color: `${CREAM}cc` }}
                    >
                      Explore <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <motion.div
                      animate={{ y: [0, 6, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <ArrowDown className="w-4 h-4 text-white/40" />
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── PHOTO GALLERY ──────────────────────────────────────────────── */}
        <section className="py-14 sm:py-20 px-6 sm:px-10" style={{ background: `${BROWN}06` }}>
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={stagger}
              className="flex items-end justify-between mb-7 sm:mb-10"
            >
              <div>
                <motion.p variants={fadeUp} className="text-[10px] font-semibold uppercase tracking-[0.24em] mb-2" style={{ color: TERRA }}>
                  Our Space
                </motion.p>
                <motion.h2 variants={fadeUp} className="font-serif text-2xl sm:text-3xl" style={{ color: BROWN }}>
                  {galleryPhotos.length > 0 ? "Gallery" : "The Experience"}
                </motion.h2>
              </div>
              {galleryPhotos.length > 0 && (
                <motion.div variants={fadeUp}>
                  <Link href="/cafe/gallery" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold hover:opacity-70 transition-opacity" style={{ color: TERRA }}>
                    View all <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </motion.div>
              )}
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-50px" }}
              variants={stagger}
              className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3"
            >
              {showcasePhotos.slice(0, 5).map((photo, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className={cn(
                    "relative rounded-xl overflow-hidden group cursor-pointer",
                    i === 0 ? "col-span-2 sm:col-span-1 sm:row-span-2 aspect-[16/9] sm:aspect-auto" :
                    i === 1 || i === 2 ? "aspect-[4/3]" : "aspect-square",
                  )}
                  style={{ border: `1px solid ${BROWN}10`, boxShadow: "0 2px 12px rgba(61,30,15,0.08)" }}
                >
                  <img
                    src={photo.url}
                    alt={photo.label}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300"
                    style={{ background: "linear-gradient(to top, rgba(61,30,15,0.80) 0%, transparent 100%)" }}
                  >
                    <p className="text-white text-xs font-medium tracking-wide">{photo.label}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── ABOUT ──────────────────────────────────────────────────────── */}
        <section className="py-16 sm:py-24 px-6 sm:px-10" style={{ background: CREAM }}>
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 sm:gap-16 items-center">
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} variants={stagger}>
              <motion.p variants={fadeUp} className="text-[10px] font-semibold uppercase tracking-[0.24em] mb-2" style={{ color: TERRA }}>
                Our Story
              </motion.p>
              <motion.div variants={fadeUp} className="w-10 h-0.5 mb-6" style={{ background: TERRA }} />
              <motion.h2 variants={fadeUp} className="font-serif text-2xl sm:text-3xl leading-tight mb-6" style={{ color: BROWN }}>
                {displayName}
              </motion.h2>
              <motion.div variants={fadeUp}>
                {settings?.about_content ? (
                  settings.about_content.split("\n").map((line, i) =>
                    line.trim() ? <p key={i} className="leading-relaxed mb-3.5 text-[15px]" style={{ color: MID }}>{line}</p> : null
                  )
                ) : (
                  <p className="leading-relaxed mb-3.5 text-[15px]" style={{ color: MID }}>
                    A sanctuary for coffee lovers — where exceptional beans meet thoughtful craft. Each cup is prepared with intention, each space designed for moments worth remembering.
                  </p>
                )}
              </motion.div>
              <motion.div variants={fadeUp} className="mt-7">
                <Link href="/cafe/about" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:opacity-70 transition-opacity" style={{ color: TERRA }}>
                  Read more <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="hidden lg:block relative"
            >
              <div
                className="w-full aspect-[4/3] rounded-2xl overflow-hidden"
                style={{ border: `1px solid ${BROWN}15`, boxShadow: "0 8px 40px rgba(61,30,15,0.12)" }}
              >
                <img
                  src="https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=900&q=85"
                  alt="Inside our café"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              {avgRating !== null && (
                <div
                  className="absolute bottom-5 left-5 flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
                  style={{ background: CREAM, border: `1px solid ${BROWN}18`, boxShadow: "0 4px 20px rgba(61,30,15,0.12)" }}
                >
                  <span className="font-serif text-2xl font-semibold" style={{ color: TERRA }}>{avgRating.toFixed(1)}</span>
                  <div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3 h-3`} style={{ color: i < Math.round(avgRating) ? TERRA : `${BROWN}25`, fill: i < Math.round(avgRating) ? TERRA : "none" }} />
                      ))}
                    </div>
                    <p className="text-[9px] tracking-[0.18em] uppercase mt-0.5" style={{ color: `${MID}60` }}>Guest Rating</p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </section>

        {/* ── OFFERS ─────────────────────────────────────────────────────── */}
        {previewOffers.length > 0 && (
          <section className="py-14 sm:py-20 px-6 sm:px-10" style={{ background: `${BROWN}06` }}>
            <div className="max-w-7xl mx-auto">
              <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}
                className="flex items-end justify-between mb-7 sm:mb-10">
                <div>
                  <motion.div variants={fadeUp}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] mb-2" style={{ color: TERRA }}>Deals & Promotions</p>
                  </motion.div>
                  <motion.h2 variants={fadeUp} className="font-serif text-2xl sm:text-3xl" style={{ color: BROWN }}>Current Offers</motion.h2>
                </div>
                <motion.div variants={fadeUp}>
                  <Link href="/cafe/offers" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold hover:opacity-70 transition-opacity" style={{ color: TERRA }}>
                    View all <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </motion.div>
              </motion.div>

              <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-50px" }} variants={stagger}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {previewOffers.map((offer) => (
                  <motion.div key={offer.id} variants={fadeUp}
                    className="rounded-2xl border overflow-hidden group transition-all duration-300"
                    style={{ background: CARD_BG, borderColor: `${BROWN}12`, boxShadow: "0 2px 12px rgba(61,30,15,0.06)" }}>
                    {offer.image_url ? (
                      <div className="h-36 sm:h-40 overflow-hidden">
                        <img src={offer.image_url} alt={offer.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                      </div>
                    ) : (
                      <div className="h-1 rounded-t-2xl" style={{ background: TERRA }} />
                    )}
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-serif text-sm leading-snug" style={{ color: BROWN }}>{offer.title}</h3>
                        {offer.discount_value && (
                          <span className="shrink-0 text-xs font-bold text-white px-2.5 py-1 rounded-full" style={{ background: TERRA }}>
                            {offer.discount_type === "percentage" ? `${offer.discount_value}% OFF` : `₹${offer.discount_value} OFF`}
                          </span>
                        )}
                      </div>
                      {offer.description && <p className="text-xs line-clamp-2" style={{ color: `${MID}80` }}>{offer.description}</p>}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>
        )}

        {/* ── REVIEWS ────────────────────────────────────────────────────── */}
        {previewReviews.length > 0 && (
          <section className="py-14 sm:py-20 overflow-hidden" style={{ background: CREAM }}>
            <div className="max-w-7xl mx-auto px-6 sm:px-10 mb-8 sm:mb-12">
              <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}
                className="flex items-end justify-between">
                <div>
                  <motion.div variants={fadeUp}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] mb-2" style={{ color: TERRA }}>What People Say</p>
                  </motion.div>
                  <motion.h2 variants={fadeUp} className="font-serif text-2xl sm:text-3xl" style={{ color: BROWN }}>
                    Guest Reviews
                    {avgRating !== null && (
                      <span className="ml-3 text-lg sm:text-xl font-normal" style={{ color: TERRA }}>★ {avgRating.toFixed(1)}</span>
                    )}
                  </motion.h2>
                </div>
                <motion.div variants={fadeUp}>
                  <Link href="/cafe/reviews" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold hover:opacity-70 transition-opacity" style={{ color: TERRA }}>
                    All reviews <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </motion.div>
              </motion.div>
            </div>

            <div className="flex cafe-marquee" style={{ width: "max-content" }}>
              {[...previewReviews, ...previewReviews].map((review, i) => (
                <div
                  key={i}
                  className="shrink-0 w-[300px] sm:w-[340px] mx-3 sm:mx-4 rounded-2xl p-5 border"
                  style={{ background: CARD_BG, borderColor: `${BROWN}12`, boxShadow: "0 2px 12px rgba(61,30,15,0.06)" }}
                >
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="w-3 h-3" style={{ color: j < review.rating ? TERRA : `${BROWN}25`, fill: j < review.rating ? TERRA : "none" }} />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed line-clamp-3 mb-4" style={{ color: `${MID}90` }}>"{review.content}"</p>
                  <p className="text-xs font-semibold" style={{ color: `${MID}60` }}>{review.name}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── HOURS + CONTACT ────────────────────────────────────────────── */}
        <section className="py-14 sm:py-20 px-6 sm:px-10" style={{ background: `${BROWN}06` }}>
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-12">
            {hasHours && (
              <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
                <motion.div variants={fadeUp}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] mb-2" style={{ color: TERRA }}>When We're Open</p>
                  <div className="w-10 h-0.5 mb-5" style={{ background: TERRA }} />
                  <h2 className="text-xl sm:text-2xl font-serif mb-5" style={{ color: BROWN }}>Opening Hours</h2>
                </motion.div>
                <motion.div
                  variants={fadeUp}
                  className="rounded-2xl p-5 sm:p-6 border"
                  style={{ background: CARD_BG, borderColor: `${BROWN}10`, boxShadow: "0 2px 12px rgba(61,30,15,0.06)" }}
                >
                  <OpeningHoursCard hours={settings!.opening_hours} />
                </motion.div>
              </motion.div>
            )}

            <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
              <motion.div variants={fadeUp}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] mb-2" style={{ color: TERRA }}>Where To Find Us</p>
                <div className="w-10 h-0.5 mb-5" style={{ background: TERRA }} />
                <h2 className="text-xl sm:text-2xl font-serif mb-5" style={{ color: BROWN }}>Find Us</h2>
              </motion.div>
              <motion.div variants={fadeUp} className="space-y-4">
                {settings?.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: TERRA }} />
                    <div>
                      <p className="text-sm leading-relaxed" style={{ color: MID }}>{settings.address}</p>
                      {settings.google_maps_url && (
                        <a href={settings.google_maps_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold mt-1.5 hover:opacity-70 transition-opacity" style={{ color: TERRA }}>
                          Open in Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {settings?.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 shrink-0" style={{ color: TERRA }} />
                    <a href={`tel:${settings.phone}`} className="text-sm hover:opacity-70 transition-opacity" style={{ color: MID }}>{settings.phone}</a>
                  </div>
                )}
                {settings?.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 shrink-0" style={{ color: TERRA }} />
                    <a href={`mailto:${settings.email}`} className="text-sm hover:opacity-70 transition-opacity" style={{ color: MID }}>{settings.email}</a>
                  </div>
                )}
                {!settings?.address && !settings?.phone && !settings?.email && (
                  <p className="text-sm" style={{ color: `${MID}50` }}>Contact details coming soon.</p>
                )}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── BOTTOM CTA ─────────────────────────────────────────────────── */}
        <section
          className="relative py-24 sm:py-32 px-6 sm:px-10 text-center overflow-hidden"
          style={{ background: BROWN }}
        >
          {/* subtle texture */}
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 30% 50%, #C9A46C 0%, transparent 60%)" }} />
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
            className="relative z-10 max-w-2xl mx-auto"
          >
            <motion.p variants={fadeUp} className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-4" style={{ color: `${CREAM}70` }}>
              Reserve Your Experience
            </motion.p>
            <motion.div variants={fadeUp} className="w-10 h-0.5 mx-auto mb-7" style={{ background: TERRA }} />
            <motion.h2 variants={fadeUp} className="font-serif text-3xl sm:text-4xl lg:text-5xl font-light text-white tracking-tight mb-3">
              {displayName}
            </motion.h2>
            <motion.p variants={fadeUp} className="mb-10 font-light text-sm" style={{ color: `${CREAM}60` }}>
              {settings?.tagline ?? "A table awaits you."}
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/cafe/menu"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: TERRA }}
              >
                Browse Menu <ArrowRight className="w-4 h-4" />
              </Link>
              <BookingCTAButton
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg text-sm font-semibold border transition-all hover:opacity-80"
                style={{ color: `${CREAM}dd`, borderColor: `${CREAM}30` }}
              >
                Reserve a Table
              </BookingCTAButton>
            </motion.div>
          </motion.div>
        </section>

      </CafeLayout>
    </>
  );
}
