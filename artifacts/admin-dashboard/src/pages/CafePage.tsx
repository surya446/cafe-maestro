import { Link } from "wouter";
import {
  MapPin, Phone, Mail, ExternalLink, Clock,
  ArrowRight, Coffee, Star, ImageIcon, Tag,
} from "lucide-react";
import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { usePublicGallery } from "@/hooks/usePublicGallery";
import { usePublicOffers } from "@/hooks/usePublicOffers";
import { usePublicReviews } from "@/hooks/usePublicReviews";
import { BookingCTAButton } from "@/contexts/BookingModalContext";
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
              <span>{entry.open} – {entry.close}</span>
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
  const { data: gallery } = usePublicGallery(cafe?.id);
  const { data: offers } = usePublicOffers(cafe?.id);
  const { data: reviews } = usePublicReviews(cafe?.id);
  const isLoading = cafeLoading || settingsLoading;
  const displayName = settings?.cafe_name ?? cafe?.name ?? "Our Cafe";
  const primaryColor = settings?.primary_color ?? "#1a1a1a";
  const secondaryColor = settings?.secondary_color ?? "#f5f0eb";
  const hasHours = Array.isArray(settings?.opening_hours) && settings!.opening_hours.length > 0;

  const previewGallery = (gallery ?? []).slice(0, 6);
  const previewOffers = (offers ?? []).slice(0, 3);
  const previewReviews = (reviews ?? []).slice(0, 3);
  const avgRating =
    reviews && reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null;

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
        className="relative flex items-center justify-center min-h-[65vh] overflow-hidden"
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
          <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-light text-white leading-tight tracking-tight">
            {settings?.hero_title ?? displayName}
          </h1>
          {settings?.hero_subtitle && (
            <p className="mt-4 text-lg sm:text-xl text-white/80 font-light">
              {settings.hero_subtitle}
            </p>
          )}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/cafe/menu"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: primaryColor }}
            >
              View Menu <ArrowRight className="w-4 h-4" />
            </Link>
            <BookingCTAButton className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold text-white bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm border border-white/30">
              Book a Table
            </BookingCTAButton>
          </div>
        </div>
      </section>

      {/* ── About ─────────────────────────────────────────────── */}
      {settings?.about_content && (
        <section className="py-20 px-4 sm:px-6" style={{ background: secondaryColor }}>
          <div className="max-w-3xl mx-auto">
            <p
              className="text-xs font-semibold uppercase tracking-[0.18em] mb-4"
              style={{ color: primaryColor, opacity: 0.45 }}
            >
              Our Story
            </p>
            <h2
              className="font-serif text-3xl sm:text-4xl font-light tracking-tight mb-6"
              style={{ color: primaryColor }}
            >
              {displayName}
            </h2>
            <div>
              {settings.about_content.split("\n").map((line, i) =>
                line.trim() ? (
                  <p key={i} className="text-gray-600 leading-relaxed mb-4">
                    {line}
                  </p>
                ) : null
              )}
            </div>
            <Link
              href="/cafe/about"
              className="inline-flex items-center gap-1.5 text-sm font-medium mt-2 hover:opacity-70 transition-opacity"
              style={{ color: primaryColor }}
            >
              Read more <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>
      )}

      {/* ── Gallery teaser ────────────────────────────────────── */}
      {previewGallery.length > 0 && (
        <section className="py-20 px-4 sm:px-6 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-[0.18em] mb-2"
                  style={{ color: primaryColor, opacity: 0.45 }}
                >
                  Our Space
                </p>
                <h2
                  className="font-serif text-3xl sm:text-4xl font-light tracking-tight"
                  style={{ color: primaryColor }}
                >
                  Gallery
                </h2>
              </div>
              <Link
                href="/cafe/gallery"
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-70 transition-opacity"
                style={{ color: primaryColor }}
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {previewGallery.map((img) => (
                <div
                  key={img.id}
                  className="rounded-xl overflow-hidden aspect-square group cursor-pointer"
                >
                  <img
                    src={img.url}
                    alt={img.alt_text ?? img.caption ?? displayName}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 sm:hidden text-center">
              <Link
                href="/cafe/gallery"
                className="inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-70 transition-opacity"
                style={{ color: primaryColor }}
              >
                View all photos <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Offers teaser ─────────────────────────────────────── */}
      {previewOffers.length > 0 && (
        <section className="py-20 px-4 sm:px-6" style={{ background: secondaryColor }}>
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-[0.18em] mb-2"
                  style={{ color: primaryColor, opacity: 0.45 }}
                >
                  Deals & Promotions
                </p>
                <h2
                  className="font-serif text-3xl sm:text-4xl font-light tracking-tight"
                  style={{ color: primaryColor }}
                >
                  Current Offers
                </h2>
              </div>
              <Link
                href="/cafe/offers"
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-70 transition-opacity"
                style={{ color: primaryColor }}
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {previewOffers.map((offer) => (
                <div
                  key={offer.id}
                  className="rounded-2xl bg-white border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {offer.image_url && (
                    <div className="h-40 overflow-hidden">
                      <img
                        src={offer.image_url}
                        alt={offer.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                  {!offer.image_url && (
                    <div
                      className="h-2 rounded-t-2xl"
                      style={{ background: primaryColor }}
                    />
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="font-semibold text-gray-900">{offer.title}</h3>
                      {offer.discount_value && (
                        <span
                          className="shrink-0 text-xs font-bold text-white px-2.5 py-1 rounded-full"
                          style={{ background: primaryColor }}
                        >
                          {offer.discount_type === "percentage"
                            ? `${offer.discount_value}% OFF`
                            : `₹${offer.discount_value} OFF`}
                        </span>
                      )}
                    </div>
                    {offer.description && (
                      <p className="text-sm text-gray-500 line-clamp-2">{offer.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Reviews teaser ────────────────────────────────────── */}
      {previewReviews.length > 0 && (
        <section className="py-20 px-4 sm:px-6 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-[0.18em] mb-2"
                  style={{ color: primaryColor, opacity: 0.45 }}
                >
                  What People Say
                </p>
                <h2
                  className="font-serif text-3xl sm:text-4xl font-light tracking-tight"
                  style={{ color: primaryColor }}
                >
                  Guest Reviews
                  {avgRating !== null && (
                    <span className="ml-3 text-xl font-normal text-amber-400">
                      ★ {avgRating.toFixed(1)}
                    </span>
                  )}
                </h2>
              </div>
              <Link
                href="/cafe/reviews"
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-70 transition-opacity"
                style={{ color: primaryColor }}
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {previewReviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-2xl border border-gray-100 bg-white p-6 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-0.5 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${i < review.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
                      />
                    ))}
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed line-clamp-3 mb-4">
                    "{review.content}"
                  </p>
                  <p className="text-xs font-semibold text-gray-500">{review.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Hours + Contact ───────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6" style={{ background: hasHours || settings?.address ? secondaryColor : "white" }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
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
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <OpeningHoursCard hours={settings!.opening_hours} />
              </div>
            </div>
          )}

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
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  {settings?.address ? (
                    <>
                      <p className="text-gray-700 text-sm">{settings.address}</p>
                      {settings.google_maps_url && (
                        <a
                          href={settings.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium mt-1 hover:opacity-75 transition-opacity"
                          style={{ color: primaryColor }}
                        >
                          Open in Google Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-400 italic text-sm">Address coming soon</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                {settings?.phone ? (
                  <a
                    href={`tel:${settings.phone}`}
                    className="text-sm text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    {settings.phone}
                  </a>
                ) : (
                  <span className="text-gray-400 italic text-sm">Contact coming soon</span>
                )}
              </div>

              {settings?.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400 shrink-0" />
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
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section
        className="py-20 px-4 sm:px-6 text-center"
        style={{ background: primaryColor }}
      >
        <h2 className="font-serif text-3xl sm:text-4xl font-light text-white mb-2 tracking-tight">
          {displayName}
        </h2>
        {settings?.tagline && (
          <p className="text-white/60 mb-8">{settings.tagline}</p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/cafe/menu"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-white hover:opacity-90 transition-opacity"
            style={{ color: primaryColor }}
          >
            Browse the Menu <ArrowRight className="w-4 h-4" />
          </Link>
          <BookingCTAButton className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white border border-white/40 hover:bg-white/10 transition-colors">
            Reserve a Table
          </BookingCTAButton>
        </div>
      </section>
    </CafeLayout>
  );
}
