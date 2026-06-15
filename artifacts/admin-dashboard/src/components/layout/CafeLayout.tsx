import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Coffee, Menu as MenuIcon, X, Instagram, Facebook, MapPin, Phone, Mail } from "lucide-react";
import { useState } from "react";
import { WebsiteSettings } from "@/types";

interface CafeLayoutProps {
  cafeName: string;
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  settings?: WebsiteSettings | null;
  children: React.ReactNode;
}

export function CafeLayout({
  cafeName,
  logoUrl,
  primaryColor = "#1a1a1a",
  secondaryColor = "#f5f0eb",
  settings,
  children,
}: CafeLayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: "/cafe", label: "Home" },
    { href: "/cafe/menu", label: "Menu" },
    { href: "/book", label: "Book a Table" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-sm"
        style={{ borderColor: `${primaryColor}22` }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link href="/cafe">
            <a className="flex items-center gap-3 group">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={cafeName}
                  className="h-9 w-auto object-contain"
                />
              ) : (
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-lg"
                  style={{ background: primaryColor }}
                >
                  <Coffee className="w-5 h-5 text-white" />
                </div>
              )}
              <span className="font-bold text-lg text-gray-900 group-hover:opacity-80 transition-opacity">
                {cafeName}
              </span>
            </a>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => {
              const active = location === link.href || location.startsWith(link.href + "/");
              return (
                <Link key={link.href} href={link.href}>
                  <a
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      link.label === "Book a Table"
                        ? "text-white ml-2 px-5"
                        : active
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    )}
                    style={
                      link.label === "Book a Table"
                        ? { background: primaryColor }
                        : {}
                    }
                  >
                    {link.label}
                  </a>
                </Link>
              );
            })}
          </nav>

          {/* Mobile menu toggle */}
          <button
            className="sm:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <a
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {link.label}
                </a>
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* ── Content ────────────────────────────────────────────── */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer
        className="border-t border-gray-200 py-10"
        style={{ background: secondaryColor }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <p className="font-bold text-gray-900">{cafeName}</p>
              {settings?.tagline && (
                <p className="text-sm text-gray-500 mt-0.5">{settings.tagline}</p>
              )}
              <div className="flex flex-col gap-1 mt-3">
                {settings?.address && (
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <MapPin className="w-3.5 h-3.5 shrink-0" /> {settings.address}
                  </span>
                )}
                {settings?.phone && (
                  <a href={`tel:${settings.phone}`} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800">
                    <Phone className="w-3.5 h-3.5 shrink-0" /> {settings.phone}
                  </a>
                )}
                {settings?.email && (
                  <a href={`mailto:${settings.email}`} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800">
                    <Mail className="w-3.5 h-3.5 shrink-0" /> {settings.email}
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-3">
              <div className="flex items-center gap-3">
                {settings?.instagram_url && (
                  <a
                    href={settings.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    <Instagram className="w-4 h-4" />
                  </a>
                )}
                {settings?.facebook_url && (
                  <a
                    href={settings.facebook_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    <Facebook className="w-4 h-4" />
                  </a>
                )}
              </div>
              <p className="text-xs text-gray-400">
                © {new Date().getFullYear()} {cafeName}
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
