import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { usePublicReviews } from "@/hooks/usePublicReviews";
import { Star, MessageCircle } from "lucide-react";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i < rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
        />
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
  const secondaryColor = settings?.secondary_color ?? "#f5f0eb";

  const avgRating =
    reviews && reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null;

  return (
    <CafeLayout
      cafeName={displayName}
      logoUrl={settings?.logo_url}
      primaryColor={primaryColor}
      secondaryColor={secondaryColor}
      settings={settings}
    >
      {/* Page header */}
      <div
        className="py-16 px-4 sm:px-6 text-center border-b border-gray-100"
        style={{ background: secondaryColor }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-[0.18em] mb-3"
          style={{ color: primaryColor, opacity: 0.45 }}
        >
          {displayName}
        </p>
        <h1
          className="font-serif text-5xl sm:text-6xl font-light tracking-tight"
          style={{ color: primaryColor }}
        >
          Reviews
        </h1>
        {avgRating !== null && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="text-2xl font-bold text-gray-900">{avgRating.toFixed(1)}</span>
            <StarRating rating={Math.round(avgRating)} />
            <span className="text-sm text-gray-400">({reviews!.length} review{reviews!.length !== 1 ? "s" : ""})</span>
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-gray-100 animate-pulse h-32" />
            ))}
          </div>
        ) : !reviews || reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-gray-300">
            <MessageCircle className="w-14 h-14" />
            <p className="text-base font-medium text-gray-400">No reviews yet</p>
            <p className="text-sm text-gray-300">Be the first to share your experience!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-2xl border border-gray-100 bg-white p-6 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{review.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(review.created_at).toLocaleDateString("en-IN", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </p>
                  </div>
                  <StarRating rating={review.rating} />
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">{review.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </CafeLayout>
  );
}
