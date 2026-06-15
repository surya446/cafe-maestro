import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { useBookingModal } from "@/contexts/BookingModalContext";
import { Coffee } from "lucide-react";

export function CafeAboutPage() {
  const { data: cafe, isLoading: cafeLoading } = usePublicCafe();
  const { data: settings, isLoading: settingsLoading } = usePublicWebsiteSettings(cafe?.id);
  const { openBooking } = useBookingModal();

  const isLoading = cafeLoading || settingsLoading;
  const displayName = settings?.cafe_name ?? cafe?.name ?? "About";
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
          Our Story
        </h1>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`h-4 bg-gray-100 rounded animate-pulse ${i === 5 ? "w-2/3" : ""}`} />
            ))}
          </div>
        ) : settings?.about_content ? (
          <div className="prose prose-gray max-w-none">
            {settings.about_content.split("\n").map((line, i) =>
              line.trim() ? (
                <p key={i} className="text-gray-700 leading-relaxed text-lg mb-5">
                  {line}
                </p>
              ) : null
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[35vh] gap-4 text-center">
            <div
              className="flex items-center justify-center w-14 h-14 rounded-2xl"
              style={{ background: `${primaryColor}15` }}
            >
              <Coffee className="w-7 h-7" style={{ color: primaryColor }} />
            </div>
            <p className="text-gray-500 font-medium">{displayName}</p>
            <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
              Our story is being written. Add your cafe's story in Website Settings.
            </p>
          </div>
        )}

        {/* CTA */}
        {!isLoading && (
          <div
            className="mt-16 rounded-2xl p-8 text-center"
            style={{ background: `${primaryColor}10` }}
          >
            <h3 className="text-xl font-bold mb-2" style={{ color: primaryColor }}>
              Come visit us
            </h3>
            <p className="text-gray-500 text-sm mb-5">
              Reserve a table and experience it for yourself.
            </p>
            <button
              onClick={openBooking}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-85"
              style={{ background: primaryColor }}
            >
              Book a Table
            </button>
          </div>
        )}
      </div>
    </CafeLayout>
  );
}
