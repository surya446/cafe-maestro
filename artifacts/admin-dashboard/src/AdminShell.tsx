import { Switch, Route, Redirect } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { NavBadgesProvider } from "@/context/NavBadgesContext";
import { AppUpdateGate } from "@/components/updates/AppUpdateGate";
import { useDeviceTracking } from "@/hooks/useDeviceTracking";
import { useAppResume } from "@/hooks/useAppResume";
import { ROUTES } from "@/lib/routes";

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
import { TablesPage } from "@/pages/TablesPage";
import { DownloadsPage } from "@/pages/DownloadsPage";

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
 * AdminShell — renders AppLayout ONCE for all protected admin routes.
 *
 * AppLayout (and Sidebar) mount once when the user first reaches an admin
 * route and never unmount during navigation — only the inner Switch changes.
 * This prevents the "Loading…" flash that occurred when each page rendered
 * its own AppLayout and every navigation re-initialised the auth hook.
 */
export function AdminShell() {
  const { user, loading } = useAuth();
  useDeviceTracking();
  useAppResume(user?.id);

  if (loading) return <LoadingScreen />;
  if (!user) return <Redirect to={ROUTES.LOGIN} />;
  if (user.mustChangePassword) return <Redirect to={ROUTES.CHANGE_PASSWORD} />;

  return (
    <NavBadgesProvider>
      <AppUpdateGate />
      <AppLayout>
        <Switch>
          <Route path={ROUTES.ADMIN.ROOT}             component={DashboardPage} />
          <Route path={ROUTES.ADMIN.ORDERS}           component={OrdersPage} />
          <Route path={ROUTES.ADMIN.MENU}             component={MenuPage} />
          <Route path={ROUTES.ADMIN.GALLERY}          component={GalleryPage} />
          <Route path={ROUTES.ADMIN.OFFERS}           component={OffersPage} />
          <Route path={ROUTES.ADMIN.BOOKINGS}         component={BookingsPage} />
          <Route path={ROUTES.ADMIN.TABLES}           component={TablesPage} />
          <Route path={ROUTES.ADMIN.STAFF}            component={StaffPage} />
          <Route path={ROUTES.ADMIN.ANALYTICS}        component={AnalyticsPage} />
          <Route path={ROUTES.ADMIN.SETTINGS}         component={SettingsPage} />
          <Route path={ROUTES.ADMIN.WEBSITE_SETTINGS} component={WebsiteSettingsPage} />
          <Route path={ROUTES.ADMIN.DOWNLOADS}        component={DownloadsPage} />
          <Route><Redirect to={ROUTES.ADMIN.ROOT} /></Route>
        </Switch>
      </AppLayout>
    </NavBadgesProvider>
  );
}
