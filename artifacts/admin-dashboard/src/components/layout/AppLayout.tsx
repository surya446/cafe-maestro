import { useState } from "react";
import { Menu, ChevronLeft, ChevronRight } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useAuth } from "@/hooks/useAuth";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Floating sidebar edge toggle — desktop only */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden md:flex fixed z-40 top-1/2 -translate-y-1/2 items-center justify-center w-6 h-6 rounded-full bg-sidebar text-sidebar-foreground border border-sidebar-border shadow-md hover:bg-sidebar-primary hover:text-sidebar-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-150"
        style={{
          left: collapsed ? "calc(4rem - 12px)" : "calc(13rem - 12px)",
          transition: "left 300ms ease-in-out, background-color 150ms, color 150ms",
        }}
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3 shrink-0" />
          : <ChevronLeft  className="w-3 h-3 shrink-0" />
        }
      </button>

      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center h-14 px-4 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-30 shrink-0 shadow-sm">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="ml-3 text-sm font-semibold text-foreground">{user?.cafeName ?? "Loading…"}</span>
        </header>

        <main className="flex-1 min-w-0 overflow-auto">
          <div className="px-4 py-4 md:px-6 md:py-5 max-w-screen-2xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
