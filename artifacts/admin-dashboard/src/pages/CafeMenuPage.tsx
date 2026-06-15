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
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

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
      <div className="relative pt-32 pb-16 px-4 sm:px-6 text-center overflow-hidden" style={{ background: "#0B0B0B" }}>
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `radial-gradient(ellipse at 50% 100%, ${GOLD}, transparent 70%)` }} />
        <div className="relative z-10">
          <Link href="/cafe">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/30 hover:text-white/60 mb-8 transition-colors cursor-pointer tracking-[0.15em] uppercase">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to home
            </span>
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-4" style={{ color: GOLD }}>
              {displayName}
            </p>
            <div className="w-10 h-px mx-auto mb-6" style={{ background: GOLD }} />
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light text-white tracking-tight">
              Our Menu
            </h1>
            {settings?.tagline && (
              <p className="text-white/35 mt-3 font-light">{settings.tagline}</p>
            )}
          </motion.div>
        </div>
      </div>

      {/* ── Sticky category nav ─────────────────────────────── */}
      {menu && menu.length > 0 && (
        <div className="sticky top-[72px] z-30 border-b border-white/[0.05]" style={{ background: "rgba(5,5,5,0.92)", backdropFilter: "blur(20px)" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-2 overflow-x-auto py-3 scrollbar-hide">
            {menu.map((cat) => (
              <button
                key={cat.id}
                onClick={() => scrollTo(cat.id)}
                className="shrink-0 px-4 py-1.5 rounded-full text-[13px] font-medium text-white/50 hover:text-white transition-colors whitespace-nowrap border border-transparent hover:border-white/[0.08]"
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Menu content ────────────────────────────────────── */}
      {isLoading ? (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 space-y-14" style={{ background: "#050505" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-4">
              <div className="h-7 w-40 rounded-lg animate-pulse" style={{ background: "#1a1a1a" }} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-28 rounded-xl animate-pulse" style={{ background: "#111" }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !menu || menu.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4" style={{ background: "#050505" }}>
          <Coffee className="w-14 h-14 text-white/10" />
          <p className="text-base font-medium text-white/30">Menu coming soon</p>
          <p className="text-sm text-white/20">We're curating something special.</p>
        </div>
      ) : (
        <div className="py-16" style={{ background: "#050505" }}>
          {menu.map((category, catIdx) => (
            <section
              key={category.id}
              ref={(el) => { sectionRefs.current[category.id] = el; }}
              className={cn("px-4 sm:px-6 pb-20", catIdx > 0 ? "pt-4" : "")}
            >
              <div className="max-w-5xl mx-auto">
                {/* Category header */}
                <motion.div
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-60px" }}
                  variants={stagger}
                  className="mb-8"
                >
                  <motion.div variants={fadeUp} className="flex items-center gap-4 mb-1">
                    <div className="w-8 h-px" style={{ background: GOLD }} />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: GOLD }}>
                      {category.name}
                    </p>
                  </motion.div>
                  <motion.h2 variants={fadeUp} className="font-serif text-2xl sm:text-3xl font-light text-white tracking-tight">
                    {category.name}
                  </motion.h2>
                  {category.description && (
                    <motion.p variants={fadeUp} className="text-white/35 text-sm mt-1.5">{category.description}</motion.p>
                  )}
                </motion.div>

                {/* Items grid */}
                <motion.div
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-40px" }}
                  variants={stagger}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  {(category.items ?? []).map((item) => (
                    <motion.div
                      key={item.id}
                      variants={fadeUp}
                      className="group flex gap-4 rounded-xl p-4 border border-white/[0.05] hover:border-[#C9A46C]/20 transition-all duration-300"
                      style={{ background: "#111111" }}
                    >
                      {item.image_url && (
                        <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0">
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-white text-sm leading-snug">{item.name}</h3>
                            {item.description && (
                              <p className="text-xs text-white/35 mt-1 leading-relaxed line-clamp-2">{item.description}</p>
                            )}
                          </div>
                          <PriceBadge price={item.price} />
                        </div>
                        {/* Tags */}
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {item.tags.map((tag: string) => (
                              <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white/40 border border-white/[0.08]">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {!item.available && (
                          <span className="mt-2 inline-block text-[10px] font-semibold uppercase tracking-wider text-white/20 bg-white/[0.04] px-2 py-0.5 rounded-full">
                            Unavailable
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </section>
          ))}

          {/* Bottom CTA */}
          <div className="px-4 sm:px-6 pt-8 pb-4">
            <div className="max-w-5xl mx-auto">
              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={stagger}
                className="rounded-2xl p-8 sm:p-12 text-center border border-white/[0.07]"
                style={{ background: "#0B0B0B" }}
              >
                <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-6" style={{ background: GOLD }} />
                <motion.h3 variants={fadeUp} className="font-serif text-2xl sm:text-3xl font-light text-white mb-3">
                  Ready to dine with us?
                </motion.h3>
                <motion.p variants={fadeUp} className="text-white/35 text-sm mb-8">
                  Reserve your table and we'll have it ready for you.
                </motion.p>
                <motion.div variants={fadeUp}>
                  <BookingCTAButton
                    className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-sm font-semibold text-[#050505] transition-all hover:opacity-90 active:scale-95"
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
