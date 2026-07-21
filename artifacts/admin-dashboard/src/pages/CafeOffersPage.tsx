import { Tag } from "lucide-react";
import { motion } from "framer-motion";
import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { usePublicOffers } from "@/hooks/usePublicOffers";
import { formatDate } from "@/lib/utils";

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
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };

function DiscountBadge({ type, value }: { type: string | null; value: number | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex shrink-0 items-center px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: ACCENT, color: "#fff" }}>
      {type === "percentage" ? `${value}% OFF` : `₹${value} OFF`}
    </span>
  );
}

export function CafeOffersPage() {
  const { data: cafe, isLoading: cafeLoading } = usePublicCafe();
  const { data: settings, isLoading: settingsLoading } = usePublicWebsiteSettings(cafe?.id);
  const { data: offers, isLoading: offersLoading } = usePublicOffers(cafe?.id);

  const isLoading = cafeLoading || settingsLoading || offersLoading;
  const displayName = settings?.cafe_name ?? cafe?.name ?? "Offers";
  const primaryColor = settings?.primary_color ?? ACCENT;

  return (
    <CafeLayout
      cafeName={displayName}
      logoUrl={settings?.logo_url}
      primaryColor={primaryColor}
      settings={settings}
    >

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="relative pt-24 sm:pt-36 pb-12 sm:pb-20 px-4 sm:px-6 text-center overflow-hidden" style={{ background: BG1 }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `radial-gradient(ellipse at 50% 0%, ${GOLD}, transparent 55%)` }} />
        <motion.div initial="hidden" animate="show" variants={stagger} className="relative z-10 max-w-xl mx-auto">
          <motion.p variants={fadeUp} className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-4" style={{ color: ACCENT }}>
            {displayName}
          </motion.p>
          <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-6" style={{ background: GOLD }} />
          <motion.h1 variants={fadeUp} className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light leading-tight tracking-tight" style={{ color: HEAD }}>
            Offers
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-3.5 font-light text-sm" style={{ color: BODY }}>
            Exclusive deals for our guests
          </motion.p>
        </motion.div>
      </div>

      {/* ── Offers grid ─────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-12 sm:py-16" style={{ background: BG2 }}>
        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl h-56 animate-pulse" style={{ background: BORDER }} />
              ))}
            </div>
          ) : !offers || offers.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[45vh] gap-4">
              <Tag className="w-12 h-12" style={{ color: BORDER }} />
              <p className="text-sm font-medium" style={{ color: BODY }}>No active offers right now</p>
              <p className="text-xs" style={{ color: BORDER }}>Check back soon for exciting deals.</p>
            </div>
          ) : (
            <motion.div initial="hidden" animate="show" variants={stagger}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {offers.map((offer) => (
                <motion.div key={offer.id} variants={fadeUp}
                  className="rounded-2xl border overflow-hidden group transition-all duration-300 hover:shadow-md"
                  style={{ background: CARD, borderColor: BORDER }}>
                  {offer.image_url ? (
                    <div className="h-40 sm:h-48 overflow-hidden">
                      <img src={offer.image_url} alt={offer.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                    </div>
                  ) : (
                    <div className="h-1 rounded-t-2xl" style={{ background: GOLD }} />
                  )}
                  <div className="p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <h3 className="font-semibold text-sm sm:text-base leading-snug" style={{ color: HEAD }}>{offer.title}</h3>
                      <DiscountBadge type={offer.discount_type} value={offer.discount_value} />
                    </div>
                    {offer.description && (
                      <p className="text-sm leading-relaxed" style={{ color: BODY }}>{offer.description}</p>
                    )}
                    {(offer.valid_from || offer.valid_until) && (
                      <div className="mt-3 flex flex-wrap gap-2.5">
                        {offer.valid_from && (
                          <span className="text-xs border px-2.5 py-1 rounded-full" style={{ color: BODY, borderColor: BORDER }}>
                            From {formatDate(offer.valid_from)}
                          </span>
                        )}
                        {offer.valid_until && (
                          <span className="text-xs border px-2.5 py-1 rounded-full" style={{ color: BODY, borderColor: BORDER }}>
                            Until {formatDate(offer.valid_until)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </CafeLayout>
  );
}
