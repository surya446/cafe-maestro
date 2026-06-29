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

const GOLD = "#C9A46C";

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.68, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

function PriceBadge({ price }: { price: number }) {
  return (
    <span className="font-semibold text-sm shrink-0" style={{ color: GOLD }}>
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
  const primaryColor = settings?.primary_color ?? "#1a1a1a";

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
      <div className="relative pt-24 sm:pt-32 pb-12 sm:pb-16 px-4 sm:px-6 text-center overflow-hidden" style={{ background: "#0B0B0B" }}>
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `radial-gradient(ellipse at 50% 100%, ${GOLD}, transparent 68%)` }} />
        <div className="relative z-10">
          <Link href="/cafe">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/28 hover:text-white/55 mb-6 sm:mb-8 transition-colors cursor-pointer tracking-[0.12em] uppercase">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to home
            </span>
          </Link>
          <motion.div initial="hidden" animate="show" variants={stagger}>
            <motion.p variants={fadeUp} className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-3.5" style={{ color: GOLD }}>
              {displayName}
            </motion.p>
            <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-5" style={{ background: GOLD }} />
            <motion.h1 variants={fadeUp} className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light text-white tracking-tight">
              Our Menu
            </motion.h1>
            {settings?.tagline && (
              <motion.p variants={fadeUp} className="text-white/28 mt-3 font-light text-sm">{settings.tagline}</motion.p>
            )}
          </motion.div>
        </div>
      </div>

      {/* ── Sticky category nav ─────────────────────────────── */}
      {menu && menu.length > 0 && (
        <div className="sticky top-[72px] z-30 border-b border-white/[0.05]"
          style={{ background: "rgba(5,5,5,0.93)", backdropFilter: "blur(20px)" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-1.5 sm:gap-2 overflow-x-auto py-2.5 sm:py-3">
            {menu.map((cat) => (
              <button key={cat.id} onClick={() => scrollTo(cat.id)}
                className="shrink-0 px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-[13px] font-medium text-white/45 hover:text-white transition-colors whitespace-nowrap border border-transparent hover:border-white/[0.07]">
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Menu content ────────────────────────────────────── */}
      {isLoading ? (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-10 sm:space-y-14" style={{ background: "#050505" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3.5">
              <div className="h-6 w-36 rounded-lg animate-pulse" style={{ background: "#1a1a1a" }} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-24 rounded-xl animate-pulse" style={{ background: "#111" }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !menu || menu.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4" style={{ background: "#050505" }}>
          <Coffee className="w-12 h-12 text-white/10" />
          <p className="text-sm font-medium text-white/28">Menu coming soon</p>
          <p className="text-xs text-white/18">We're curating something special.</p>
        </div>
      ) : (
        <div className="py-10 sm:py-14" style={{ background: "#050505" }}>
          {menu.map((category, catIdx) => (
            <section
              key={category.id}
              ref={(el) => { sectionRefs.current[category.id] = el; }}
              className={cn("px-4 sm:px-6 pb-12 sm:pb-16", catIdx > 0 ? "pt-2" : "")}
            >
              <div className="max-w-5xl mx-auto">
                {/* Category header */}
                <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-40px" }} variants={stagger} className="mb-5 sm:mb-7">
                  <motion.div variants={fadeUp} className="flex items-center gap-3.5 mb-1">
                    <div className="w-7 h-px" style={{ background: GOLD }} />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: GOLD }}>{category.name}</p>
                  </motion.div>
                  <motion.h2 variants={fadeUp} className="font-serif text-xl sm:text-2xl lg:text-3xl font-light text-white tracking-tight">
                    {category.name}
                  </motion.h2>
                  {category.description && (
                    <motion.p variants={fadeUp} className="text-white/30 text-sm mt-1">{category.description}</motion.p>
                  )}
                </motion.div>

                {/* Items grid */}
                <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-30px" }} variants={stagger}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {(category.items ?? []).map((item) => (
                    <motion.div key={item.id} variants={fadeUp}
                      className="group flex gap-3 sm:gap-4 rounded-xl p-3.5 sm:p-4 border border-white/[0.04] hover:border-[#C9A46C]/18 transition-all duration-300"
                      style={{ background: "#111111" }}>
                      {item.image_url && (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden shrink-0">
                          <img src={item.image_url} alt={item.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-white text-sm leading-snug">{item.name}</h3>
                            {item.description && (
                              <p className="text-xs text-white/32 mt-1 leading-relaxed line-clamp-2">{item.description}</p>
                            )}
                          </div>
                          <PriceBadge price={item.price} />
                        </div>
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {item.tags.map((tag: string) => (
                              <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white/35 border border-white/[0.07]">
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
          <div className="px-4 sm:px-6 pt-4">
            <div className="max-w-5xl mx-auto">
              <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}
                className="rounded-2xl p-7 sm:p-10 text-center border border-white/[0.06]"
                style={{ background: "#0B0B0B" }}>
                <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-5" style={{ background: GOLD }} />
                <motion.h3 variants={fadeUp} className="font-serif text-xl sm:text-2xl lg:text-3xl font-light text-white mb-2.5">
                  Ready to dine with us?
                </motion.h3>
                <motion.p variants={fadeUp} className="text-white/30 text-sm mb-6 sm:mb-8">
                  Reserve your table and we'll have it ready for you.
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
            </div>
          </div>
        </div>
      )}
    </CafeLayout>
  );
}
