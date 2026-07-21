import { Coffee } from "lucide-react";
import { motion } from "framer-motion";
import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { BookingCTAButton } from "@/contexts/BookingModalContext";

/* ── Brand palette (cream theme) ────────────────────────────────────────── */
const BG1    = "#F8F3EA";   /* primary background */
const BG2    = "#F2E8D8";   /* alternate section  */
const CARD   = "#FFFDF8";   /* card surface       */
const HEAD   = "#4B2E1F";   /* headings           */
const BODY   = "#6D5845";   /* body / muted text  */
const ACCENT = "#A66A3F";   /* accent / eyebrow   */
const BORDER = "#D9CBB7";   /* borders            */
const GOLD   = "#C9A46C";   /* decorative lines   */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };

const VALUES = [
  { icon: "☕", title: "Craft & Quality", body: "Every cup is a deliberate act. We source, roast, and brew with intention." },
  { icon: "🌿", title: "Sourced Responsibly", body: "Direct trade relationships with farmers who share our values." },
  { icon: "✦", title: "Refined Experience", body: "From the first sip to the last, every detail of your visit is considered." },
];

export function CafeAboutPage() {
  const { data: cafe, isLoading: cafeLoading } = usePublicCafe();
  const { data: settings, isLoading: settingsLoading } = usePublicWebsiteSettings(cafe?.id);
  const isLoading = cafeLoading || settingsLoading;
  const displayName = settings?.cafe_name ?? cafe?.name ?? "About";
  const primaryColor = settings?.primary_color ?? ACCENT;

  return (
    <CafeLayout
      cafeName={displayName}
      logoUrl={settings?.logo_url}
      primaryColor={primaryColor}
      settings={settings}
    >

      {/* ── Cinematic header ─────────────────────────────────── */}
      <div className="relative pt-24 sm:pt-36 pb-12 sm:pb-20 px-4 sm:px-6 text-center overflow-hidden" style={{ background: BG1 }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `radial-gradient(ellipse at 50% 0%, ${GOLD}, transparent 58%)` }} />
        {isLoading ? (
          <div className="flex justify-center items-center h-20">
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }}>
              <Coffee className="w-9 h-9" style={{ color: ACCENT }} />
            </motion.div>
          </div>
        ) : (
          <motion.div initial="hidden" animate="show" variants={stagger} className="relative z-10 max-w-xl mx-auto">
            <motion.p variants={fadeUp} className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-4" style={{ color: ACCENT }}>
              {displayName}
            </motion.p>
            <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-6" style={{ background: GOLD }} />
            <motion.h1 variants={fadeUp} className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light leading-tight tracking-tight" style={{ color: HEAD }}>
              Our Story
            </motion.h1>
            {settings?.tagline && (
              <motion.p variants={fadeUp} className="mt-4 font-light text-sm sm:text-base" style={{ color: BODY }}>
                {settings.tagline}
              </motion.p>
            )}
          </motion.div>
        )}
      </div>

      {/* ── Story content ─────────────────────────────────────── */}
      {settings?.about_content && (
        <section className="py-14 sm:py-22 px-4 sm:px-6" style={{ background: BG2 }}>
          <div className="max-w-3xl mx-auto">
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-50px" }} variants={stagger}>
              <motion.div variants={fadeUp} className="flex items-center gap-4 mb-8 sm:mb-10">
                <div className="w-10 h-px" style={{ background: GOLD }} />
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: ACCENT }}>About us</p>
              </motion.div>
              {settings.about_content.split("\n").map((line, i) =>
                line.trim() ? (
                  <motion.p key={i} variants={fadeUp} className="leading-relaxed mb-4 sm:mb-5 text-[15px]" style={{ color: BODY }}>
                    {line}
                  </motion.p>
                ) : null
              )}
            </motion.div>
          </div>
        </section>
      )}

      {/* ── Values grid ───────────────────────────────────────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6" style={{ background: BG1 }}>
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="text-center mb-10 sm:mb-14">
            <motion.p variants={fadeUp} className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-4" style={{ color: ACCENT }}>
              What We Stand For
            </motion.p>
            <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-6" style={{ background: GOLD }} />
            <motion.h2 variants={fadeUp} className="font-serif text-2xl sm:text-3xl lg:text-4xl font-light tracking-tight" style={{ color: HEAD }}>
              Our Values
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-40px" }} variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
            {VALUES.map((v) => (
              <motion.div key={v.title} variants={fadeUp}
                className="rounded-2xl p-5 sm:p-7 border transition-all duration-300 group hover:shadow-sm"
                style={{ background: CARD, borderColor: BORDER }}>
                <div className="text-3xl mb-4 group-hover:scale-110 transition-transform duration-300">{v.icon}</div>
                <h3 className="font-semibold mb-2 text-sm sm:text-base" style={{ color: HEAD }}>{v.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: BODY }}>{v.body}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="py-16 sm:py-28 px-4 sm:px-6 text-center relative overflow-hidden" style={{ background: BG2 }}>
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: `radial-gradient(circle at 50% 50%, ${GOLD}, transparent 60%)` }} />
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}
          className="relative z-10 max-w-xl mx-auto">
          <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-7" style={{ background: GOLD }} />
          <motion.h3 variants={fadeUp} className="font-serif text-2xl sm:text-3xl lg:text-4xl font-light tracking-tight mb-3" style={{ color: HEAD }}>
            Come visit us
          </motion.h3>
          <motion.p variants={fadeUp} className="text-sm mb-8 sm:mb-10" style={{ color: BODY }}>
            Reserve a table and experience it for yourself.
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
      </section>
    </CafeLayout>
  );
}
