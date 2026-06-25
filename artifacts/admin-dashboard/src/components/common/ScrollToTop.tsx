import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Resets the window scroll position to the top on every route change.
 * Uses "instant" behaviour so the page is already at the top before
 * the new content becomes visible.  Must be rendered inside <WouterRouter>.
 */
export function ScrollToTop() {
  const [pathname] = useLocation();

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}
