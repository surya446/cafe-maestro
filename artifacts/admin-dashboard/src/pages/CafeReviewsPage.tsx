import { Star, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { usePublicReviews } from "@/hooks/usePublicReviews";

const GOLD = "#C9A46C";

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.68, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const sz = size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${sz} ${i < rating ? "fill-[#C9A46C] text-[#C9A46C]" : "text-white/10"}`} />
      ))}
    </div>
  );
}

export function CafeReviewsPage() {
  const { data: cafe, isLoading: cafeLoading } = usePublicCafe();
  const { data: settings, isLoading: settingsLoading } = usePublicWebsiteSettings(cafe?.id);
  const { data: reviews, isLoading: reviewsLoading } = usePublicReviews(cafe?.id);

  const isLoading = cafeLoading || settingsLoading || reviewsLoading;
  const displayName = settings?.cafe_name ?? cafe?.name ?? "Reviews";
  const primaryColor = settings?.primary_color ?? "#1a1a1a";

  const avgRating =
    reviews && reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null;

  return (
    <CafeLayout
      cafeName={displayName}
      logoUrl={settings?.logo_url}
      primaryColor={primaryColor}
      settings={settings}
    >

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="relative pt-24 sm:pt-36 pb-12 sm:pb-20 px-4 sm:px-6 text-center overflow-hidden" style={{ background: "#050505" }}>
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `radial-gradient(ellipse at 50% 0%, ${GOLD}, transparent 55%)` }} />
        <motion.div initial="hidden" animate="show" variants={stagger} className="relative z-10 max-w-xl mx-auto">
          <motion.p variants={fadeUp} className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-4" style={{ color: GOLD }}>
            {displayName}
          </motion.p>
          <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-6" style={{ background: GOLD }} />
          <motion.h1 variants={fadeUp} className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light text-white leading-tight tracking-tight">
            Reviews
          </motion.h1>

          {avgRating !== null && (
            <motion.div variants={fadeUp} className="flex items-center justify-center gap-3 mt-7 sm:mt-8">
              <span className="font-serif text-3xl sm:text-4xl font-light" style={{ color: GOLD }}>{avgRating.toFixed(1)}</span>
              <div>
                <StarRating rating={Math.round(avgRating)} size="lg" />
                <p className="text-xs text-white/28 mt-1">
                  {reviews!.length} review{reviews!.length !== 1 ? "s" : ""}
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* ── Reviews list ────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-12 sm:py-16" style={{ background: "#0B0B0B" }}>
        <div className="max-w-3xl mx-auto">
          {isLoading ? (
            <div className="space-y-3.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl h-28 animate-pulse" style={{ background: "#111" }} />
              ))}
            </div>
          ) : !reviews || reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[45vh] gap-4">
              <MessageCircle className="w-12 h-12 text-white/10" />
              <p className="text-sm font-medium text-white/28">No reviews yet</p>
              <p className="text-xs text-white/18">Be the first to share your experience.</p>
            </div>
          ) : (
            <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-3 sm:space-y-4">
              {reviews.map((review) => (
                <motion.div key={review.id} variants={fadeUp}
                  className="rounded-2xl p-4 sm:p-6 border border-white/[0.05] hover:border-[#C9A46C]/12 transition-all duration-300 group"
                  style={{ background: "#111111" }}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-white text-sm">{review.name}</p>
                      <p className="text-xs text-white/22 mt-0.5">
                        {new Date(review.created_at).toLocaleDateString("en-IN", {
                          day: "numeric", month: "long", year: "numeric",
                        })}
                      </p>
                    </div>
                    <StarRating rating={review.rating} />
                  </div>
                  <p className="text-white/48 text-sm leading-relaxed">"{review.content}"</p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </CafeLayout>
  );
}
