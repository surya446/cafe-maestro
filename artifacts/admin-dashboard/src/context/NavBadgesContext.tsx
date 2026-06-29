import { createContext, useContext } from "react";
import { useNavBadges } from "@/hooks/useNavBadges";

interface NavBadgesContextValue {
  pendingOrderCount: number;
  pendingBillCount: number;
  sessionCount: number;
}

const NavBadgesContext = createContext<NavBadgesContextValue>({
  pendingOrderCount: 0,
  pendingBillCount: 0,
  sessionCount: 0,
});

/**
 * NavBadgesProvider
 *
 * Mount once at AdminShell level so badges are always live, regardless of
 * which admin page is currently displayed.  Child components call
 * useNavBadgesContext() to read the counts without touching QueryClient or
 * creating any new observers.
 */
export function NavBadgesProvider({ children }: { children: React.ReactNode }) {
  const counts = useNavBadges();
  return (
    <NavBadgesContext.Provider value={counts}>
      {children}
    </NavBadgesContext.Provider>
  );
}

export function useNavBadgesContext() {
  return useContext(NavBadgesContext);
}
