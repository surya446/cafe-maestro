import { useState } from "react";
import { App } from "@capacitor/app";
import { useAndroidBackButton } from "@/hooks/useAndroidBackButton";
import { ExitConfirmDialog } from "./ExitConfirmDialog";

/**
 * Mounted once at the app root. Owns the Android back-button
 * navigation behaviour and the exit confirmation dialog. Renders
 * nothing (and the hook is a no-op) on web/desktop.
 */
export function AndroidBackHandler() {
  const [exitOpen, setExitOpen] = useState(false);

  useAndroidBackButton(() => setExitOpen(true));

  return (
    <ExitConfirmDialog
      open={exitOpen}
      onOpenChange={setExitOpen}
      onExit={() => void App.exitApp()}
    />
  );
}
