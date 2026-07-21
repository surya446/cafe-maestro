import { Star, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { usePublicReviews } from "@/hooks/usePublicReviews";

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

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const sz = size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${sz} ${i < rating ? "fill-[#C9A46C] text-[#C9A46C]" : ""}`}
          style={i < rating ? {} : { color: BORDER }} />
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
  const primaryColor = settings?.primary_color ?? ACCENT;

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
      <div className="relative pt-20 sm:pt-28 pb-5 sm:pb-10 px-4 sm:px-6 text-center overflow-hidden" style={{ background: BG1 }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `radial-gradient(ellipse at 50% 0%, ${GOLD}, transparent 55%)` }} />
        <motion.div initial="hidden" animate="show" variants={stagger} className="relative z-10 max-w-xl mx-auto">
          <motion.p variants={fadeUp} className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-4" style={{ color: ACCENT }}>
            {displayName}
          </motion.p>
          <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-6" style={{ background: GOLD }} />
          <motion.h1 variants={fadeUp} className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light leading-tight tracking-tight" style={{ color: HEAD }}>
            Reviews
          </motion.h1>

          {avgRating !== null && (
            <motion.div variants={fadeUp} className="flex items-center justify-center gap-3 mt-7 sm:mt-8">
              <span className="font-serif text-3xl sm:text-4xl font-light" style={{ color: ACCENT }}>{avgRating.toFixed(1)}</span>
              <div>
                <StarRating rating={Math.round(avgRating)} size="lg" />
                <p className="text-xs mt-1" style={{ color: BODY }}>
                  {reviews!.length} review{reviews!.length !== 1 ? "s" : ""}
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* ── Reviews list ────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-12 sm:py-16" style={{ background: BG2 }}>
        <div className="max-w-3xl mx-auto">
          {isLoading ? (
            <div className="space-y-3.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl h-28 animate-pulse" style={{ background: BORDER }} />
              ))}
            </div>
          ) : !reviews || reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[45vh] gap-4">
              <MessageCircle className="w-12 h-12" style={{ color: BORDER }} />
              <p className="text-sm font-medium" style={{ color: BODY }}>No reviews yet</p>
              <p className="text-xs" style={{ color: BORDER }}>Be the first to share your experience.</p>
            </div>
          ) : (
            <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-3 sm:space-y-4">
              {reviews.map((review) => (
                <motion.div key={review.id} variants={fadeUp}
                  className="rounded-2xl p-4 sm:p-6 border transition-all duration-300 hover:shadow-sm"
                  style={{ background: CARD, borderColor: BORDER }}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-sm" style={{ color: HEAD }}>{review.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: BORDER }}>
                        {new Date(review.created_at).toLocaleDateString("en-IN", {
                          day: "numeric", month: "long", year: "numeric",
                        })}
                      </p>
                    </div>
                    <StarRating rating={review.rating} />
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: BODY }}>"{review.content}"</p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </CafeLayout>
  );
}
