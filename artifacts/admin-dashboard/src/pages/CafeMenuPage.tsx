import { useState, useRef, useEffect, useMemo, memo } from "react";
import { Coffee, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { usePublicMenu } from "@/hooks/usePublicMenu";
import { BookingCTAButton } from "@/contexts/BookingModalContext";
import { cn } from "@/lib/utils";
import { MenuItem } from "@/types";

/* ── Brand palette (cream theme) ────────────────────────────────────────── */
const BG1    = "#F8F3EA";
const BG2    = "#F2E8D8";
const CARD   = "#FFFDF8";
const HEAD   = "#4B2E1F";
const BODY   = "#6D5845";
const ACCENT = "#A66A3F";
const BORDER = "#D9CBB7";
const GOLD   = "#C9A46C";

// ── Internal category groups ──────────────────────────────────────────────
// Items in each category are split into MEMO-WRAPPED React components called
// PublicMenuItemGroup. Each group is a completely independent React subtree
// with its own fiber node, reconciliation lifecycle, and CSS grid layout scope.
//
// Why this differs from the previous <div> chunking:
//   A <div> is a host element — React visits it on every parent re-render.
//   A memo-wrapped component is a fiber boundary. React.memo's shallow-equality
//   check on the stable `items` prop (memoized in categoryGroups below) means
//   each group renders ONCE on initial mount and NEVER again for CafeMenuPage,
//   which has no dynamic state after the menu loads.
//
// INTERNAL_CATEGORY_SIZE must be a multiple of 2 (sm:grid-cols-2) so rows
// never split across group boundaries. The outer flex-col gap matches the
// inner grid gap so group boundaries are invisible to the customer.
const INTERNAL_CATEGORY_SIZE = 6;

/** Split array into consecutive chunks of at most `size` elements. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ── PublicMenuItemGroup ──────────────────────────────────────────────────
// One internal category group for the public menu page.
// Receives a stable items[] slice from categoryGroups useMemo below.
// React.memo default shallow-equality: items reference never changes after
// initial data load → this component renders once and is never reconciled again.
const PublicMenuItemGroup = memo(function PublicMenuItemGroup({
  items,
}: {
  items: MenuItem[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      {items.map((item) => (
        <div key={item.id}
          className="group flex gap-3 sm:gap-4 rounded-xl p-3.5 sm:p-4 border transition-all duration-300 hover:shadow-sm"
          style={{ background: CARD, borderColor: BORDER }}>
          {item.image_url && (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden shrink-0">
              <img src={item.image_url} alt={item.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="eager" decoding="async" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm leading-snug" style={{ color: HEAD }}>{item.name}</h3>
                {item.description && (
                  <p className="text-xs mt-1 leading-relaxed line-clamp-2" style={{ color: BODY }}>{item.description}</p>
                )}
              </div>
              <PriceBadge price={item.price} />
            </div>
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {item.tags.map((tag: string) => (
                  <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full border" style={{ color: BODY, borderColor: BORDER }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.68, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

function PriceBadge({ price }: { price: number }) {
  return (
    <span className="font-semibold text-sm shrink-0" style={{ color: ACCENT }}>
      ₹{price % 1 === 0 ? price : price.toFixed(2)}
    </span>
  );
}

/* ── Layout constants ────────────────────────────────────────────────────── */
// Must stay in sync with CafeLayout header (h-[68px]) and the sticky category
// bar below. Used for both the IntersectionObserver rootMargin and scroll offset.
const MAIN_NAV_H = 68;  // CafeLayout header height in px
const CAT_NAV_H  = 48;  // Approximate sticky category bar height in px
const SCROLL_OFFSET = MAIN_NAV_H + CAT_NAV_H + 8; // breathing room below cat bar

export function CafeMenuPage() {
  const { data: cafe, isLoading: cafeLoading } = usePublicCafe();
  const { data: settings, isLoading: settingsLoading } = usePublicWebsiteSettings(cafe?.id);
  const { data: menu, isLoading: menuLoading } = usePublicMenu(cafe?.id);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  // Suppresses the IntersectionObserver while a tap-driven programmatic scroll is
  // in flight. Set to true in scrollTo(), cleared by the native `scrollend` event.
  // This prevents the observer from flickering activeCategory back to the previous
  // category as sections pass through the viewport during smooth scrolling.
  const isProgrammaticScroll = useRef(false);

  // ── Image preload gate ────────────────────────────────────────────────────
  // Hold the skeleton until every menu image has been fetched and decoded.
  // This ensures the page is fully painted before the skeleton disappears,
  // so scrolling never triggers a network request or image decode.
  // A 5-second safety timeout prevents hanging on slow connections.
  const [imagesReady, setImagesReady] = useState(false);
  useEffect(() => {
    if (menuLoading || !menu) return;

    const urls = menu
      .flatMap((cat) => cat.items ?? [])
      .map((i) => i.image_url)
      .filter((u): u is string => Boolean(u));

    if (urls.length === 0) { setImagesReady(true); return; }

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; setImagesReady(true); }
    }, 5_000);

    Promise.all(
      urls.map((src) => {
        const img = new Image();
        img.src = src;
        // decode() waits for download AND full pixel-buffer decode in one step.
        // After it resolves the browser holds the decompressed bitmap; painting
        // the <img> element requires only a GPU upload — zero main-thread work.
        // This eliminates blank sections and images appearing while scrolling.
        // onload (the previous approach) only waited for the HTTP download;
        // the browser still decoded lazily on scroll, blocking the compositor.
        return img.decode().catch(() => {
          // decode() rejects for SVGs, broken URLs, or images with no intrinsic
          // size — none of which need decoding anyway. The HTTP fetch is still in
          // the browser cache so at minimum the download cost is paid upfront.
        });
      })
    ).then(() => {
      if (!settled) { settled = true; clearTimeout(timer); setImagesReady(true); }
    });

    return () => { settled = true; clearTimeout(timer); };
  }, [menu, menuLoading]);

  const isLoading = cafeLoading || settingsLoading || menuLoading || !imagesReady;
  const displayName = settings?.cafe_name ?? cafe?.name ?? "Menu";
  const primaryColor = settings?.primary_color ?? ACCENT;

  // Memoize chunk slices so PublicMenuItemGroup receives stable array references.
  // If chunk() ran during render it would create new arrays every time, defeating
  // React.memo's shallow-equality check. Computing once here gives permanent stability.
  const categoryGroups = useMemo(
    () => menu?.map((cat) => ({
      ...cat,
      groups: chunk(cat.items ?? [], INTERNAL_CATEGORY_SIZE),
    })) ?? [],
    [menu]
  );

  // "All" is hidden from the QR Ordering UI. The category data and logic are
  // untouched — only the visible navigation and rendered sections are filtered.
  const visibleCategories = useMemo(
    () => menu?.filter((cat) => cat.name.toLowerCase() !== "all") ?? [],
    [menu]
  );
  const visibleCategoryGroups = useMemo(
    () => categoryGroups.filter((cat) => cat.name.toLowerCase() !== "all"),
    [categoryGroups]
  );

  // ── IntersectionObserver — scroll-driven active category ─────────────────
  // Fires once per menu load. Observes every visible category <section>. The
  // root margin clips the observation area to the band just below both sticky
  // bars, so a category is only "seen" when its heading enters that band.
  // When multiple categories intersect simultaneously we pick the topmost one
  // (first in menu order) so the indicator never jumps erratically.
  //
  // The isProgrammaticScroll guard is the fix for the category-highlight flicker.
  // When the customer taps a category button, scrollTo() sets the ref to true and
  // immediately updates activeCategory. The observer is suppressed for the entire
  // duration of the smooth scroll so it cannot write a stale value back. The
  // native `scrollend` event clears the guard once the scroll settles, at which
  // point the observer resumes normal operation for subsequent user scrolls.
  useEffect(() => {
    if (!menu || menu.length === 0) return;

    // Initialise to first *visible* category (never "All").
    setActiveCategory((prev) => prev ?? visibleCategories[0]?.id ?? null);

    const observed = new Map<string, boolean>();

    const observer = new IntersectionObserver(
      (entries) => {
        // While a tap-driven scroll is in flight, the observer must not
        // override the category the customer explicitly chose.
        if (isProgrammaticScroll.current) return;

        entries.forEach((entry) => {
          const id = (entry.target as HTMLElement).dataset.categoryId;
          if (id) observed.set(id, entry.isIntersecting);
        });

        // First intersecting visible category in document order wins.
        const first = visibleCategories.find((cat) => observed.get(cat.id));
        if (first) setActiveCategory(first.id);
      },
      {
        // Top margin: exclude the fixed main nav + sticky cat bar from the
        // intersection root so only content below both bars triggers a change.
        // Bottom margin: -50% means only the top half of the viewport counts,
        // preventing the next category from stealing focus prematurely.
        rootMargin: `-${MAIN_NAV_H + CAT_NAV_H}px 0px -50% 0px`,
        threshold: 0,
      }
    );

    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    // Clear the programmatic-scroll guard once the browser finishes scrolling.
    // `scrollend` is the correct event for this — no timeouts, no polling.
    const onScrollEnd = () => { isProgrammaticScroll.current = false; };
    window.addEventListener("scrollend", onScrollEnd);

    return () => {
      observer.disconnect();
      window.removeEventListener("scrollend", onScrollEnd);
    };
  }, [menu, visibleCategories]);

  function scrollTo(catId: string) {
    // Block the IntersectionObserver for the duration of this scroll so it
    // cannot flicker activeCategory back to a previous category mid-scroll.
    isProgrammaticScroll.current = true;
    // Give instant visual feedback before the smooth scroll completes.
    setActiveCategory(catId);
    const el = sectionRefs.current[catId];
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
      window.scrollTo({ top, behavior: "smooth" });
    } else {
      // No element to scroll to — clear the guard immediately.
      isProgrammaticScroll.current = false;
    }
  }

  return (
    <CafeLayout
      cafeName={displayName}
      logoUrl={settings?.logo_url}
      primaryColor={primaryColor}
      settings={settings}
    >
      {/* ── Page header ─────────────────────────────────────── */}
      <div className="relative pt-20 sm:pt-28 pb-5 sm:pb-10 px-4 sm:px-6 text-center overflow-hidden" style={{ background: BG1 }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `radial-gradient(ellipse at 50% 100%, ${GOLD}, transparent 68%)` }} />
        <div className="relative z-10">
          <Link href="/cafe">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium hover:opacity-70 mb-6 sm:mb-8 transition-opacity cursor-pointer tracking-[0.12em] uppercase" style={{ color: BODY }}>
              <ArrowLeft className="w-3.5 h-3.5" /> Back to home
            </span>
          </Link>
          <motion.div initial="hidden" animate="show" variants={stagger}>
            <motion.p variants={fadeUp} className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-3.5" style={{ color: ACCENT }}>
              {displayName}
            </motion.p>
            <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-5" style={{ background: GOLD }} />
            <motion.h1 variants={fadeUp} className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight" style={{ color: HEAD }}>
              Our Menu
            </motion.h1>
            {settings?.tagline && (
              <motion.p variants={fadeUp} className="mt-3 font-light text-sm" style={{ color: BODY }}>{settings.tagline}</motion.p>
            )}
          </motion.div>
        </div>
      </div>

      {/* ── Sticky category nav ─────────────────────────────── */}
      {/* top-[68px] matches CafeLayout h-[68px] exactly — no gap */}
      {menu && menu.length > 0 && (
        <div className="sticky top-[68px] z-30 border-b"
          style={{ background: BG1, borderColor: BORDER }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-1.5 sm:gap-2 overflow-x-auto py-2.5 sm:py-3">
            {visibleCategories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => scrollTo(cat.id)}
                  className="shrink-0 px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-[13px] font-medium transition-all duration-200 whitespace-nowrap border"
                  style={isActive
                    ? { background: primaryColor, color: "#fff", borderColor: primaryColor }
                    : { color: BODY, borderColor: "transparent", background: "transparent" }
                  }
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Menu content ────────────────────────────────────── */}
      {isLoading ? (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-10 sm:space-y-14" style={{ background: BG1 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3.5">
              <div className="h-6 w-36 rounded-lg animate-pulse" style={{ background: BORDER }} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-24 rounded-xl animate-pulse" style={{ background: BG2 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !menu || menu.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4" style={{ background: BG1 }}>
          <Coffee className="w-12 h-12" style={{ color: BORDER }} />
          <p className="text-sm font-medium" style={{ color: BODY }}>Menu coming soon</p>
          <p className="text-xs" style={{ color: BORDER }}>We're curating something special.</p>
        </div>
      ) : (
        <div className="py-10 sm:py-14" style={{ background: BG1 }}>
          {visibleCategoryGroups.map((category, catIdx) => (
            <section
              key={category.id}
              ref={(el) => { sectionRefs.current[category.id] = el; }}
              data-category-id={category.id}
              className={cn("px-4 sm:px-6 pb-12 sm:pb-16", catIdx > 0 ? "pt-2" : "")}
              style={{ background: catIdx % 2 === 0 ? BG1 : BG2 }}
            >
              <div className="max-w-5xl mx-auto">
                {/* Category header */}
                <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-40px" }} variants={stagger} className="mb-5 sm:mb-7">
                  <motion.div variants={fadeUp} className="flex items-center gap-3.5 mb-1">
                    <div className="w-7 h-px" style={{ background: GOLD }} />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: ACCENT }}>{category.name}</p>
                  </motion.div>
                  <motion.h2 variants={fadeUp} className="font-serif text-xl sm:text-2xl lg:text-3xl font-light tracking-tight" style={{ color: HEAD }}>
                    {category.name}
                  </motion.h2>
                  {category.description && (
                    <motion.p variants={fadeUp} className="text-sm mt-1" style={{ color: BODY }}>{category.description}</motion.p>
                  )}
                </motion.div>

                {/* Internal category groups — each is a memo-isolated React subtree.
                    category.groups[] is a stable memoized reference from categoryGroups
                    above. PublicMenuItemGroup.memo fires once at mount, never again. */}
                <div className="flex flex-col gap-3 sm:gap-4">
                  {category.groups.map((group, gi) => (
                    <PublicMenuItemGroup key={gi} items={group} />
                  ))}
                </div>
              </div>
            </section>
          ))}

          {/* Bottom CTA */}
          <div className="px-4 sm:px-6 pt-4" style={{ background: BG2 }}>
            <div className="max-w-5xl mx-auto">
              <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}
                className="rounded-2xl p-7 sm:p-10 text-center border"
                style={{ background: CARD, borderColor: BORDER }}>
                <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-5" style={{ background: GOLD }} />
                <motion.h3 variants={fadeUp} className="font-serif text-xl sm:text-2xl lg:text-3xl font-light mb-2.5" style={{ color: HEAD }}>
                  Ready to dine with us?
                </motion.h3>
                <motion.p variants={fadeUp} className="text-sm mb-6 sm:mb-8" style={{ color: BODY }}>
                  Reserve your table and we'll have it ready for you.
                </motion.p>
                <motion.div variants={fadeUp}>
                  <BookingCTAButton
                    className="inline-flex items-center px-7 py-3.5 rounded-full text-sm font-semibold hover:opacity-90 active:scale-95 transition-all"
                    style={{ background: ACCENT, color: "#fff" }}
                  >
                    Book a Table
                  </BookingCTAButton>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      )}
    </CafeLayout>
  );
}
