import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { usePublicOffers } from "@/hooks/usePublicOffers";
import { Tag } from "lucide-react";
import { formatDate } from "@/lib/utils";

function DiscountBadge({ type, value, color }: {
  type: string | null;
  value: number | null;
  color: string;
}) {
  if (!value) return null;
  const label = type === "percentage" ? `${value}% OFF` : `₹${value} OFF`;
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white"
      style={{ background: color }}
    >
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
  const secondaryColor = settings?.secondary_color ?? "#f5f0eb";

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
          Offers
        </h1>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-gray-100 animate-pulse h-64" />
            ))}
          </div>
        ) : !offers || offers.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-gray-300">
            <Tag className="w-14 h-14" />
            <p className="text-base font-medium text-gray-400">No active offers right now</p>
            <p className="text-sm text-gray-300">Check back soon for exciting deals.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="rounded-2xl border border-gray-100 overflow-hidden bg-white hover:shadow-md transition-shadow"
              >
                {offer.image_url && (
                  <div className="h-48 overflow-hidden">
                    <img
                      src={offer.image_url}
                      alt={offer.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900 text-lg leading-snug">{offer.title}</h3>
                    <DiscountBadge type={offer.discount_type} value={offer.discount_value} color={primaryColor} />
                  </div>
                  {offer.description && (
                    <p className="text-sm text-gray-500 leading-relaxed">{offer.description}</p>
                  )}
                  {(offer.valid_from || offer.valid_until) && (
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-400">
                      {offer.valid_from && (
                        <span>From {formatDate(offer.valid_from)}</span>
                      )}
                      {offer.valid_until && (
                        <span>Until {formatDate(offer.valid_until)}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CafeLayout>
  );
}
