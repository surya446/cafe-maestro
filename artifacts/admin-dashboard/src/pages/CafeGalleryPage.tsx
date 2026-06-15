import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { usePublicGallery } from "@/hooks/usePublicGallery";
import { ImageIcon } from "lucide-react";

export function CafeGalleryPage() {
  const { data: cafe, isLoading: cafeLoading } = usePublicCafe();
  const { data: settings, isLoading: settingsLoading } = usePublicWebsiteSettings(cafe?.id);
  const { data: images, isLoading: galleryLoading } = usePublicGallery(cafe?.id);

  const isLoading = cafeLoading || settingsLoading || galleryLoading;
  const displayName = settings?.cafe_name ?? cafe?.name ?? "Gallery";
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
          Gallery
        </h1>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        {isLoading ? (
          <div className="columns-2 sm:columns-3 gap-4 space-y-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="break-inside-avoid rounded-xl bg-gray-100 animate-pulse"
                style={{ height: `${180 + (i % 3) * 60}px` }}
              />
            ))}
          </div>
        ) : !images || images.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-gray-300">
            <ImageIcon className="w-14 h-14" />
            <p className="text-base font-medium text-gray-400">No gallery images yet</p>
            <p className="text-sm text-gray-300">Check back soon — we're adding photos.</p>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 gap-4 space-y-4">
            {images.map((img) => (
              <div
                key={img.id}
                className="break-inside-avoid rounded-xl overflow-hidden group cursor-pointer"
              >
                <div className="relative overflow-hidden">
                  <img
                    src={img.url}
                    alt={img.alt_text ?? img.caption ?? displayName}
                    className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  {img.caption && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      <p className="text-white text-sm font-medium">{img.caption}</p>
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
