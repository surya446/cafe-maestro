import { useRef } from "react";
import { Link } from "wouter";
import { MapPin, Phone, Mail, ExternalLink, ArrowRight, Coffee, Star } from "lucide-react";
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

const GOLD = "#C9A46C";

/* ── Curated high-quality café photographs (Unsplash, stable IDs) ─────────── */
const CURATED = [
  {
    url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1200&q=85",
    label: "Our Interior",
  },
  {
    url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900&q=85",
    label: "The Pour",
  },
  {
    url: "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=900&q=85",
    label: "Behind the Bar",
  },
  {
    url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=900&q=85",
    label: "Latte Art",
  },
  {
    url: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&q=85",
    label: "The Atmosphere",
  },
];

/* atmosphere banner bg — a warm café shot */
const ATMOSPHERE_BG =
  "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=1600&q=85";

/* about-panel image */
const ABOUT_IMG =
  "https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=900&q=85";

/* bottom CTA bg */
const CTA_BG =
  "https://images.unsplash.com/photo-1600093463592-8e36ae95ef56?w=1600&q=85";

/* ── Animation variants ─────────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
};

/* ── Small shared components ─────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-3.5" style={{ color: GOLD }}>
      {children}
    </p>
  );
}

function GoldRule({ className }: { className?: string }) {
  return <div className={cn("w-10 h-px mb-7", className)} style={{ background: GOLD }} />;
}

function HeroWordSplit({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.3 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block mr-[0.22em]"
        >
          {word}
        </motion.span>
      ))}
    </>
  );
}

function OpeningHoursCard({ hours }: { hours: OpeningHoursEntry[] }) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  return (
    <div className="divide-y divide-white/[0.05]">
      {hours.map((entry) => {
        const isToday = entry.day === today;
        return (
          <div
            key={entry.day}
            className={cn("flex items-center justify-between py-3 text-sm", isToday ? "font-semibold" : "")}
          >
            <span className={cn("w-28", isToday ? "text-white" : "text-white/40")}>{entry.day}</span>
            {entry.closed ? (
              <span className="text-white/20 italic text-xs">Closed</span>
            ) : (
              <span style={isToday ? { color: GOLD } : {}} className={isToday ? "" : "text-white/40"}>
                {entry.open} – {entry.close}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */
