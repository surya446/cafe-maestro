import { motion } from "framer-motion";
import cupLogoSrc from "@assets/image_1784655126464.png";

/* ── Brand palette (mirrors CafeLayout) ─────────────────────────────────── */
const CREAM = "#F2E8D5";
const BROWN = "#3D1E0F";
const TERRA = "#8B4A2B";
const GOLD  = "#C9A46C";

interface CafeLoaderProps {
  cafeName?: string;
}

/**
 * Full-screen branded loader overlay.
 *
 * Rendered inside AnimatePresence (see CafeLayout) so that when the parent
 * removes it the exit animation (upward wipe) plays before unmount.
 *
 * The loader is position:fixed / z-[200] so the actual page content can
 * mount and prefetch data underneath while the loader is visible. When
 * `showLoader` becomes false the curtain slides away revealing a fully
 * rendered page with zero layout shift.
 */
export function CafeLoader({ cafeName = "Cup & Cozy" }: CafeLoaderProps) {
  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden select-none"
      style={{ background: CREAM }}
      initial={{ y: "0%" }}
      exit={{
        y: "-100%",
        transition: { duration: 0.72, ease: [0.76, 0, 0.24, 1] },
      }}
    >
      {/* Subtle warm radial glow at centre */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(ellipse 70% 55% at 50% 50%, rgba(139,74,43,0.055) 0%, transparent 100%)`,
        }}
      />

      {/* ── Brand mark ──────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center">

        {/* Cup logo */}
        <motion.img
          src={cupLogoSrc}
          alt={cafeName}
          className="h-[68px] w-auto object-contain"
          style={{ mixBlendMode: "multiply" }}
          initial={{ opacity: 0, scale: 0.82, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          draggable={false}
        />

        {/* Brand name */}
        <motion.p
          className="font-serif font-light tracking-[0.08em] mt-4 leading-none"
          style={{ fontSize: "clamp(22px, 5vw, 28px)", color: BROWN }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: 0.22 }}
        >
          {cafeName}
        </motion.p>

        {/* Gold expanding rule */}
        <div
          className="relative mt-4 mb-3.5 overflow-hidden"
          style={{ width: 140, height: 1 }}
        >
          <motion.div
            className="absolute inset-y-0 left-0 right-0"
            style={{ background: GOLD, originX: "50%" }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.38 }}
          />
        </div>

        {/* Establishment year */}
        <motion.p
          className="text-[9px] font-semibold tracking-[0.38em] uppercase"
          style={{ color: `${TERRA}65` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.52 }}
        >
          Est.&nbsp;&nbsp;2023
        </motion.p>
      </div>

      {/* ── Progress bar — bottom edge ───────────────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: 2, background: `${BROWN}0a` }}
      >
        <motion.div
          className="h-full"
          style={{ background: TERRA, originX: 0 }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{
            duration: 1.35,
            ease: [0.25, 0.46, 0.45, 0.94],
            delay: 0.08,
          }}
        />
      </div>
    </motion.div>
  );
}
