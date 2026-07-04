/**
 * useDeviceTracking
 *
 * Records the current staff member's Android device (model, OS
 * version, installed app version/build) once per login. Android-only
 * — a no-op in the browser admin dashboard, guarded inside
 * deviceService.trackDeviceForStaff.
 */

import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trackDeviceForStaff } from "@/services/deviceService";

export function useDeviceTracking() {
  const { user } = useAuth();
  const trackedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    if (trackedFor.current === user.id) return;
    trackedFor.current = user.id;
    void trackDeviceForStaff(user.id);
  }, [user?.id]);
}
