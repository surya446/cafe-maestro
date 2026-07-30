import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useParams } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScrollToTop } from "@/components/common/ScrollToTop";
import { AppUpdateProvider } from "@/context/AppUpdateContext";
import { MandatoryUpdateGate } from "@/components/updates/MandatoryUpdateGate";
import { OfflineBanner } from "@/components/native/OfflineBanner";
import { installExternalLinkHandler } from "@/native/externalLinks";
import { AdminShell } from "@/AdminShell";
import { ROUTES } from "@/lib/routes";

import { LoginPage } from "@/pages/LoginPage";
import { AuthConfirmPage } from "@/pages/AuthConfirmPage";
import { BookingFormPage } from "@/pages/BookingFormPage";
import { TableSessionPage } from "@/pages/TableSessionPage";
import { CafePage } from "@/pages/CafePage";
import { CafeMenuPage } from "@/pages/CafeMenuPage";
import { CafeGalleryPage } from "@/pages/CafeGalleryPage";
import { CafeOffersPage } from "@/pages/CafeOffersPage";
import { CafeReviewsPage } from "@/pages/CafeReviewsPage";
import { CafeAboutPage } from "@/pages/CafeAboutPage";
import { CafeContactPage } from "@/pages/CafeContactPage";
import { ChangePasswordPage } from "@/pages/ChangePasswordPage";

/**
 * Preserves the token when redirecting printed QR codes from the old URL
 * structure (/admin/table/:token) to the new one (/table/:token).
 * Keep this redirect permanently — physical QR codes are not self-updating.
 */
function AdminTableRedirect() {
  const { token } = useParams<{ token: string }>();
  return <Redirect to={ROUTES.TABLE(token)} />;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
        {/* ── Auth ────────────────────────────────────────────────────────── */}
        <Route path={ROUTES.LOGIN}           component={LoginPage} />
        <Route path={ROUTES.AUTH_CONFIRM}    component={AuthConfirmPage} />
        <Route path={ROUTES.CHANGE_PASSWORD} component={ChangePasswordPage} />

        {/* ── Customer ordering ───────────────────────────────────────────── */}
        <Route path="/table/:token"          component={TableSessionPage} />
        <Route path={ROUTES.BOOK}            component={BookingFormPage} />

        {/* ── Public website ──────────────────────────────────────────────── */}
        <Route path={ROUTES.HOME}            component={CafePage} />
        <Route path={ROUTES.ABOUT}           component={CafeAboutPage} />
        <Route path={ROUTES.MENU}            component={CafeMenuPage} />
        <Route path={ROUTES.GALLERY}         component={CafeGalleryPage} />
        <Route path={ROUTES.OFFERS}          component={CafeOffersPage} />
        <Route path={ROUTES.REVIEWS}         component={CafeReviewsPage} />
        <Route path={ROUTES.CONTACT}         component={CafeContactPage} />

        {/* ── Backward-compat redirects ────────────────────────────────────
            /admin/table/:token  — keep permanently (printed QR codes)
            /admin/cafe/*        — keep for ~6 months, then remove          */}
        <Route path="/admin/table/:token"    component={AdminTableRedirect} />
        <Route path="/admin/cafe/about">   <Redirect to={ROUTES.ABOUT}   /></Route>
        <Route path="/admin/cafe/menu">    <Redirect to={ROUTES.MENU}    /></Route>
        <Route path="/admin/cafe/gallery"> <Redirect to={ROUTES.GALLERY} /></Route>
        <Route path="/admin/cafe/offers">  <Redirect to={ROUTES.OFFERS}  /></Route>
        <Route path="/admin/cafe/reviews"> <Redirect to={ROUTES.REVIEWS} /></Route>
        <Route path="/admin/cafe/contact"> <Redirect to={ROUTES.CONTACT} /></Route>
        <Route path="/admin/cafe">         <Redirect to={ROUTES.HOME}    /></Route>
        <Route path="/admin/book">         <Redirect to={ROUTES.BOOK}    /></Route>
        <Route path="/admin/login">        <Redirect to={ROUTES.LOGIN}   /></Route>

        {/* ── Admin (protected, persistent layout) ────────────────────────── */}
        <Route component={AdminShell} />
      </Switch>
    </>
  );
}

function App() {
  useEffect(() => {
    installExternalLinkHandler();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppUpdateProvider>
          <OfflineBanner />
          <MandatoryUpdateGate>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </MandatoryUpdateGate>
        </AppUpdateProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
