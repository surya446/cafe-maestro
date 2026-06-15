import { Link } from "wouter";
import { MapPin, Phone, Mail, ExternalLink, Clock, ArrowRight, Coffee } from "lucide-react";
import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { OpeningHoursEntry } from "@/types";
import { cn } from "@/lib/utils";

function HeroSkeleton() {
  return (
    <div className="h-[60vh] min-h-[420px] bg-gray-100 animate-pulse flex items-center justify-center">
      <Coffee className="w-16 h-16 text-gray-300" />
    </div>
  );
}

function OpeningHoursCard({ hours }: { hours: OpeningHoursEntry[] }) {
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
              isToday ? "font-semibold text-gray-900" : "text-gray-600"
            )}
          >
            <span className="w-28">{entry.day}</span>
            {entry.closed ? (
              <span className="text-gray-400 italic">Closed</span>
            ) : (
              <span>
                {entry.open} – {entry.close}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CafePage() {
  const { data: cafe, isLoading: cafeLoading } = usePublicCafe();
  const { data: settings, isLoading: settingsLoading } = usePublicWebsiteSettings(cafe?.id);

  const isLoading = cafeLoading || settingsLoading;
  const displayName = settings?.cafe_name ?? cafe?.name ?? "Our Cafe";
  const primaryColor = settings?.primary_color ?? "#1a1a1a";
  const secondaryColor = settings?.secondary_color ?? "#f5f0eb";
  const hasHours =
    Array.isArray(settings?.opening_hours) && settings.opening_hours.length > 0;

  if (isLoading) {
    return (
      <CafeLayout cafeName="Loading…" primaryColor={primaryColor} secondaryColor={secondaryColor}>
        <HeroSkeleton />
      </CafeLayout>
    );
  }

  if (!cafe) {
    return (
      <CafeLayout cafeName="Cafe" primaryColor={primaryColor} secondaryColor={secondaryColor}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-gray-400">
          <Coffee className="w-16 h-16" />
          <p className="text-lg font-medium">Coming soon</p>
        </div>
      </CafeLayout>
    );
  }

  return (
    <CafeLayout
      cafeName={displayName}
      logoUrl={settings?.logo_url}
      primaryColor={primaryColor}
      secondaryColor={secondaryColor}
      settings={settings}
    >
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section
        className="relative flex items-center justify-center min-h-[60vh] overflow-hidden"
        style={
          settings?.hero_image_url
            ? {}
            : { background: `linear-gradient(135deg, ${primaryColor}ee 0%, ${primaryColor}99 100%)` }
        }
      >
        {settings?.hero_image_url && (
          <>
            <img
              src={settings.hero_image_url}
              alt="Hero"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50" />
          </>
        )}
        <div className="relative z-10 text-center px-6 max-w-3xl mx-auto py-24">
          {settings?.tagline && (
            <p className="text-sm font-semibold uppercase tracking-widest text-white/70 mb-3">
              {settings.tagline}
            </p>
          )}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
            {settings?.hero_title ?? displayName}
          </h1>
          {settings?.hero_subtitle && (
            <p className="mt-4 text-lg sm:text-xl text-white/80 font-light">
              {settings.hero_subtitle}
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/cafe/menu">
              <a
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: primaryColor }}
              >
                View Menu <ArrowRight className="w-4 h-4" />
              </a>
            </Link>
            <Link href="/book">
              <a className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm border border-white/30">
                Book a Table
              </a>
            </Link>
          </div>
        </div>
      </section>

      {/* ── About ─────────────────────────────────────────────── */}
      {settings?.about_content && (
        <section
          className="py-20 px-4 sm:px-6"
          style={{ background: secondaryColor }}
        >
          <div className="max-w-3xl mx-auto">
            <h2
              className="text-3xl font-bold mb-6"
              style={{ color: primaryColor }}
            >
              Our Story
            </h2>
            <div className="prose prose-gray max-w-none">
              {settings.about_content.split("\n").map((line, i) =>
                line.trim() ? (
                  <p key={i} className="text-gray-700 leading-relaxed mb-4">
                    {line}
                  </p>
                ) : null
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Hours + Contact ───────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Opening hours */}
          {hasHours && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-xl"
                  style={{ background: `${primaryColor}18` }}
                >
                  <Clock className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Opening Hours</h2>
              </div>
              <div className="bg-gray-50 rounded-2xl p-6">
                <OpeningHoursCard hours={settings!.opening_hours} />
              </div>
            </div>
          )}

          {/* Contact */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div
                className="flex items-center justify-center w-10 h-10 rounded-xl"
                style={{ background: `${primaryColor}18` }}
              >
                <MapPin className="w-5 h-5" style={{ color: primaryColor }} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Find Us</h2>
            </div>
            <div className="space-y-4">
              {/* Address — settings only, never cafe table fallback */}
              <div className="flex items-start gap-3">
                <MapPin className="w-4.5 h-4.5 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  {settings?.address ? (
                    <>
                      <p className="text-gray-700">{settings.address}</p>
                      {settings.google_maps_url && (
                        <a
                          href={settings.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium mt-1 hover:opacity-75 transition-opacity"
                          style={{ color: primaryColor }}
                        >
                          Open in Google Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-400 italic">Address coming soon</p>
                  )}
                </div>
              </div>

              {/* Phone — settings only, never cafe table fallback */}
              <div className="flex items-center gap-3">
                <Phone className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                {settings?.phone ? (
                  <a
                    href={`tel:${settings.phone}`}
                    className="text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    {settings.phone}
                  </a>
                ) : (
                  <span className="text-gray-400 italic">Contact coming soon</span>
                )}
              </div>

              {/* Email — only show when present */}
              {settings?.email && (
                <a
                  href={`mailto:${settings.email}`}
                  className="flex items-center gap-3 text-gray-700 hover:text-gray-900 group"
                >
                  <Mail className="w-4.5 h-4.5 text-gray-400 group-hover:text-gray-600 shrink-0" />
                  {settings.email}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section
        className="py-20 px-4 sm:px-6 text-center"
        style={{ background: primaryColor }}
      >
        <h2 className="text-3xl font-bold text-white mb-2">{displayName}</h2>
        {settings?.tagline && (
          <p className="text-white/70 mb-8">{settings.tagline}</p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/cafe/menu">
            <a className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-white hover:opacity-90 transition-opacity" style={{ color: primaryColor }}>
              Browse the Menu <ArrowRight className="w-4 h-4" />
            </a>
          </Link>
          <Link href="/book">
            <a className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white border border-white/40 hover:bg-white/10 transition-colors">
              Reserve a Table
            </a>
          </Link>
        </div>
      </section>
    </CafeLayout>
  );
}
