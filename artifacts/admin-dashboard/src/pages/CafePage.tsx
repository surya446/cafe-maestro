import { useRef } from "react";
import { Link } from "wouter";
import { MapPin, Phone, Mail, ExternalLink, Clock, ArrowRight, Coffee, Star } from "lucide-react";
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

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-4" style={{ color: GOLD }}>
      {children}
    </p>
  );
}

function GoldRule() {
  return <div className="w-10 h-px mb-8" style={{ background: GOLD }} />;
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
          transition={{ duration: 0.9, delay: 0.3 + i * 0.13, ease: [0.16, 1, 0.3, 1] }}
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
    <div className="divide-y divide-white/[0.06]">
      {hours.map((entry) => {
        const isToday = entry.day === today;
        return (
          <div
            key={entry.day}
            className={cn(
              "flex items-center justify-between py-3 text-sm",
              isToday ? "font-semibold" : ""
            )}
          >
            <span className={cn("w-28", isToday ? "text-white" : "text-white/45")}>{entry.day}</span>
            {entry.closed ? (
              <span className="text-white/25 italic">Closed</span>
            ) : (
              <span className={isToday ? "" : "text-white/45"} style={isToday ? { color: GOLD } : {}}>
                {entry.open} – {entry.close}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

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

  const previewGallery = (gallery ?? []).slice(0, 6);
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
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Coffee className="w-12 h-12" style={{ color: GOLD }} />
          </motion.div>
        </div>
      </CafeLayout>
    );
  }

  if (!cafe) {
    return (
      <CafeLayout cafeName="Cafe" primaryColor={primaryColor}>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ background: "#050505" }}>
          <Coffee className="w-16 h-16" style={{ color: GOLD }} />
          <p className="text-white/40 text-lg font-light">Coming soon</p>
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
        @keyframes cafe-scroll-bounce {
          0%, 100% { transform: translateY(0); opacity: 0.6; }
          50% { transform: translateY(6px); opacity: 1; }
        }
        .cafe-scroll-hint { animation: cafe-scroll-bounce 2s ease-in-out infinite; }
      `}</style>

      <CafeLayout
        cafeName={displayName}
        logoUrl={settings?.logo_url}
        primaryColor={primaryColor}
        settings={settings}
      >

        {/* ── HERO ──────────────────────────────────────────────── */}
        <section className="relative h-screen flex flex-col justify-end overflow-hidden" style={{ background: "#050505" }}>
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
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #050505 0%, rgba(5,5,5,0.7) 45%, rgba(5,5,5,0.2) 100%)" }} />
            </>
          ) : (
            <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 20% 50%, ${primaryColor}33 0%, #050505 70%)` }} />
          )}

          {/* Hero content — editorial bottom-left */}
          <div className="relative z-10 px-6 sm:px-12 lg:px-20 pb-24 max-w-4xl">
            {settings?.tagline && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.8 }}
                className="text-[11px] font-semibold uppercase tracking-[0.3em] mb-6"
                style={{ color: GOLD }}
              >
                {settings.tagline}
              </motion.p>
            )}
            <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-light text-white leading-[1.02] tracking-tight overflow-hidden">
              <HeroWordSplit text={settings?.hero_title ?? displayName} />
            </h1>
            {settings?.hero_subtitle && (
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.7 }}
                className="mt-5 text-base sm:text-lg text-white/55 font-light max-w-xl"
              >
                {settings.hero_subtitle}
              </motion.p>
            )}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1, duration: 0.7 }}
              className="mt-10 flex flex-wrap items-center gap-3"
            >
              <Link
                href="/cafe/menu"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold text-[#050505] transition-all hover:opacity-90 active:scale-95"
                style={{ background: GOLD }}
              >
                View Menu <ArrowRight className="w-4 h-4" />
              </Link>
              <BookingCTAButton className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold text-white border border-white/25 hover:bg-white/[0.08] transition-colors backdrop-blur-sm">
                Book a Table
              </BookingCTAButton>
            </motion.div>
          </div>

          {/* Scroll hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8, duration: 0.6 }}
            className="absolute bottom-8 right-10 flex flex-col items-center gap-2 cafe-scroll-hint"
          >
            <span className="text-[10px] tracking-[0.2em] uppercase text-white/30 rotate-90 origin-center">Scroll</span>
          </motion.div>
        </section>

        {/* ── MARQUEE DIVIDER ───────────────────────────────────── */}
        <div
          className="overflow-hidden py-5 border-y border-white/[0.05]"
          style={{ background: "#0B0B0B" }}
        >
          <div ref={marqueeRef} className="flex cafe-marquee whitespace-nowrap" style={{ width: "max-content" }}>
            {[...marqueeItems, ...marqueeItems].map((item, i) => (
              <span key={i} className="inline-flex items-center gap-6 mr-12 text-sm font-light tracking-[0.12em] text-white/25">
                {item}
                <span className="w-1 h-1 rounded-full" style={{ background: GOLD }} />
              </span>
            ))}
          </div>
        </div>

        {/* ── ABOUT ─────────────────────────────────────────────── */}
        {settings?.about_content && (
          <section className="py-28 px-4 sm:px-6" style={{ background: "#0B0B0B" }}>
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-80px" }}
                variants={stagger}
              >
                <motion.div variants={fadeUp}>
                  <SectionLabel>Our Story</SectionLabel>
                  <GoldRule />
                </motion.div>
                <motion.h2 variants={fadeUp} className="font-serif text-3xl sm:text-4xl lg:text-5xl font-light text-white leading-tight tracking-tight mb-8">
                  {displayName}
                </motion.h2>
                <motion.div variants={fadeUp}>
                  {settings.about_content.split("\n").map((line, i) =>
                    line.trim() ? (
                      <p key={i} className="text-white/50 leading-relaxed mb-4 text-[15px]">{line}</p>
                    ) : null
                  )}
                </motion.div>
                <motion.div variants={fadeUp} className="mt-8">
                  <Link
                    href="/cafe/about"
                    className="inline-flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-70"
                    style={{ color: GOLD }}
                  >
                    Read more <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </motion.div>
              </motion.div>

              {/* Decorative right panel */}
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className="hidden lg:flex items-center justify-center"
              >
                <div className="w-full aspect-square rounded-2xl flex items-center justify-center border border-white/[0.06]" style={{ background: "#111111" }}>
                  <div className="text-center px-12">
                    {avgRating !== null && (
                      <>
                        <p className="font-serif text-7xl font-light" style={{ color: GOLD }}>{avgRating.toFixed(1)}</p>
                        <div className="flex justify-center gap-1 mt-3 mb-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-4 h-4 ${i < Math.round(avgRating) ? "fill-[#C9A46C] text-[#C9A46C]" : "text-white/15"}`} />
                          ))}
                        </div>
                        <p className="text-xs tracking-[0.2em] uppercase text-white/25 mt-3">Guest Rating</p>
                      </>
                    )}
                    {avgRating === null && (
                      <Coffee className="w-20 h-20 text-white/10" />
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </section>
        )}

        {/* ── GALLERY ───────────────────────────────────────────── */}
        {previewGallery.length > 0 && (
          <section className="py-24 px-4 sm:px-6" style={{ background: "#111111" }}>
            <div className="max-w-6xl mx-auto">
              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={stagger}
                className="flex items-end justify-between mb-10"
              >
                <div>
                  <motion.div variants={fadeUp}><SectionLabel>Our Space</SectionLabel></motion.div>
                  <motion.h2 variants={fadeUp} className="font-serif text-3xl sm:text-4xl font-light text-white tracking-tight">
                    Gallery
                  </motion.h2>
                </div>
                <motion.div variants={fadeUp}>
                  <Link
                    href="/cafe/gallery"
                    className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70"
                    style={{ color: GOLD }}
                  >
                    View all <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </motion.div>
              </motion.div>

              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-60px" }}
                variants={stagger}
                className="grid grid-cols-2 sm:grid-cols-3 gap-3"
              >
                {previewGallery.map((img, i) => (
                  <motion.div
                    key={img.id}
                    variants={fadeUp}
                    className={cn(
                      "relative rounded-xl overflow-hidden group cursor-pointer border border-white/[0.04]",
                      i === 0 ? "aspect-[4/3] sm:row-span-2 sm:aspect-auto" : "aspect-square"
                    )}
                  >
                    <img
                      src={img.url}
                      alt={img.alt_text ?? img.caption ?? displayName}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300" />
                    {img.caption && (
                      <div className="absolute inset-x-0 bottom-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300" style={{ background: "linear-gradient(to top, rgba(5,5,5,0.9) 0%, transparent 100%)" }}>
                        <p className="text-white text-xs font-medium">{img.caption}</p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>
        )}

        {/* ── OFFERS ────────────────────────────────────────────── */}
        {previewOffers.length > 0 && (
          <section className="py-24 px-4 sm:px-6" style={{ background: "#0B0B0B" }}>
            <div className="max-w-6xl mx-auto">
              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={stagger}
                className="flex items-end justify-between mb-10"
              >
                <div>
                  <motion.div variants={fadeUp}><SectionLabel>Deals & Promotions</SectionLabel></motion.div>
                  <motion.h2 variants={fadeUp} className="font-serif text-3xl sm:text-4xl font-light text-white tracking-tight">
                    Current Offers
                  </motion.h2>
                </div>
                <motion.div variants={fadeUp}>
                  <Link href="/cafe/offers" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70" style={{ color: GOLD }}>
                    View all <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </motion.div>
              </motion.div>

              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-60px" }}
                variants={stagger}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
              >
                {previewOffers.map((offer) => (
                  <motion.div
                    key={offer.id}
                    variants={fadeUp}
                    className="rounded-2xl border overflow-hidden group transition-all duration-300 hover:border-[#C9A46C]/30"
                    style={{ background: "#171717", borderColor: "rgba(201,164,108,0.12)" }}
                  >
                    {offer.image_url && (
                      <div className="h-40 overflow-hidden">
                        <img src={offer.image_url} alt={offer.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                      </div>
                    )}
                    {!offer.image_url && (
                      <div className="h-1 rounded-t-2xl" style={{ background: GOLD }} />
                    )}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="font-semibold text-white text-sm leading-snug">{offer.title}</h3>
                        {offer.discount_value && (
                          <span className="shrink-0 text-xs font-bold text-[#050505] px-2.5 py-1 rounded-full" style={{ background: GOLD }}>
                            {offer.discount_type === "percentage" ? `${offer.discount_value}% OFF` : `₹${offer.discount_value} OFF`}
                          </span>
                        )}
                      </div>
                      {offer.description && (
                        <p className="text-sm text-white/40 line-clamp-2">{offer.description}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>
        )}

        {/* ── REVIEWS MARQUEE ───────────────────────────────────── */}
        {previewReviews.length > 0 && (
          <section className="py-24 overflow-hidden" style={{ background: "#050505" }}>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-12">
              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={stagger}
                className="flex items-end justify-between"
              >
                <div>
                  <motion.div variants={fadeUp}><SectionLabel>What People Say</SectionLabel></motion.div>
                  <motion.h2 variants={fadeUp} className="font-serif text-3xl sm:text-4xl font-light text-white tracking-tight">
                    Guest Reviews
                    {avgRating !== null && (
                      <span className="ml-3 text-xl font-normal" style={{ color: GOLD }}>
                        ★ {avgRating.toFixed(1)}
                      </span>
                    )}
                  </motion.h2>
                </div>
                <motion.div variants={fadeUp}>
                  <Link href="/cafe/reviews" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70" style={{ color: GOLD }}>
                    All reviews <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </motion.div>
              </motion.div>
            </div>

            {/* Infinite marquee */}
            <div className="flex cafe-marquee" style={{ width: "max-content" }}>
              {[...previewReviews, ...previewReviews].map((review, i) => (
                <div
                  key={i}
                  className="shrink-0 w-[340px] sm:w-[380px] mx-4 rounded-2xl p-6 border border-white/[0.07]"
                  style={{ background: "#0B0B0B" }}
                >
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className={`w-3.5 h-3.5 ${j < review.rating ? "fill-[#C9A46C] text-[#C9A46C]" : "text-white/10"}`} />
                    ))}
                  </div>
                  <p className="text-white/55 text-sm leading-relaxed line-clamp-3 mb-5">
                    "{review.content}"
                  </p>
                  <p className="text-xs font-semibold text-white/35">{review.name}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── HOURS + CONTACT ───────────────────────────────────── */}
        <section className="py-24 px-4 sm:px-6" style={{ background: "#0B0B0B" }}>
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
            {hasHours && (
              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={stagger}
              >
                <motion.div variants={fadeUp}>
                  <SectionLabel>When We're Open</SectionLabel>
                  <GoldRule />
                  <h2 className="text-2xl font-serif font-light text-white mb-6">Opening Hours</h2>
                </motion.div>
                <motion.div
                  variants={fadeUp}
                  className="rounded-2xl p-6 border border-white/[0.07]"
                  style={{ background: "#111111" }}
                >
                  <OpeningHoursCard hours={settings!.opening_hours} />
                </motion.div>
              </motion.div>
            )}

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={stagger}
            >
              <motion.div variants={fadeUp}>
                <SectionLabel>Where To Find Us</SectionLabel>
                <GoldRule />
                <h2 className="text-2xl font-serif font-light text-white mb-6">Find Us</h2>
              </motion.div>
              <motion.div variants={fadeUp} className="space-y-5">
                {settings?.address ? (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: GOLD }} />
                    <div>
                      <p className="text-white/60 text-sm">{settings.address}</p>
                      {settings.google_maps_url && (
                        <a href={settings.google_maps_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium mt-1.5 hover:opacity-70 transition-opacity" style={{ color: GOLD }}>
                          Open in Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ) : null}
                {settings?.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
                    <a href={`tel:${settings.phone}`} className="text-sm text-white/60 hover:text-white transition-colors">{settings.phone}</a>
                  </div>
                )}
                {settings?.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
                    <a href={`mailto:${settings.email}`} className="text-sm text-white/60 hover:text-white transition-colors">{settings.email}</a>
                  </div>
                )}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── BOTTOM CTA ────────────────────────────────────────── */}
        <section className="py-32 px-4 sm:px-6 text-center relative overflow-hidden" style={{ background: "#111111" }}>
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `radial-gradient(circle at 50% 50%, ${GOLD} 0%, transparent 70%)` }} />
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
            className="relative z-10 max-w-2xl mx-auto"
          >
            <motion.div variants={fadeUp}><SectionLabel>Reserve Your Experience</SectionLabel></motion.div>
            <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-8" style={{ background: GOLD }} />
            <motion.h2 variants={fadeUp} className="font-serif text-4xl sm:text-5xl font-light text-white tracking-tight mb-3">
              {displayName}
            </motion.h2>
            {settings?.tagline && (
              <motion.p variants={fadeUp} className="text-white/40 mb-12 font-light">{settings.tagline}</motion.p>
            )}
            <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/cafe/menu"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold text-[#050505] transition-all hover:opacity-90 active:scale-95"
                style={{ background: GOLD }}
              >
                Browse Menu <ArrowRight className="w-4 h-4" />
              </Link>
              <BookingCTAButton className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold text-white border border-white/20 hover:border-[#C9A46C]/40 hover:text-[#C9A46C] transition-all">
                Reserve a Table
              </BookingCTAButton>
            </motion.div>
          </motion.div>
        </section>
      </CafeLayout>
    </>
  );
}
