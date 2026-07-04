/**
 * Device Service
 *
 * Registers the current Android device against the `staff_devices`
 * table whenever a staff member logs in. Android-only — a no-op in
 * the browser admin dashboard.
 */

import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { supabase } from "@/lib/supabase";
import { getInstalledAppVersion } from "./versionService";

function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

/** Called once per login — inserts or updates this staff member's device row. */
export async function trackDeviceForStaff(staffId: string): Promise<void> {
  if (!isNativeAndroid()) return;

  try {
    const [deviceInfo, appVersion] = await Promise.all([
      Device.getInfo(),
      getInstalledAppVersion(),
    ]);

    const now = new Date().toISOString();

    const { error } = await supabase.from("staff_devices").upsert(
      {
        staff_id: staffId,
        device_name: deviceInfo.name || deviceInfo.model || "Unknown device",
        device_model: deviceInfo.model ?? null,
        android_version: deviceInfo.osVersion ?? null,
        app_version: appVersion.version,
        build_number: appVersion.buildNumber,
        last_seen: now,
        last_login: now,
      },
      { onConflict: "staff_id" }
    );

    if (error) {
      console.error("[deviceService] Failed to record device:", error.message);
    }
  } catch (err) {
    // Device tracking must never block login or crash the app.
    console.error("[deviceService] trackDeviceForStaff error:", err);
  }
}

/** Lightweight heartbeat — call periodically to keep last_seen fresh. */
export async function touchDeviceLastSeen(staffId: string): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await supabase
      .from("staff_devices")
      .update({ last_seen: new Date().toISOString() })
      .eq("staff_id", staffId);
  } catch (err) {
    console.error("[deviceService] touchDeviceLastSeen error:", err);
  }
}
