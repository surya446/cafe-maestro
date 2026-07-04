/**
 * ApkUpdater — thin TS bridge to the native Android plugin
 * (android/app/src/main/java/com/cafemaestro/app/ApkUpdaterPlugin.java).
 *
 * Capacitor's core plugin set has no built-in "download APK with
 * progress + launch package installer" API, so this is a small
 * custom native plugin. It is a no-op stub on non-Android platforms;
 * callers must gate usage on Capacitor.isNativePlatform() &&
 * Capacitor.getPlatform() === "android".
 */

import { registerPlugin } from "@capacitor/core";

export interface DownloadProgressEvent {
  percent: number;
  bytesWritten: number;
  totalBytes: number;
}

export interface ApkUpdaterPlugin {
  download(options: { url: string; fileName: string }): Promise<{ path: string }>;
  install(options: { path: string }): Promise<void>;
  addListener(
    eventName: "downloadProgress",
    listenerFunc: (event: DownloadProgressEvent) => void
  ): Promise<{ remove: () => void }>;
}

export const ApkUpdater = registerPlugin<ApkUpdaterPlugin>("ApkUpdater");
