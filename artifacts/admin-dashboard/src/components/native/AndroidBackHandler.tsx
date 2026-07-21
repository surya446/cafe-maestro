import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { useAndroidBackButton } from "@/hooks/useAndroidBackButton";
import { ExitConfirmDialog } from "./ExitConfirmDialog";

interface AndroidBackHandlerProps {
  /** When true, the back button is fully disabled (no back nav, no
   * exit dialog) — used while a mandatory update screen is blocking
   * the app. */
  disabled?: boolean;
}

/**
 * Mounted once at the app root. Owns the Android back-button
 * navigation behaviour and the exit confirmation dialog. Renders
 * nothing (and the hook is a no-op) on web/desktop.
 *
 * Back-button behaviour:
 *   - Dialog CLOSED → open the exit confirmation dialog.
 *   - Dialog OPEN   → close the dialog and return to the app.
 *     (Previously always called setExitOpen(true) which meant pressing
 *      BACK while the dialog was visible had no visible effect.)
 */
export function AndroidBackHandler({ disabled = false }: AndroidBackHandlerProps) {
  const [exitOpen, setExitOpen] = useState(false);

  // Toggle: if dialog is already open, BACK closes it; otherwise open it.
  useAndroidBackButton(() => {
    setExitOpen((prev) => {
      if (prev) return false;   // dialog open → close it
      return true;              // dialog closed → open it
    });
  }, disabled);

  // If a mandatory update becomes active while the exit dialog happens
  // to be open, close it — it must not remain a way to dismiss/exit.
  useEffect(() => {
    if (disabled) setExitOpen(false);
  }, [disabled]);

  return (
    <ExitConfirmDialog
      open={exitOpen}
      onOpenChange={setExitOpen}
      onExit={() => void App.exitApp()}
    />
  );
}
