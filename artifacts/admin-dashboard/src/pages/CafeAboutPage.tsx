import { Coffee } from "lucide-react";
import { motion } from "framer-motion";
import { CafeLayout } from "@/components/layout/CafeLayout";
import { usePublicCafe } from "@/hooks/usePublicBooking";
import { usePublicWebsiteSettings } from "@/hooks/usePublicWebsiteSettings";
import { BookingCTAButton } from "@/contexts/BookingModalContext";

const GOLD = "#C9A46C";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };

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
  const primaryColor = settings?.primary_color ?? "#1a1a1a";

  return (
    <CafeLayout
      cafeName={displayName}
      logoUrl={settings?.logo_url}
      primaryColor={primaryColor}
      settings={settings}
    >

      {/* ── Cinematic header ─────────────────────────────────── */}
      <div className="relative pt-36 pb-24 px-4 sm:px-6 text-center overflow-hidden" style={{ background: "#050505" }}>
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: `radial-gradient(ellipse at 50% 0%, ${GOLD}, transparent 60%)` }} />
        {isLoading ? (
          <div className="flex justify-center items-center h-24">
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }}>
              <Coffee className="w-10 h-10" style={{ color: GOLD }} />
            </motion.div>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="relative z-10 max-w-2xl mx-auto"
          >
            <motion.p variants={fadeUp} className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-5" style={{ color: GOLD }}>
              {displayName}
            </motion.p>
            <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-7" style={{ background: GOLD }} />
            <motion.h1 variants={fadeUp} className="font-serif text-5xl sm:text-6xl lg:text-7xl font-light text-white leading-tight tracking-tight">
              Our Story
            </motion.h1>
            {settings?.tagline && (
              <motion.p variants={fadeUp} className="text-white/35 mt-5 font-light text-lg">
                {settings.tagline}
              </motion.p>
            )}
          </motion.div>
        )}
      </div>

      {/* ── Story content ─────────────────────────────────────── */}
      {settings?.about_content && (
        <section className="py-24 px-4 sm:px-6" style={{ background: "#0B0B0B" }}>
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              variants={stagger}
            >
              <motion.div variants={fadeUp} className="flex items-center gap-4 mb-10">
                <div className="w-12 h-px" style={{ background: GOLD }} />
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: GOLD }}>About us</p>
              </motion.div>

              {settings.about_content.split("\n").map((line, i) =>
                line.trim() ? (
                  <motion.p
                    key={i}
                    variants={fadeUp}
                    className="text-white/55 leading-relaxed mb-5 text-[15px]"
                  >
                    {line}
                  </motion.p>
                ) : null
              )}
            </motion.div>
          </div>
        </section>
      )}

      {/* ── Values grid ───────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6" style={{ background: "#111111" }}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-14"
          >
            <motion.p variants={fadeUp} className="text-[10px] font-semibold uppercase tracking-[0.28em] mb-4" style={{ color: GOLD }}>
              What We Stand For
            </motion.p>
            <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-6" style={{ background: GOLD }} />
            <motion.h2 variants={fadeUp} className="font-serif text-3xl sm:text-4xl font-light text-white tracking-tight">
              Our Values
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-40px" }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-3 gap-5"
          >
            {VALUES.map((v) => (
              <motion.div
                key={v.title}
                variants={fadeUp}
                className="rounded-2xl p-8 border border-white/[0.06] hover:border-[#C9A46C]/20 transition-all duration-300 group"
                style={{ background: "#0B0B0B" }}
              >
                <div className="text-3xl mb-5 group-hover:scale-110 transition-transform duration-300">{v.icon}</div>
                <h3 className="font-semibold text-white mb-3">{v.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{v.body}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="py-28 px-4 sm:px-6 text-center relative overflow-hidden" style={{ background: "#0B0B0B" }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `radial-gradient(circle at 50% 50%, ${GOLD}, transparent 60%)` }} />
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={stagger}
          className="relative z-10 max-w-xl mx-auto"
        >
          <motion.div variants={fadeUp} className="w-10 h-px mx-auto mb-8" style={{ background: GOLD }} />
          <motion.h3 variants={fadeUp} className="font-serif text-3xl sm:text-4xl font-light text-white tracking-tight mb-3">
            Come visit us
          </motion.h3>
          <motion.p variants={fadeUp} className="text-white/35 text-sm mb-10">
            Reserve a table and experience it for yourself.
          </motion.p>
          <motion.div variants={fadeUp}>
            <BookingCTAButton
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-sm font-semibold text-[#050505] transition-all hover:opacity-90 active:scale-95"
              style={{ background: GOLD }}
            >
              Book a Table
            </BookingCTAButton>
          </motion.div>
        </motion.div>
      </section>
    </CafeLayout>
  );
}
