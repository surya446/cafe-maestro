import { Tag } from "lucide-react";
import { motion } from "framer-motion";
import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { usePublicOffers } from "@/hooks/usePublicOffers";
import { formatDate } from "@/lib/utils";

const GOLD = "#C9A46C";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };

function DiscountBadge({ type, value }: { type: string | null; value: number | null }) {
  if (!value) return null;
  const label = type === "percentage" ? `${value}% OFF` : `₹${value} OFF`;
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-[#050505]" style={{ background: GOLD }}>
      {label}
    </span>
  );
}

export function CafeOffersPage() {
  const { data: cafe, isLoading: cafeLoading } = usePublicCafe();
  const { data: settings, isLoading: settingsLoading } = usePublicWebsiteSettings(cafe?.id);
  const { data: offers, isLoading: offersLoading } = usePublicOffers(cafe?.id);

  const isLoading = cafeLoading || settingsLoading || offersLoading;
  const displayName = settings?.cafe_name ?? cafe?.name ?? "Offers";
  const primaryColor = settings?.primary_color ?? "#1a1a1a";

  return (
    <CafeLayout
      cafeName={displayName}
      logoUrl={settings?.logo_url}
      primaryColor={primaryColor}
      settings={settings}
    >

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="relative pt-36 pb-24 px-4 sm:px-6 text-center overflow-hidden" style={{ background: "#050505" }}>
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `radial-gradient(ellipse at 50% 0%, ${GOLD}, transparent 55%)` }} />
        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger}
          className="relative z-10 max-w-xl mx-auto"
        >
          <motion.p variants={fadeUp} className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-5" style={{ color: GOLD }}>
            {displayName}
          </motion.p>
          <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-7" style={{ background: GOLD }} />
          <motion.h1 variants={fadeUp} className="font-serif text-5xl sm:text-6xl font-light text-white leading-tight tracking-tight">
            Offers
          </motion.h1>
          <motion.p variants={fadeUp} className="text-white/30 mt-4 font-light text-sm">
            Exclusive deals for our guests
          </motion.p>
        </motion.div>
      </div>

      {/* ── Offers grid ─────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-16" style={{ background: "#0B0B0B" }}>
        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl h-64 animate-pulse" style={{ background: "#111" }} />
              ))}
            </div>
          ) : !offers || offers.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
              <Tag className="w-14 h-14 text-white/10" />
              <p className="text-base font-medium text-white/30">No active offers right now</p>
              <p className="text-sm text-white/20">Check back soon for exciting deals.</p>
            </div>
          ) : (
            <motion.div
              initial="hidden"
              animate="show"
              variants={stagger}
              className="grid grid-cols-1 sm:grid-cols-2 gap-6"
            >
              {offers.map((offer) => (
                <motion.div
                  key={offer.id}
                  variants={fadeUp}
                  className="rounded-2xl border overflow-hidden group hover:border-[#C9A46C]/25 transition-all duration-300"
                  style={{ background: "#111111", borderColor: "rgba(201,164,108,0.1)" }}
                >
                  {offer.image_url ? (
                    <div className="h-48 overflow-hidden">
                      <img
                        src={offer.image_url}
                        alt={offer.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="h-1 rounded-t-2xl" style={{ background: GOLD }} />
                  )}
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h3 className="font-semibold text-white text-base leading-snug">{offer.title}</h3>
                      <DiscountBadge type={offer.discount_type} value={offer.discount_value} />
                    </div>
                    {offer.description && (
                      <p className="text-sm text-white/40 leading-relaxed">{offer.description}</p>
                    )}
                    {(offer.valid_from || offer.valid_until) && (
                      <div className="mt-4 flex flex-wrap gap-3">
                        {offer.valid_from && (
                          <span className="text-xs text-white/25 border border-white/[0.07] px-2.5 py-1 rounded-full">
                            From {formatDate(offer.valid_from)}
                          </span>
                        )}
                        {offer.valid_until && (
                          <span className="text-xs text-white/25 border border-white/[0.07] px-2.5 py-1 rounded-full">
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
