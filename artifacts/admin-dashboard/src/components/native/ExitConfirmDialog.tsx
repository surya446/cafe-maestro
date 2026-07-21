/**
 * ExitConfirmDialog — "are you sure you want to exit?" overlay.
 *
 * TV-remote navigation:
 *   LEFT / RIGHT  → move focus between Cancel and Exit buttons.
 *   ENTER / OK    → activate the focused button (native button behaviour).
 *   BACK / ESC    → closes the dialog (handled by Radix AlertDialog + AndroidBackHandler).
 *
 * Focus is given to "Cancel" automatically when the dialog opens (Radix
 * AlertDialog focuses the first focusable element in DOM order, which is
 * AlertDialogCancel since it appears first in the footer markup).
 *
 * ArrowLeft/Right events are stopped from propagating so TvKitchenPage's
 * board-scroll keydown listener never sees them while the dialog is open.
 */

import { useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ExitConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExit: () => void;
}

export function ExitConfirmDialog({ open, onOpenChange, onExit }: ExitConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const exitRef   = useRef<HTMLButtonElement>(null);

  /**
   * Handle TV remote arrow navigation between the two buttons.
   * stopPropagation() prevents TvKitchenPage's document-level listener
   * from treating these as board-scroll commands while the dialog is visible.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.stopPropagation();
      cancelRef.current?.focus();
    } else if (e.key === "ArrowRight") {
      e.stopPropagation();
      exitRef.current?.focus();
    }
    // ArrowUp/Down: stop propagation so the board doesn't scroll behind the dialog.
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.stopPropagation();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onKeyDown={handleKeyDown}>
        <AlertDialogHeader>
          <AlertDialogTitle>Exit Cup &amp; Cozy?</AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;ll need to reopen the app to continue working.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          {/*
           * Cancel comes first in DOM order → Radix focuses it automatically
           * when the dialog opens. ref lets ArrowRight transfer focus to Exit.
           * The extra className adds a strong TV-visible focus ring.
           */}
          <AlertDialogCancel
            ref={cancelRef}
            className="focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-ring"
          >
            Cancel
          </AlertDialogCancel>

          <AlertDialogAction
            ref={exitRef}
            onClick={onExit}
            className="focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-ring"
          >
            Exit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
