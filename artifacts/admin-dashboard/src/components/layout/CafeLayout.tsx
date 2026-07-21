import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu as MenuIcon,
  X,
  Instagram,
  Facebook,
  MapPin,
  Phone,
  Globe,
  Heart,
} from "lucide-react";
import { WebsiteSettings } from "@/types";
import { SmoothScrollProvider } from "@/providers/SmoothScrollProvider";
import { BookingModalProvider, useBookingModal } from "@/contexts/BookingModalContext";
import { BookingModal } from "@/components/public/BookingModal";

/* ── Brand palette ──────────────────────────────────────────────────────── */
const CREAM   = "#F2E8D5";
const BROWN   = "#3D1E0F";
const TERRA   = "#8B4A2B";   /* terracotta — primary accent & buttons */
const MID     = "#6B3A2A";   /* body text */

interface CafeLayoutProps {
  cafeName: string;
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  settings?: WebsiteSettings | null;
  children: React.ReactNode;
}

const NAV_LINKS = [
  { href: "/cafe",         label: "HOME"      },
  { href: "/cafe/about",   label: "OUR STORY" },
  { href: "/cafe/menu",    label: "MENU"      },
  { href: "/cafe/gallery", label: "GALLERY"   },
  { href: "/cafe/contact", label: "FIND US"   },
];

