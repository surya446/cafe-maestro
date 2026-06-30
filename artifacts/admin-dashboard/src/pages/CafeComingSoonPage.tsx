import { Link, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";

const PAGE_LABELS: Record<string, string> = {
  "/cafe/gallery": "Gallery",
  "/cafe/offers": "Offers",
  "/cafe/reviews": "Reviews",
  "/cafe/about": "About",
  "/cafe/contact": "Contact",
};

export function CafeComingSoonPage() {
  const [location] = useLocation();
  const { data: cafe, isLoading: cafeLoading } = usePublicCafe();
  const { data: settings, isLoading: settingsLoading } = usePublicWebsiteSettings(cafe?.id);

  const isLoading = cafeLoading || settingsLoading;
  const displayName = settings?.cafe_name ?? cafe?.name ?? "Our Cafe";
  const primaryColor = settings?.primary_color ?? "#1a1a1a";
  const secondaryColor = settings?.secondary_color ?? "#f5f0eb";
  const pageLabel = PAGE_LABELS[location] ?? "Page";

  return (
    <CafeLayout
      cafeName={displayName}
      logoUrl={settings?.logo_url}
      primaryColor={primaryColor}
      secondaryColor={secondaryColor}
      settings={settings}
    >
      <section
        className="min-h-[65vh] flex flex-col items-center justify-center px-6 py-24 text-center"
        style={{ background: secondaryColor }}
      >
        {!isLoading && (
          <>
            <p
              className="text-xs font-semibold uppercase tracking-[0.18em] mb-5"
              style={{ color: primaryColor, opacity: 0.45 }}
            >
              {displayName}
            </p>
            <h1
              className="font-serif text-5xl sm:text-6xl lg:text-7xl font-light tracking-tight mb-6"
              style={{ color: primaryColor }}
            >
              {pageLabel}
            </h1>
            <p className="text-gray-400 text-base max-w-xs leading-relaxed mb-10">
              This section is coming soon. We're putting the finishing touches on it.
            </p>
            <Link
              href="/cafe"
              className="inline-flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-60"
              style={{ color: primaryColor }}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
          </>
        )}
      </section>
    </CafeLayout>
  );
}
