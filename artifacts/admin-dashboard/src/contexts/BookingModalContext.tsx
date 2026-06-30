import { createContext, useContext, useState } from "react";

interface BookingModalContextValue {
  isOpen: boolean;
  openBooking: () => void;
  closeBooking: () => void;
}

const BookingModalContext = createContext<BookingModalContextValue>({
  isOpen: false,
  openBooking: () => {},
  closeBooking: () => {},
});

export function BookingModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <BookingModalContext.Provider
      value={{
        isOpen,
        openBooking: () => setIsOpen(true),
        closeBooking: () => setIsOpen(false),
      }}
    >
      {children}
    </BookingModalContext.Provider>
  );
}

export function useBookingModal() {
  return useContext(BookingModalContext);
}

/**
 * A button that opens the booking modal.
 *
 * IMPORTANT: This component MUST be used instead of calling
 * useBookingModal() directly in page components. Page components
 * (CafePage, CafeAboutPage, etc.) render <CafeLayout> which
 * contains the BookingModalProvider. Calling useBookingModal() at
 * the page level captures the default noop context because the hook
 * runs before CafeLayout's provider is in the tree.
 *
 * This component calls useBookingModal() when it renders — which is
 * inside the provider — so it always gets the real openBooking.
 */
export function BookingCTAButton({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { openBooking } = useBookingModal();
  return (
    <button onClick={openBooking} className={className} style={style}>
      {children}
    </button>
  );
}
