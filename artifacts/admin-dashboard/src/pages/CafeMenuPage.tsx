import { useRef } from "react";
import { Link } from "wouter";
import { Coffee, AlertCircle, ArrowLeft } from "lucide-react";
import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { usePublicMenu } from "@/hooks/usePublicMenu";
import { cn } from "@/lib/utils";

function PriceBadge({ price, color }: { price: number; color: string }) {
  return (
    <span className="font-semibold text-sm" style={{ color }}>
      ₹{price.toFixed(2)}
    </span>
  );
}

export function CafeMenuPage() {
  const { data: cafe, isLoading: cafeLoading } = usePublicCafe();
  const { data: settings, isLoading: settingsLoading } = usePublicWebsiteSettings(cafe?.id);
  const { data: menu, isLoading: menuLoading } = usePublicMenu(cafe?.id);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const isLoading = cafeLoading || settingsLoading || menuLoading;
  const displayName = settings?.cafe_name ?? cafe?.name ?? "Menu";
  const primaryColor = settings?.primary_color ?? "#1a1a1a";
  const secondaryColor = settings?.secondary_color ?? "#f5f0eb";

  function scrollTo(catId: string) {
    const el = sectionRefs.current[catId];
    if (el) {
      const offset = 120;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }

  return (
    <CafeLayout
      cafeName={displayName}
      logoUrl={settings?.logo_url}
      primaryColor={primaryColor}
      secondaryColor={secondaryColor}
      settings={settings}
    >
      {/* ── Page header ─────────────────────────────────────── */}
      <div
        className="py-12 px-4 sm:px-6 text-center border-b border-gray-100"
        style={{ background: secondaryColor }}
      >
        <Link href="/cafe">
          <a className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 mb-4 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to home
          </a>
        </Link>
        <h1 className="text-4xl font-bold" style={{ color: primaryColor }}>
          Our Menu
        </h1>
        {settings?.tagline && (
          <p className="text-gray-500 mt-2">{settings.tagline}</p>
        )}
      </div>

      {isLoading ? (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 space-y-12">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-4">
              <div className="h-8 w-48 bg-gray-100 rounded-lg animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !menu || menu.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-gray-400 px-4">
          <Coffee className="w-14 h-14" />
          <p className="text-lg font-medium text-gray-500">Menu coming soon</p>
          <p className="text-sm text-gray-400">Check back shortly — we're setting up!</p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
          {/* ── Category sticky tabs ──────────────────────────── */}
          {menu.length > 1 && (
            <div
              className="sticky top-16 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-10 bg-white border-b border-gray-100 overflow-x-auto"
              style={{ backdropFilter: "blur(8px)" }}
            >
              <div className="flex items-center gap-2 min-w-max">
                {menu.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => scrollTo(cat.id)}
                    className="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border"
                    style={{
                      borderColor: `${primaryColor}40`,
                      color: primaryColor,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = primaryColor;
                      (e.currentTarget as HTMLButtonElement).style.color = "#fff";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "";
                      (e.currentTarget as HTMLButtonElement).style.color = primaryColor;
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Categories ───────────────────────────────────── */}
          <div className="space-y-16">
            {menu.map((cat) => (
              <section
                key={cat.id}
                ref={(el) => { sectionRefs.current[cat.id] = el; }}
              >
                {/* Category header */}
                <div className="mb-6">
                  <h2
                    className="text-2xl font-bold"
                    style={{ color: primaryColor }}
                  >
                    {cat.name}
                  </h2>
                  {cat.description && (
                    <p className="text-gray-500 mt-1 text-sm">{cat.description}</p>
                  )}
                  <div
                    className="mt-3 h-0.5 w-12 rounded-full"
                    style={{ background: primaryColor }}
                  />
                </div>

                {/* Items */}
                {cat.items.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No items in this category yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {cat.items.map((item) => {
                      const outOfStock = !item.is_available;
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "group relative rounded-2xl border border-gray-100 bg-white overflow-hidden transition-shadow",
                            outOfStock
                              ? "opacity-60"
                              : "hover:shadow-md hover:border-gray-200"
                          )}
                        >
                          {/* Image */}
                          {item.image_url && (
                            <div className="h-40 overflow-hidden">
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className={cn(
                                  "w-full h-full object-cover transition-transform",
                                  !outOfStock && "group-hover:scale-105"
                                )}
                              />
                            </div>
                          )}

                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 leading-snug">
                                  {item.name}
                                </p>
                                {item.description && (
                                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <PriceBadge price={item.price} color={primaryColor} />
                                {outOfStock && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase tracking-wide">
                                    Out of stock
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Tags + meta */}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {item.tags?.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                                  style={{
                                    background: `${primaryColor}18`,
                                    color: primaryColor,
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                              {item.calories && (
                                <span className="text-[10px] text-gray-400 font-medium">
                                  {item.calories} kcal
                                </span>
                              )}
                              {item.prep_time_min && (
                                <span className="text-[10px] text-gray-400 font-medium">
                                  ~{item.prep_time_min} min
                                </span>
                              )}
                            </div>

                            {/* Allergens */}
                            {item.allergens?.length > 0 && (
                              <div className="mt-2 flex items-start gap-1">
                                <AlertCircle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                                <p className="text-[10px] text-gray-400 leading-snug">
                                  Contains: {item.allergens.join(", ")}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* ── Book a table CTA ─────────────────────────────── */}
          <div
            className="mt-20 rounded-2xl p-8 text-center"
            style={{ background: `${primaryColor}12` }}
          >
            <h3 className="text-xl font-bold" style={{ color: primaryColor }}>
              Ready to visit?
            </h3>
            <p className="text-gray-500 text-sm mt-1 mb-5">
              Reserve your table and we'll have it ready for you.
            </p>
            <Link href="/book">
              <a
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: primaryColor }}
              >
                Book a Table
              </a>
            </Link>
          </div>
        </div>
      )}
    </CafeLayout>
  );
}
