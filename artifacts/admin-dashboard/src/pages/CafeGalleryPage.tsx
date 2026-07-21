import { ImageIcon } from "lucide-react";
import { motion } from "framer-motion";
import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { usePublicGallery } from "@/hooks/usePublicGallery";

/* ── Brand palette (cream theme) ────────────────────────────────────────── */
const BG1    = "#F8F3EA";
const BG2    = "#F2E8D8";
const HEAD   = "#4B2E1F";
const BODY   = "#6D5845";
const ACCENT = "#A66A3F";
const BORDER = "#D9CBB7";
const GOLD   = "#C9A46C";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

export function CafeGalleryPage() {
  const { data: cafe, isLoading: cafeLoading } = usePublicCafe();
  const { data: settings, isLoading: settingsLoading } = usePublicWebsiteSettings(cafe?.id);
  const { data: images, isLoading: galleryLoading } = usePublicGallery(cafe?.id);

  const isLoading = cafeLoading || settingsLoading || galleryLoading;
  const displayName = settings?.cafe_name ?? cafe?.name ?? "Gallery";
  const primaryColor = settings?.primary_color ?? ACCENT;

  return (
    <CafeLayout
      cafeName={displayName}
      logoUrl={settings?.logo_url}
      primaryColor={primaryColor}
      settings={settings}
    >

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="relative pt-24 sm:pt-36 pb-12 sm:pb-20 px-4 sm:px-6 text-center overflow-hidden" style={{ background: BG1 }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `radial-gradient(ellipse at 50% 0%, ${GOLD}, transparent 55%)` }} />
        <motion.div initial="hidden" animate="show" variants={stagger} className="relative z-10 max-w-xl mx-auto">
          <motion.p variants={fadeUp} className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-4" style={{ color: ACCENT }}>
            {displayName}
          </motion.p>
          <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-6" style={{ background: GOLD }} />
          <motion.h1 variants={fadeUp} className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light leading-tight tracking-tight" style={{ color: HEAD }}>
            Gallery
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-3.5 font-light text-sm" style={{ color: BODY }}>
            A glimpse inside our world
          </motion.p>
        </motion.div>
      </div>

      {/* ── Gallery grid ────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-12 sm:py-16" style={{ background: BG2 }}>
        <div className="max-w-6xl mx-auto">
          {isLoading ? (
            <div className="columns-2 sm:columns-3 gap-3 sm:gap-4 space-y-3 sm:space-y-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="break-inside-avoid rounded-xl animate-pulse"
                  style={{ height: `${160 + (i % 3) * 55}px`, background: BORDER }} />
              ))}
            </div>
          ) : !images || images.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[45vh] gap-4">
              <ImageIcon className="w-12 h-12" style={{ color: BORDER }} />
              <p className="text-sm font-medium" style={{ color: BODY }}>No gallery images yet</p>
              <p className="text-xs" style={{ color: BORDER }}>Check back soon — we're adding photos.</p>
            </div>
          ) : (
            <motion.div initial="hidden" animate="show" variants={stagger}
              className="columns-2 sm:columns-3 gap-3 sm:gap-4 space-y-3 sm:space-y-4">
              {images.map((img) => (
                <motion.div key={img.id} variants={fadeUp}
                  className="break-inside-avoid rounded-xl overflow-hidden group cursor-pointer border"
                  style={{ borderColor: BORDER }}>
                  <div className="relative overflow-hidden">
                    <img
                      src={img.url}
                      alt={img.alt_text ?? img.caption ?? displayName}
                      className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-[1.07]"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                    {img.caption && (
                      <div className="absolute inset-x-0 bottom-0 px-3.5 py-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300"
                        style={{ background: "linear-gradient(to top, rgba(61,30,15,0.85) 0%, transparent 100%)" }}>
                        <p className="text-white text-xs font-medium">{img.caption}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </CafeLayout>
  );
}
