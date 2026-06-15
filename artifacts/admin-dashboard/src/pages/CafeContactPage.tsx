import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { useBookingModal } from "@/contexts/BookingModalContext";
import { MapPin, Phone, Mail, Clock, ExternalLink, Instagram, Facebook } from "lucide-react";
import { cn } from "@/lib/utils";
import { OpeningHoursEntry } from "@/types";

function OpeningHoursTable({ hours, primaryColor }: { hours: OpeningHoursEntry[]; primaryColor: string }) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  return (
    <div className="divide-y divide-gray-100">
      {hours.map((entry) => {
        const isToday = entry.day === today;
        return (
          <div
            key={entry.day}
            className={cn(
              "flex items-center justify-between py-2.5 text-sm",
              isToday ? "font-semibold" : "text-gray-600"
            )}
            style={isToday ? { color: primaryColor } : {}}
          >
            <span className="w-28">{entry.day}</span>
            {entry.closed ? (
              <span className="text-gray-400 italic">Closed</span>
            ) : (
              <span>{entry.open} – {entry.close}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CafeContactPage() {
  const { data: cafe, isLoading: cafeLoading } = usePublicCafe();
  const { data: settings, isLoading: settingsLoading } = usePublicWebsiteSettings(cafe?.id);
  const { openBooking } = useBookingModal();

  const isLoading = cafeLoading || settingsLoading;
  const displayName = settings?.cafe_name ?? cafe?.name ?? "Contact";
  const primaryColor = settings?.primary_color ?? "#1a1a1a";
  const secondaryColor = settings?.secondary_color ?? "#f5f0eb";
  const hasHours = Array.isArray(settings?.opening_hours) && settings!.opening_hours.length > 0;

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
          Get in Touch
        </h1>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-4">
                <div className="h-6 w-40 bg-gray-100 rounded animate-pulse" />
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="h-5 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Left — Contact details */}
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-5">Contact</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4.5 h-4.5 text-gray-400 mt-0.5 shrink-0" />
                    {settings?.address ? (
                      <div>
                        <p className="text-gray-700 text-sm leading-relaxed">{settings.address}</p>
                        {settings.google_maps_url && (
                          <a
                            href={settings.google_maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium mt-1.5 hover:opacity-75 transition-opacity"
                            style={{ color: primaryColor }}
                          >
                            Open in Google Maps <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-400 italic text-sm">Address coming soon</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <Phone className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                    {settings?.phone ? (
                      <a
                        href={`tel:${settings.phone}`}
                        className="text-sm text-gray-700 hover:text-gray-900 transition-colors"
                      >
                        {settings.phone}
                      </a>
                    ) : (
                      <p className="text-gray-400 italic text-sm">Contact coming soon</p>
                    )}
                  </div>

                  {settings?.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                      <a
                        href={`mailto:${settings.email}`}
                        className="text-sm text-gray-700 hover:text-gray-900 transition-colors"
                      >
                        {settings.email}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Social */}
              {(settings?.instagram_url || settings?.facebook_url) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Follow Us</h3>
                  <div className="flex items-center gap-3">
                    {settings.instagram_url && (
                      <a
                        href={settings.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        <Instagram className="w-4 h-4" />
                        Instagram
                      </a>
                    )}
                    {settings.facebook_url && (
                      <a
                        href={settings.facebook_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        <Facebook className="w-4 h-4" />
                        Facebook
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Book CTA */}
              <div
                className="rounded-2xl p-6"
                style={{ background: `${primaryColor}10` }}
              >
                <h3 className="font-semibold text-sm mb-1" style={{ color: primaryColor }}>
                  Ready to visit?
                </h3>
                <p className="text-gray-500 text-xs mb-4">Reserve your table online in seconds.</p>
                <button
                  onClick={openBooking}
                  className="inline-flex items-center px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-85"
                  style={{ background: primaryColor }}
                >
                  Book a Table
                </button>
              </div>
            </div>

            {/* Right — Opening hours */}
            <div>
              <div className="flex items-center gap-3 mb-5">
                <Clock className="w-4.5 h-4.5 text-gray-400" />
                <h2 className="text-lg font-bold text-gray-900">Opening Hours</h2>
              </div>
              {hasHours ? (
                <div className="bg-gray-50 rounded-2xl p-6">
                  <OpeningHoursTable hours={settings!.opening_hours} primaryColor={primaryColor} />
                </div>
              ) : (
                <p className="text-gray-400 italic text-sm">Opening hours coming soon</p>
              )}
            </div>
          </div>
        )}
      </div>
    </CafeLayout>
  );
}