export function CafePage() {
  const marqueeRef = useRef<HTMLDivElement>(null);
  const { data: cafe, isLoading: cafeLoading } = usePublicCafe();
  const { data: settings, isLoading: settingsLoading } = usePublicWebsiteSettings(cafe?.id);
  const { data: gallery } = usePublicGallery(cafe?.id);
  const { data: offers } = usePublicOffers(cafe?.id);
  const { data: reviews } = usePublicReviews(cafe?.id);

  const isLoading = cafeLoading || settingsLoading;
  const displayName = settings?.cafe_name ?? cafe?.name ?? "Our Cafe";
  const primaryColor = settings?.primary_color ?? "#1a1a1a";
  const hasHours = Array.isArray(settings?.opening_hours) && settings!.opening_hours.length > 0;

  /* Gallery: prefer real photos; supplement with curated when fewer than 3 */
  const galleryPhotos = (gallery ?? []).slice(0, 6);
  const mappedGallery = galleryPhotos.map((g) => ({ url: g.url, label: g.caption ?? g.alt_text ?? displayName }));
  const showcasePhotos =
    mappedGallery.length >= 3
      ? mappedGallery
      : [...mappedGallery, ...CURATED].slice(0, 5);

  const previewOffers = (offers ?? []).slice(0, 3);
  const previewReviews = (reviews ?? []).slice(0, 6);
  const avgRating =
    reviews && reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null;

  const marqueeItems = ["Specialty Coffee", "Reserve Your Table", "Crafted with Care", "Est. 2024", "Artisan Roasts", "Fine Dining Experience"];

  if (isLoading) {
    return (
      <CafeLayout cafeName="Loading…" primaryColor={primaryColor}>
        <div className="h-screen flex items-center justify-center" style={{ background: "#050505" }}>
          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }}>
            <Coffee className="w-10 h-10" style={{ color: GOLD }} />
          </motion.div>
        </div>
      </CafeLayout>
    );
  }

  if (!cafe) {
    return (
      <CafeLayout cafeName="Cafe" primaryColor={primaryColor}>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ background: "#050505" }}>
          <Coffee className="w-14 h-14" style={{ color: GOLD }} />
          <p className="text-white/35 text-base font-light">Coming soon</p>
        </div>
      </CafeLayout>
    );
  }

  return (
    <>
      <style>{`
        @keyframes cafe-marquee-x {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .cafe-marquee { animation: cafe-marquee-x 35s linear infinite; }
        .cafe-marquee:hover { animation-play-state: paused; }
      `}</style>

      <CafeLayout
        cafeName={displayName}
        logoUrl={settings?.logo_url}
        primaryColor={primaryColor}
        settings={settings}
      >

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section
          className="relative flex flex-col justify-end overflow-hidden"
          style={{ background: "#050505", height: "88svh", minHeight: 520, maxHeight: 900 }}
        >
          {settings?.hero_image_url ? (
            <>
              <motion.img
                src={settings.hero_image_url}
                alt="Hero"
                className="absolute inset-0 w-full h-full object-cover"
                initial={{ scale: 1.08, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, #050505 0%, rgba(5,5,5,0.60) 40%, rgba(5,5,5,0.10) 100%)",
                }}
              />
            </>
          ) : (
            <>
              {/* Fallback: use a curated hero image so it never looks empty */}
              <motion.img
                src={CURATED[0].url}
                alt="Café atmosphere"
                className="absolute inset-0 w-full h-full object-cover"
                initial={{ scale: 1.06, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.55 }}
                transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, rgba(5,5,5,0.92) 0%, rgba(5,5,5,0.60) 50%, rgba(5,5,5,0.80) 100%)`,
                }}
              />
              {/* warm accent glow */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse at 15% 60%, ${primaryColor}28 0%, transparent 55%)`,
                }}
              />
            </>
          )}

          {/* Content — editorial bottom-left */}
          <div className="relative z-10 px-5 sm:px-12 lg:px-20 pb-12 sm:pb-20 max-w-4xl">
            {settings?.tagline && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.8 }}
                className="text-[11px] font-semibold uppercase tracking-[0.3em] mb-5"
                style={{ color: GOLD }}
              >
                {settings.tagline}
              </motion.p>
            )}
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-7xl xl:text-8xl font-light text-white leading-[1.03] tracking-tight overflow-hidden">
              <HeroWordSplit text={settings?.hero_title ?? displayName} />
            </h1>
            {settings?.hero_subtitle && (
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.7 }}
                className="mt-4 text-sm sm:text-base text-white/50 font-light max-w-lg"
              >
                {settings.hero_subtitle}
              </motion.p>
            )}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1, duration: 0.7 }}
              className="mt-7 sm:mt-9 flex flex-wrap items-center gap-3"
            >
              <Link
                href="/cafe/menu"
                className="inline-flex items-center gap-2 px-6 sm:px-7 py-3 sm:py-3.5 rounded-full text-sm font-semibold text-[#050505] transition-all hover:opacity-90 active:scale-95"
                style={{ background: GOLD }}
              >
                View Menu <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <BookingCTAButton className="inline-flex items-center gap-2 px-6 sm:px-7 py-3 sm:py-3.5 rounded-full text-sm font-semibold text-white border border-white/20 hover:bg-white/[0.08] transition-colors">
                Book a Table
              </BookingCTAButton>
            </motion.div>
          </div>

          {/* scroll nudge */}
          <motion.div
            className="absolute bottom-5 right-6 flex flex-col items-center gap-1.5 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8, duration: 0.8 }}
          >
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              className="w-px h-10 rounded-full"
              style={{ background: `linear-gradient(to bottom, ${GOLD}00, ${GOLD}90)` }}
            />
          </motion.div>
        </section>

        {/* ── MARQUEE DIVIDER ───────────────────────────────────────────── */}
        <div
          className="overflow-hidden py-4 sm:py-5 border-y border-white/[0.05]"
          style={{ background: "#0A0A0A" }}
        >
          <div ref={marqueeRef} className="flex cafe-marquee whitespace-nowrap" style={{ width: "max-content" }}>
            {[...marqueeItems, ...marqueeItems].map((item, i) => (
              <span key={i} className="inline-flex items-center gap-5 mr-10 text-xs sm:text-sm font-light tracking-[0.1em] text-white/20">
                {item}
                <span className="w-1 h-1 rounded-full shrink-0" style={{ background: GOLD }} />
              </span>
            ))}
          </div>
        </div>

        {/* ── PHOTO SHOWCASE ────────────────────────────────────────────── */}
        <section className="py-14 sm:py-20 px-4 sm:px-6" style={{ background: "#080808" }}>
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={stagger}
              className="flex items-end justify-between mb-7 sm:mb-10"
            >
              <div>
                <motion.div variants={fadeUp}><SectionLabel>Our Space</SectionLabel></motion.div>
                <motion.h2 variants={fadeUp} className="font-serif text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight">
                  {galleryPhotos.length > 0 ? "Gallery" : "The Experience"}
                </motion.h2>
              </div>
              {galleryPhotos.length > 0 && (
                <motion.div variants={fadeUp}>
                  <Link href="/cafe/gallery" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: GOLD }}>
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
              className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3"
            >
              {showcasePhotos.slice(0, 5).map((photo, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className={cn(
                    "relative rounded-xl overflow-hidden group cursor-pointer",
                    i === 0
                      ? "col-span-2 sm:col-span-1 sm:row-span-2 aspect-[16/9] sm:aspect-auto"
                      : i === 1 || i === 2
                      ? "aspect-[4/3]"
                      : "aspect-square",
                  )}
                  style={{ border: "1px solid rgba(201,164,108,0.07)" }}
                >
                  <img
                    src={photo.url}
                    alt={photo.label}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-300" />
                  <div
                    className="absolute inset-x-0 bottom-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300"
                    style={{ background: "linear-gradient(to top, rgba(5,5,5,0.85) 0%, transparent 100%)" }}
                  >
                    <p className="text-white text-xs font-medium tracking-wide">{photo.label}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── ATMOSPHERE BANNER ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden" style={{ height: "44vh", minHeight: 240, maxHeight: 500 }}>
          <img
            src={ATMOSPHERE_BG}
            alt="Café atmosphere"
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to right, rgba(5,5,5,0.92) 0%, rgba(5,5,5,0.50) 50%, rgba(5,5,5,0.20) 100%)" }}
          />
          <motion.div
            className="relative z-10 h-full flex flex-col justify-center px-6 sm:px-12 lg:px-20 max-w-2xl"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] mb-4" style={{ color: GOLD }}>
              Crafted with Care
            </p>
            <p className="font-serif text-2xl sm:text-3xl lg:text-4xl font-light text-white leading-snug tracking-tight">
              "Where every sip<br />becomes a moment."
            </p>
            <div className="w-8 h-px mt-6" style={{ background: GOLD }} />
          </motion.div>
        </section>

        {/* ── ABOUT ─────────────────────────────────────────────────────── */}
        <section className="py-16 sm:py-24 px-4 sm:px-6" style={{ background: "#0B0B0B" }}>
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-16 items-center">
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} variants={stagger}>
              <motion.div variants={fadeUp}>
                <SectionLabel>Our Story</SectionLabel>
                <GoldRule />
              </motion.div>
              <motion.h2 variants={fadeUp} className="font-serif text-2xl sm:text-3xl lg:text-4xl font-light text-white leading-tight tracking-tight mb-6">
                {displayName}
              </motion.h2>
              <motion.div variants={fadeUp}>
                {settings?.about_content ? (
                  settings.about_content.split("\n").map((line, i) =>
                    line.trim() ? <p key={i} className="text-white/45 leading-relaxed mb-3.5 text-[15px]">{line}</p> : null
                  )
                ) : (
                  <p className="text-white/45 leading-relaxed mb-3.5 text-[15px]">
                    A sanctuary for coffee lovers — where exceptional beans meet thoughtful craft. Each cup is prepared with intention, each space designed for moments worth remembering.
                  </p>
                )}
              </motion.div>
              <motion.div variants={fadeUp} className="mt-7">
                <Link href="/cafe/about" className="inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: GOLD }}>
                  Read more <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </motion.div>
            </motion.div>

            {/* Right — image panel with optional rating badge */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="hidden lg:block relative"
            >
              <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(201,164,108,0.1)" }}>
                <img
                  src={ABOUT_IMG}
                  alt="Inside our café"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 rounded-2xl" style={{ background: "linear-gradient(to top, rgba(5,5,5,0.55) 0%, transparent 60%)" }} />
              </div>
              {avgRating !== null && (
                <div
                  className="absolute bottom-5 left-5 flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
                  style={{ background: "rgba(5,5,5,0.88)", border: "1px solid rgba(201,164,108,0.2)" }}
                >
                  <span className="font-serif text-2xl font-light" style={{ color: GOLD }}>{avgRating.toFixed(1)}</span>
                  <div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < Math.round(avgRating) ? "fill-[#C9A46C] text-[#C9A46C]" : "text-white/15"}`} />
                      ))}
                    </div>
                    <p className="text-[9px] tracking-[0.18em] uppercase text-white/30 mt-0.5">Guest Rating</p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </section>

        {/* ── OFFERS ────────────────────────────────────────────────────── */}
        {previewOffers.length > 0 && (
          <section className="py-14 sm:py-24 px-4 sm:px-6" style={{ background: "#0B0B0B" }}>
            <div className="max-w-6xl mx-auto">
              <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}
                className="flex items-end justify-between mb-7 sm:mb-10">
                <div>
                  <motion.div variants={fadeUp}><SectionLabel>Deals & Promotions</SectionLabel></motion.div>
                  <motion.h2 variants={fadeUp} className="font-serif text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight">Current Offers</motion.h2>
                </div>
                <motion.div variants={fadeUp}>
                  <Link href="/cafe/offers" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: GOLD }}>
                    View all <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </motion.div>
              </motion.div>

              <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-50px" }} variants={stagger}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {previewOffers.map((offer) => (
                  <motion.div key={offer.id} variants={fadeUp}
                    className="rounded-2xl border overflow-hidden group transition-all duration-300 hover:border-[#C9A46C]/30"
                    style={{ background: "#171717", borderColor: "rgba(201,164,108,0.1)" }}>
                    {offer.image_url ? (
                      <div className="h-36 sm:h-40 overflow-hidden">
                        <img src={offer.image_url} alt={offer.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                      </div>
                    ) : (
                      <div className="h-1 rounded-t-2xl" style={{ background: GOLD }} />
                    )}
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-white text-sm leading-snug">{offer.title}</h3>
                        {offer.discount_value && (
                          <span className="shrink-0 text-xs font-bold text-[#050505] px-2.5 py-1 rounded-full" style={{ background: GOLD }}>
                            {offer.discount_type === "percentage" ? `${offer.discount_value}% OFF` : `₹${offer.discount_value} OFF`}
                          </span>
                        )}
                      </div>
                      {offer.description && <p className="text-xs text-white/35 line-clamp-2">{offer.description}</p>}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>
        )}

        {/* ── REVIEWS MARQUEE ───────────────────────────────────────────── */}
        {previewReviews.length > 0 && (
          <section className="py-14 sm:py-24 overflow-hidden" style={{ background: "#050505" }}>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-8 sm:mb-12">
              <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}
                className="flex items-end justify-between">
                <div>
                  <motion.div variants={fadeUp}><SectionLabel>What People Say</SectionLabel></motion.div>
                  <motion.h2 variants={fadeUp} className="font-serif text-2xl sm:text-3xl lg:text-4xl font-light text-white tracking-tight">
                    Guest Reviews
                    {avgRating !== null && (
                      <span className="ml-3 text-lg sm:text-xl font-normal" style={{ color: GOLD }}>★ {avgRating.toFixed(1)}</span>
                    )}
                  </motion.h2>
                </div>
                <motion.div variants={fadeUp}>
                  <Link href="/cafe/reviews" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: GOLD }}>
                    All reviews <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </motion.div>
              </motion.div>
            </div>

            <div className="flex cafe-marquee" style={{ width: "max-content" }}>
              {[...previewReviews, ...previewReviews].map((review, i) => (
                <div key={i} className="shrink-0 w-[300px] sm:w-[360px] mx-3 sm:mx-4 rounded-2xl p-5 border border-white/[0.06]" style={{ background: "#0B0B0B" }}>
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className={`w-3 h-3 ${j < review.rating ? "fill-[#C9A46C] text-[#C9A46C]" : "text-white/10"}`} />
                    ))}
                  </div>
                  <p className="text-white/50 text-sm leading-relaxed line-clamp-3 mb-4">"{review.content}"</p>
                  <p className="text-xs font-semibold text-white/30">{review.name}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── HOURS + CONTACT ───────────────────────────────────────────── */}
        <section className="py-14 sm:py-20 px-4 sm:px-6" style={{ background: "#0B0B0B" }}>
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-12">
            {hasHours && (
              <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
                <motion.div variants={fadeUp}>
                  <SectionLabel>When We're Open</SectionLabel>
                  <GoldRule />
                  <h2 className="text-xl sm:text-2xl font-serif font-light text-white mb-5">Opening Hours</h2>
                </motion.div>
                <motion.div variants={fadeUp} className="rounded-2xl p-5 sm:p-6 border border-white/[0.06]" style={{ background: "#111111" }}>
                  <OpeningHoursCard hours={settings!.opening_hours} />
                </motion.div>
              </motion.div>
            )}

            <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
              <motion.div variants={fadeUp}>
                <SectionLabel>Where To Find Us</SectionLabel>
                <GoldRule />
                <h2 className="text-xl sm:text-2xl font-serif font-light text-white mb-5">Find Us</h2>
              </motion.div>
              <motion.div variants={fadeUp} className="space-y-4">
                {settings?.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: GOLD }} />
                    <div>
                      <p className="text-white/55 text-sm leading-relaxed">{settings.address}</p>
                      {settings.google_maps_url && (
                        <a href={settings.google_maps_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium mt-1.5 hover:opacity-70 transition-opacity" style={{ color: GOLD }}>
                          Open in Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {settings?.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
                    <a href={`tel:${settings.phone}`} className="text-sm text-white/55 hover:text-white transition-colors">{settings.phone}</a>
                  </div>
                )}
                {settings?.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
                    <a href={`mailto:${settings.email}`} className="text-sm text-white/55 hover:text-white transition-colors">{settings.email}</a>
                  </div>
                )}
                {!settings?.address && !settings?.phone && !settings?.email && (
                  <p className="text-white/25 text-sm">Contact details coming soon.</p>
                )}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── BOTTOM CTA — image-backed ──────────────────────────────────── */}
        <section className="relative py-24 sm:py-36 px-4 sm:px-6 text-center overflow-hidden">
          <img
            src={CTA_BG}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, rgba(5,5,5,0.88) 0%, rgba(5,5,5,0.78) 50%, rgba(5,5,5,0.92) 100%)" }}
          />
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
            className="relative z-10 max-w-2xl mx-auto"
          >
            <motion.div variants={fadeUp}><SectionLabel>Reserve Your Experience</SectionLabel></motion.div>
            <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-7" style={{ background: GOLD }} />
            <motion.h2 variants={fadeUp} className="font-serif text-3xl sm:text-4xl lg:text-5xl font-light text-white tracking-tight mb-3">
              {displayName}
            </motion.h2>
            {settings?.tagline && (
              <motion.p variants={fadeUp} className="text-white/40 mb-10 font-light text-sm sm:text-base">{settings.tagline}</motion.p>
            )}
            {!settings?.tagline && (
              <motion.p variants={fadeUp} className="text-white/30 mb-10 font-light text-sm">A table awaits you.</motion.p>
            )}
            <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/cafe/menu"
                className="inline-flex items-center gap-2 px-6 sm:px-7 py-3 sm:py-3.5 rounded-full text-sm font-semibold text-[#050505] hover:opacity-90 active:scale-95 transition-all"
                style={{ background: GOLD }}
              >
                Browse Menu <ArrowRight className="w-4 h-4" />
              </Link>
              <BookingCTAButton className="inline-flex items-center gap-2 px-6 sm:px-7 py-3 sm:py-3.5 rounded-full text-sm font-semibold text-white border border-white/20 hover:border-[#C9A46C]/40 hover:text-[#C9A46C] transition-all">
                Reserve a Table
              </BookingCTAButton>
            </motion.div>
          </motion.div>
        </section>

      </CafeLayout>
    </>
  );
}
