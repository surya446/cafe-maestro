import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coffee,
  Menu as MenuIcon,
  X,
  Instagram,
  Facebook,
  MapPin,
  Phone,
  Mail,
  Clock,
} from "lucide-react";
import { WebsiteSettings } from "@/types";
import { SmoothScrollProvider } from "@/providers/SmoothScrollProvider";
import { BookingModalProvider, useBookingModal } from "@/contexts/BookingModalContext";
import { BookingModal } from "@/components/public/BookingModal";

const GOLD = "#C9A46C";

interface CafeLayoutProps {
  cafeName: string;
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  settings?: WebsiteSettings | null;
  children: React.ReactNode;
}

const NAV_LINKS = [
  { href: "/cafe", label: "Home" },
  { href: "/cafe/menu", label: "Menu" },
  { href: "/cafe/gallery", label: "Gallery" },
  { href: "/cafe/offers", label: "Offers" },
  { href: "/cafe/reviews", label: "Reviews" },
  { href: "/cafe/about", label: "About" },
  { href: "/cafe/contact", label: "Contact" },
];

function CafeLayoutInner({
  cafeName,
  logoUrl,
  primaryColor = "#1a1a1a",
  settings,
  children,
}: CafeLayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { openBooking } = useBookingModal();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  function isActive(href: string) {
    if (href === "/cafe") return location === href;
    return location === href || location.startsWith(href + "/");
  }

  const displayName = settings?.cafe_name ?? cafeName;

  return (
    <SmoothScrollProvider>
      <div className="min-h-screen flex flex-col" style={{ background: "#050505", color: "#fff" }}>

        {/* ── HEADER ───────────────────────────────────────────── */}
        <header
          className={cn(
            "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out",
            scrolled
              ? "bg-[#050505]/90 backdrop-blur-xl border-b border-white/[0.06]"
              : "bg-transparent"
          )}
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-8 h-[72px] flex items-center justify-between gap-6">

            {/* Brand */}
            <Link
              href="/cafe"
              className="flex items-center gap-3 shrink-0 group"
              aria-label={`${displayName} — home`}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={displayName}
                  className="h-9 w-auto object-contain brightness-0 invert opacity-90 group-hover:opacity-100 transition-opacity"
                  loading="eager"
                />
              ) : (
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
                  style={{ background: GOLD }}
                >
                  <Coffee className="w-4 h-4 text-[#050505]" />
                </div>
              )}
              <span className="font-serif font-semibold text-lg text-white tracking-tight hidden sm:block group-hover:text-white/70 transition-colors">
                {displayName}
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center" aria-label="Main navigation">
              {NAV_LINKS.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "relative px-3.5 py-2 text-[13px] font-medium tracking-[0.02em] transition-colors duration-200 group rounded-md",
                      active ? "text-white" : "text-white/45 hover:text-white"
                    )}
                  >
                    {link.label}
                    <span
                      className={cn(
                        "absolute bottom-1 left-3.5 right-3.5 h-px rounded-full transition-transform duration-300 ease-out origin-left",
                        active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                      )}
                      style={{ background: GOLD }}
                    />
                  </Link>
                );
              })}
            </nav>

            {/* CTA + hamburger */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={openBooking}
                className="hidden sm:inline-flex items-center px-5 py-2 rounded-full text-[13px] font-semibold transition-all hover:opacity-90 active:scale-95"
                style={{ background: GOLD, color: "#050505" }}
              >
                Book Table
              </button>
              <button
                className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={mobileOpen}
              >
                <MenuIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* ── MOBILE DRAWER ────────────────────────────────────── */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                key="cafe-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] lg:hidden"
                onClick={() => setMobileOpen(false)}
              />
              <motion.div
                key="cafe-drawer"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 280, mass: 0.9 }}
                className="fixed inset-y-0 right-0 w-full max-w-[340px] z-[70] flex flex-col shadow-2xl lg:hidden"
                style={{ background: "#0B0B0B" }}
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
              >
                <div className="flex items-center justify-between px-6 h-[72px] border-b border-white/[0.08] shrink-0">
                  <Link
                    href="/cafe"
                    onClick={() => setMobileOpen(false)}
                    className="font-serif font-semibold text-xl tracking-tight text-white"
                  >
                    {displayName}
                  </Link>
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
                    aria-label="Close menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <nav className="flex-1 px-6 py-6 overflow-y-auto" aria-label="Mobile navigation">
                  {NAV_LINKS.map((link, i) => {
                    const active = isActive(link.href);
                    return (
                      <motion.div
                        key={link.href}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.04 + i * 0.05, type: "spring", stiffness: 320, damping: 30 }}
                      >
                        <Link
                          href={link.href}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "flex items-center justify-between py-4 border-b border-white/[0.07] transition-colors",
                            active ? "text-white" : "text-white/40 hover:text-white"
                          )}
                        >
                          <span className="font-serif text-[22px] font-medium tracking-tight leading-none">
                            {link.label}
                          </span>
                          {active && (
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: GOLD }} />
                          )}
                        </Link>
                      </motion.div>
                    );
                  })}
                </nav>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.42, type: "spring", stiffness: 280, damping: 28 }}
                  className="p-6 border-t border-white/[0.08] shrink-0"
                >
                  <button
                    onClick={() => { setMobileOpen(false); openBooking(); }}
                    className="flex items-center justify-center w-full py-3.5 rounded-full text-[13px] font-semibold transition-opacity hover:opacity-90 active:opacity-75"
                    style={{ background: GOLD, color: "#050505" }}
                  >
                    Book a Table
                  </button>
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── PAGE CONTENT ─────────────────────────────────────── */}
        <main className="flex-1" id="main-content">
          {children}
        </main>

        {/* ── FOOTER ───────────────────────────────────────────── */}
        <footer style={{ background: "#050505", borderTop: "1px solid rgba(255,255,255,0.06)" }} aria-label="Site footer">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-16 pb-10">

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 pb-12 border-b border-white/[0.06]">

              {/* Col 1 — Brand */}
              <div>
                <div className="flex items-center gap-3 mb-5">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={displayName}
                      className="h-9 w-auto object-contain brightness-0 invert opacity-70"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg" style={{ background: GOLD }}>
                      <Coffee className="w-4 h-4 text-[#050505]" />
                    </div>
                  )}
                </div>
                <p className="font-serif text-[26px] font-medium text-white leading-snug tracking-tight">
                  {displayName}
                </p>
                {settings?.tagline && (
                  <p className="text-sm text-white/40 leading-relaxed mt-2.5 max-w-[220px]">
                    {settings.tagline}
                  </p>
                )}
                <div className="flex items-center gap-2.5 mt-7">
                  {settings?.instagram_url && (
                    <a
                      href={settings.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-9 h-9 rounded-full border border-white/[0.08] text-white/40 hover:border-[#C9A46C]/50 hover:text-[#C9A46C] transition-colors"
                      aria-label="Instagram"
                    >
                      <Instagram className="w-4 h-4" />
                    </a>
                  )}
                  {settings?.facebook_url && (
                    <a
                      href={settings.facebook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-9 h-9 rounded-full border border-white/[0.08] text-white/40 hover:border-[#C9A46C]/50 hover:text-[#C9A46C] transition-colors"
                      aria-label="Facebook"
                    >
                      <Facebook className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>

              {/* Col 2 — Navigation */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25 mb-6">
                  Explore
                </p>
                <nav className="flex flex-col gap-3" aria-label="Footer navigation">
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-sm text-white/45 hover:text-white transition-colors tracking-wide w-fit"
                    >
                      {link.label}
                    </Link>
                  ))}
                  <button
                    onClick={openBooking}
                    className="text-sm text-white/45 hover:text-[#C9A46C] transition-colors tracking-wide w-fit text-left"
                  >
                    Book a Table
                  </button>
                </nav>
              </div>

              {/* Col 3 — Contact + Hours */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25 mb-6">
                  Find Us
                </p>
                <div className="space-y-3.5">
                  {settings?.address && (
                    <div className="flex items-start gap-3">
                      <MapPin className="w-3.5 h-3.5 text-white/25 mt-0.5 shrink-0" />
                      <span className="text-sm text-white/50 leading-relaxed">{settings.address}</span>
                    </div>
                  )}
                  {settings?.phone && (
                    <a href={`tel:${settings.phone}`} className="flex items-center gap-3 group">
                      <Phone className="w-3.5 h-3.5 text-white/25 shrink-0" />
                      <span className="text-sm text-white/50 group-hover:text-white transition-colors">
                        {settings.phone}
                      </span>
                    </a>
                  )}
                  {settings?.email && (
                    <a href={`mailto:${settings.email}`} className="flex items-center gap-3 group">
                      <Mail className="w-3.5 h-3.5 text-white/25 shrink-0" />
                      <span className="text-sm text-white/50 group-hover:text-white transition-colors">
                        {settings.email}
                      </span>
                    </a>
                  )}
                  {Array.isArray(settings?.opening_hours) && settings!.opening_hours.length > 0 && (() => {
                    const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
                    const todayEntry = settings!.opening_hours.find((h) => h.day === today);
                    if (!todayEntry) return null;
                    return (
                      <div className="flex items-center gap-3">
                        <Clock className="w-3.5 h-3.5 text-white/25 shrink-0" />
                        <span className="text-sm text-white/50">
                          Today: {todayEntry.closed ? "Closed" : `${todayEntry.open} – ${todayEntry.close}`}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-white/20">
                © {new Date().getFullYear()} {displayName}. All rights reserved.
              </p>
              {settings?.google_maps_url && (
                <a
                  href={settings.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-white/20 hover:text-white/50 transition-colors"
                >
                  Get directions →
                </a>
              )}
            </div>
          </div>
        </footer>

        {/* ── BOOKING MODAL ────────────────────────────────────── */}
        <BookingModal />
      </div>
    </SmoothScrollProvider>
  );
}

export function CafeLayout(props: CafeLayoutProps) {
  return (
    <BookingModalProvider>
      <CafeLayoutInner {...props} />
    </BookingModalProvider>
  );
}
