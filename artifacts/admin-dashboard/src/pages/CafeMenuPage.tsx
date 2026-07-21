import { useRef } from "react";
import { Coffee, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { usePublicMenu } from "@/hooks/usePublicMenu";
import { BookingCTAButton } from "@/contexts/BookingModalContext";
import { cn } from "@/lib/utils";

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
  show: { opacity: 1, y: 0, transition: { duration: 0.68, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

function PriceBadge({ price }: { price: number }) {
  return (
    <span className="font-semibold text-sm shrink-0" style={{ color: ACCENT }}>
      ₹{price % 1 === 0 ? price : price.toFixed(2)}
    </span>
  );
}

export function CafeMenuPage() {
  const { data: cafe, isLoading: cafeLoading } = usePublicCafe();
  const { data: settings, isLoading: settingsLoading } = usePublicWebsiteSettings(cafe?.id);
  const { data: menu, isLoading: menuLoading } = usePublicMenu(cafe?.id);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const isLoading = cafeLoading || settingsLoading || menuLoading;
  const displayName = settings?.cafe_name ?? cafe?.name ?? "Menu";
  const primaryColor = settings?.primary_color ?? ACCENT;

  function scrollTo(catId: string) {
    const el = sectionRefs.current[catId];
    if (el) {
      const offset = 140;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }

  return (
    <CafeLayout
      cafeName={displayName}
      logoUrl={settings?.logo_url}
      primaryColor={primaryColor}
      settings={settings}
    >
      {/* ── Page header ─────────────────────────────────────── */}
      <div className="relative pt-20 sm:pt-28 pb-5 sm:pb-10 px-4 sm:px-6 text-center overflow-hidden" style={{ background: BG1 }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `radial-gradient(ellipse at 50% 100%, ${GOLD}, transparent 68%)` }} />
        <div className="relative z-10">
          <Link href="/cafe">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium hover:opacity-70 mb-6 sm:mb-8 transition-opacity cursor-pointer tracking-[0.12em] uppercase" style={{ color: BODY }}>
              <ArrowLeft className="w-3.5 h-3.5" /> Back to home
            </span>
          </Link>
          <motion.div initial="hidden" animate="show" variants={stagger}>
            <motion.p variants={fadeUp} className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-3.5" style={{ color: ACCENT }}>
              {displayName}
            </motion.p>
            <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-5" style={{ background: GOLD }} />
            <motion.h1 variants={fadeUp} className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight" style={{ color: HEAD }}>
              Our Menu
            </motion.h1>
            {settings?.tagline && (
              <motion.p variants={fadeUp} className="mt-3 font-light text-sm" style={{ color: BODY }}>{settings.tagline}</motion.p>
            )}
          </motion.div>
        </div>
      </div>

      {/* ── Sticky category nav ─────────────────────────────── */}
      {menu && menu.length > 0 && (
        <div className="sticky top-[72px] z-30 border-b"
          style={{ background: `rgba(248,243,234,0.96)`, backdropFilter: "blur(20px)", borderColor: BORDER }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-1.5 sm:gap-2 overflow-x-auto py-2.5 sm:py-3">
            {menu.map((cat) => (
              <button key={cat.id} onClick={() => scrollTo(cat.id)}
                className="shrink-0 px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-[13px] font-medium transition-colors whitespace-nowrap border border-transparent hover:border-[#D9CBB7]"
                style={{ color: BODY }}>
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Menu content ────────────────────────────────────── */}
      {isLoading ? (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-10 sm:space-y-14" style={{ background: BG1 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3.5">
              <div className="h-6 w-36 rounded-lg animate-pulse" style={{ background: BORDER }} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-24 rounded-xl animate-pulse" style={{ background: BG2 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !menu || menu.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4" style={{ background: BG1 }}>
          <Coffee className="w-12 h-12" style={{ color: BORDER }} />
          <p className="text-sm font-medium" style={{ color: BODY }}>Menu coming soon</p>
          <p className="text-xs" style={{ color: BORDER }}>We're curating something special.</p>
        </div>
      ) : (
        <div className="py-10 sm:py-14" style={{ background: BG1 }}>
          {menu.map((category, catIdx) => (
            <section
              key={category.id}
              ref={(el) => { sectionRefs.current[category.id] = el; }}
              className={cn("px-4 sm:px-6 pb-12 sm:pb-16", catIdx > 0 ? "pt-2" : "")}
              style={{ background: catIdx % 2 === 0 ? BG1 : BG2 }}
            >
              <div className="max-w-5xl mx-auto">
                {/* Category header */}
                <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-40px" }} variants={stagger} className="mb-5 sm:mb-7">
                  <motion.div variants={fadeUp} className="flex items-center gap-3.5 mb-1">
                    <div className="w-7 h-px" style={{ background: GOLD }} />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: ACCENT }}>{category.name}</p>
                  </motion.div>
                  <motion.h2 variants={fadeUp} className="font-serif text-xl sm:text-2xl lg:text-3xl font-light tracking-tight" style={{ color: HEAD }}>
                    {category.name}
                  </motion.h2>
                  {category.description && (
                    <motion.p variants={fadeUp} className="text-sm mt-1" style={{ color: BODY }}>{category.description}</motion.p>
                  )}
                </motion.div>

                {/* Items grid */}
                <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-30px" }} variants={stagger}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {(category.items ?? []).map((item) => (
                    <motion.div key={item.id} variants={fadeUp}
                      className="group flex gap-3 sm:gap-4 rounded-xl p-3.5 sm:p-4 border transition-all duration-300 hover:shadow-sm"
                      style={{ background: CARD, borderColor: BORDER }}>
                      {item.image_url && (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden shrink-0">
                          <img src={item.image_url} alt={item.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm leading-snug" style={{ color: HEAD }}>{item.name}</h3>
                            {item.description && (
                              <p className="text-xs mt-1 leading-relaxed line-clamp-2" style={{ color: BODY }}>{item.description}</p>
                            )}
                          </div>
                          <PriceBadge price={item.price} />
                        </div>
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {item.tags.map((tag: string) => (
                              <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full border" style={{ color: BODY, borderColor: BORDER }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </section>
          ))}

          {/* Bottom CTA */}
          <div className="px-4 sm:px-6 pt-4" style={{ background: BG2 }}>
            <div className="max-w-5xl mx-auto">
              <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}
                className="rounded-2xl p-7 sm:p-10 text-center border"
                style={{ background: CARD, borderColor: BORDER }}>
                <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-5" style={{ background: GOLD }} />
                <motion.h3 variants={fadeUp} className="font-serif text-xl sm:text-2xl lg:text-3xl font-light mb-2.5" style={{ color: HEAD }}>
                  Ready to dine with us?
                </motion.h3>
                <motion.p variants={fadeUp} className="text-sm mb-6 sm:mb-8" style={{ color: BODY }}>
                  Reserve your table and we'll have it ready for you.
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
            </div>
          </div>
        </div>
      )}
    </CafeLayout>
  );
}
