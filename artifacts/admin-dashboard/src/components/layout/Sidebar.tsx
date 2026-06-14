import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Images,
  Tag,
  CalendarDays,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Coffee,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ownerOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/gallery", label: "Gallery", icon: Images },
  { href: "/offers", label: "Offers", icon: Tag },
  { href: "/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/staff", label: "Staff", icon: Users, ownerOnly: false },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings, ownerOnly: true },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, signOut, isOwner } = useAuth();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.ownerOnly || isOwner
  );

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sidebar-primary/20 text-sidebar-primary shrink-0">
          <Coffee className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-widest leading-none">
            Cafe Maestro
          </p>
          <p className="text-sm font-semibold text-sidebar-foreground truncate leading-tight mt-0.5">
            {user?.cafeName ?? "Loading…"}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/"
              ? location === "/" || location === ""
              : location.startsWith(item.href);

          return (
            <Link key={item.href} href={item.href}>
              <a
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "w-4.5 h-4.5 shrink-0",
                    isActive
                      ? "text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <ChevronRight className="w-3.5 h-3.5 text-sidebar-primary-foreground/60" />
                )}
              </a>
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg mb-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sidebar-primary/25 text-sidebar-primary text-xs font-bold shrink-0">
            {user?.displayName?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.displayName}
            </p>
            <p className="text-xs text-sidebar-foreground/50 capitalize">
              {user?.role}
            </p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