function CafeLayoutInner({
  cafeName,
  logoUrl,
  settings,
  children,
}: CafeLayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { openBooking } = useBookingModal();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
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
      <div className="min-h-screen flex flex-col" style={{ background: CREAM, color: BROWN }}>

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <header
          className={cn(
            "fixed top-0 left-0 right-0 z-50 transition-all duration-400",
            scrolled
              ? "shadow-sm"
              : ""
          )}
          style={{
            background: scrolled ? `${CREAM}f0` : CREAM,
            backdropFilter: scrolled ? "blur(12px)" : "none",
            borderBottom: scrolled ? `1px solid rgba(61,30,15,0.1)` : "none",
          }}
        >
          <div className="max-w-7xl mx-auto px-6 sm:px-10 h-[68px] flex items-center justify-between gap-6">

            {/* Brand */}
            <Link
              href="/cafe"
              className="flex items-center gap-2.5 shrink-0 group"
              aria-label={`${displayName} — home`}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={displayName}
                  className="h-9 w-auto object-contain"
                  loading="eager"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Heart className="w-7 h-7" style={{ color: TERRA }} strokeWidth={1.5} />
                  <span
                    className="font-serif font-semibold text-xl tracking-tight"
                    style={{ color: BROWN }}
                  >
                    {displayName}
                  </span>
                </div>
              )}
            </Link>

            {/* Desktop nav — pipe-separated */}
            <nav className="hidden lg:flex items-center gap-0 flex-1 justify-center" aria-label="Main navigation">
              {NAV_LINKS.map((link, i) => {
                const active = isActive(link.href);
                return (
                  <div key={link.href} className="flex items-center">
                    {i > 0 && (
                      <span className="mx-2.5 text-sm select-none" style={{ color: `${BROWN}50` }}>|</span>
                    )}
                    <Link
                      href={link.href}
                      className={cn(
                        "relative text-[12px] font-semibold tracking-[0.12em] transition-colors duration-200 pb-0.5",
                        active ? "" : "opacity-55 hover:opacity-100"
                      )}
                      style={{
                        color: BROWN,
                        borderBottom: active ? `2px solid ${TERRA}` : "2px solid transparent",
                      }}
                    >
                      {link.label}
                    </Link>
                  </div>
                );
              })}
              {/* pipe before RESERVE */}
              <span className="mx-2.5 text-sm select-none" style={{ color: `${BROWN}50` }}>|</span>
              <button
                onClick={openBooking}
                className="text-[12px] font-semibold tracking-[0.12em] opacity-55 hover:opacity-100 transition-opacity pb-0.5"
                style={{ color: BROWN, borderBottom: "2px solid transparent" }}
              >
                RESERVE
              </button>
            </nav>

            {/* Mobile hamburger */}
            <button
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
              style={{ color: BROWN }}
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ── MOBILE DRAWER ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                key="cafe-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="fixed inset-0 z-[60] lg:hidden"
                style={{ background: "rgba(61,30,15,0.45)" }}
                onClick={() => setMobileOpen(false)}
              />
              <motion.div
                key="cafe-drawer"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 280, mass: 0.9 }}
                className="fixed inset-y-0 right-0 w-full max-w-[320px] z-[70] flex flex-col shadow-2xl lg:hidden"
                style={{ background: CREAM }}
                role="dialog"
                aria-modal="true"
              >
                <div
                  className="flex items-center justify-between px-6 h-[68px] border-b shrink-0"
                  style={{ borderColor: `${BROWN}18` }}
                >
                  <span className="font-serif font-semibold text-xl" style={{ color: BROWN }}>{displayName}</span>
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
                    style={{ color: MID }}
                    aria-label="Close menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <nav className="flex-1 px-6 py-6 overflow-y-auto" aria-label="Mobile navigation">
                  {[...NAV_LINKS, { href: "#reserve", label: "RESERVE" }].map((link, i) => {
                    const active = link.href !== "#reserve" && isActive(link.href);
                    if (link.href === "#reserve") {
                      return (
                        <motion.div
                          key="reserve"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.04 + i * 0.05 }}
                        >
                          <button
                            onClick={() => { setMobileOpen(false); openBooking(); }}
                            className="flex items-center justify-between w-full py-4 border-b transition-colors text-left"
                            style={{ borderColor: `${BROWN}12`, color: TERRA }}
                          >
                            <span className="font-serif text-[22px] font-medium tracking-tight leading-none">Reserve</span>
                          </button>
                        </motion.div>
                      );
                    }
                    return (
                      <motion.div
                        key={link.href}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.04 + i * 0.05 }}
                      >
                        <Link
                          href={link.href}
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center justify-between py-4 border-b transition-colors"
                          style={{
                            borderColor: `${BROWN}12`,
                            color: active ? TERRA : MID,
                          }}
                        >
                          <span className="font-serif text-[22px] font-medium tracking-tight leading-none">
                            {link.label.charAt(0) + link.label.slice(1).toLowerCase()}
                          </span>
                          {active && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: TERRA }} />}
                        </Link>
                      </motion.div>
                    );
                  })}
                </nav>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── PAGE CONTENT ───────────────────────────────────────────────── */}
        <main className="flex-1" id="main-content">
          {children}
        </main>

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <footer
          style={{ background: `${BROWN}f8`, color: "#fff", borderTop: `1px solid rgba(255,255,255,0.07)` }}
          aria-label="Site footer"
        >
          <div className="max-w-7xl mx-auto px-6 sm:px-10 h-[58px] flex items-center justify-between gap-4">

            {/* Left — copyright */}
            <p className="text-[11px] text-white/30 shrink-0">
              © {new Date().getFullYear()} {displayName}
            </p>

            {/* Center — phone + website */}
            <div className="flex items-center gap-4 overflow-hidden">
              {settings?.phone && (
                <a href={`tel:${settings.phone}`} className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition-colors">
                  <Phone className="w-3 h-3 shrink-0" />
                  <span className="truncate">{settings.phone}</span>
                </a>
              )}
              <div className="hidden sm:flex items-center gap-1 text-[11px] text-white/30">
                <Globe className="w-3 h-3 shrink-0" />
                <span>www.cupandcozy.com</span>
              </div>
            </div>

            {/* Right — social icons */}
            <div className="flex items-center gap-2 shrink-0">
              {settings?.facebook_url ? (
                <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center w-7 h-7 rounded-full border border-white/15 text-white/40 hover:text-white/80 hover:border-white/35 transition-colors"
                  aria-label="Facebook">
                  <Facebook className="w-3 h-3" />
                </a>
              ) : (
                <span className="flex items-center justify-center w-7 h-7 rounded-full border border-white/10 text-white/20">
                  <Facebook className="w-3 h-3" />
                </span>
              )}
              {settings?.instagram_url ? (
                <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center w-7 h-7 rounded-full border border-white/15 text-white/40 hover:text-white/80 hover:border-white/35 transition-colors"
                  aria-label="Instagram">
                  <Instagram className="w-3 h-3" />
                </a>
              ) : (
                <span className="flex items-center justify-center w-7 h-7 rounded-full border border-white/10 text-white/20">
                  <Instagram className="w-3 h-3" />
                </span>
              )}
            </div>

          </div>
        </footer>

        {/* ── BOOKING MODAL ──────────────────────────────────────────────── */}
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
