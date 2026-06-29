import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { ScrollToTop } from "@/components/common/ScrollToTop";
import { AppLayout } from "@/components/layout/AppLayout";

import { LoginPage } from "@/pages/LoginPage";
import { AuthConfirmPage } from "@/pages/AuthConfirmPage";
import { BookingFormPage } from "@/pages/BookingFormPage";
import { TableSessionPage } from "@/pages/TableSessionPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { MenuPage } from "@/pages/MenuPage";
import { GalleryPage } from "@/pages/GalleryPage";
import { OffersPage } from "@/pages/OffersPage";
import { BookingsPage } from "@/pages/BookingsPage";
import { StaffPage } from "@/pages/StaffPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { WebsiteSettingsPage } from "@/pages/WebsiteSettingsPage";
import { CafePage } from "@/pages/CafePage";
import { CafeMenuPage } from "@/pages/CafeMenuPage";
import { CafeGalleryPage } from "@/pages/CafeGalleryPage";
import { CafeOffersPage } from "@/pages/CafeOffersPage";
import { CafeReviewsPage } from "@/pages/CafeReviewsPage";
import { CafeAboutPage } from "@/pages/CafeAboutPage";
import { CafeContactPage } from "@/pages/CafeContactPage";
import { ChangePasswordPage } from "@/pages/ChangePasswordPage";
import { TablesPage } from "@/pages/TablesPage";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

/**
 * AdminShell — renders AppLayout ONCE for all protected routes.
 *
 * Previously every page component rendered its own <AppLayout>, so
 * every Wouter navigation unmounted the old page's AppLayout+Sidebar
 * and mounted a fresh one. The fresh Sidebar called useAuth() which
 * initialises with loading:true / user:null, causing "Loading…" and
 * missing nav items on every navigation.
 *
 * Now AppLayout (and Sidebar) mount once when the user first reaches a
 * protected route and never unmount during navigation — only the inner
 * Switch changes.
 */
function AdminShell() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Redirect to="/login" />;
  if (user.mustChangePassword) return <Redirect to="/change-password" />;

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/orders" component={OrdersPage} />
        <Route path="/menu" component={MenuPage} />
        <Route path="/gallery" component={GalleryPage} />
        <Route path="/offers" component={OffersPage} />
        <Route path="/bookings" component={BookingsPage} />
        <Route path="/tables" component={TablesPage} />
        <Route path="/staff" component={StaffPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/website-settings" component={WebsiteSettingsPage} />
        <Route><Redirect to="/" /></Route>
      </Switch>
    </AppLayout>
  );
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
        {/* Public routes — matched first so they never reach AdminShell */}
        <Route path="/login" component={LoginPage} />
        <Route path="/auth/confirm" component={AuthConfirmPage} />
        <Route path="/change-password" component={ChangePasswordPage} />
        <Route path="/book" component={BookingFormPage} />
        <Route path="/table/:token" component={TableSessionPage} />
        <Route path="/cafe/menu" component={CafeMenuPage} />
        <Route path="/cafe/gallery" component={CafeGalleryPage} />
        <Route path="/cafe/offers" component={CafeOffersPage} />
        <Route path="/cafe/reviews" component={CafeReviewsPage} />
        <Route path="/cafe/about" component={CafeAboutPage} />
        <Route path="/cafe/contact" component={CafeContactPage} />
        <Route path="/cafe" component={CafePage} />
        {/* All protected admin routes share one persistent AppLayout */}
        <Route component={AdminShell} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
