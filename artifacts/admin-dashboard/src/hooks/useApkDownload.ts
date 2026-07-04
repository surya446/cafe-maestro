/**
 * useApkDownload
 *
 * Orchestrates downloading an APK (with progress) and launching the
 * Android package installer, via the native ApkUpdater plugin.
 * Never uses browser download behavior on native Android.
 */

import { useCallback, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { ApkUpdater, type DownloadProgressEvent } from "@/native/apkUpdater";

export type DownloadStatus = "idle" | "downloading" | "downloaded" | "error";

export function useApkDownload() {
  const [status, setStatus] = useState<DownloadStatus>("idle");
  const [percent, setPercent] = useState(0);
  const [bytesWritten, setBytesWritten] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [apkPath, setApkPath] = useState<string | null>(null);
  const listenerRef = useRef<{ remove: () => void } | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setPercent(0);
    setBytesWritten(0);
    setTotalBytes(0);
    setError(null);
    setApkPath(null);
  }, []);

  const download = useCallback(async (url: string, version: string) => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      // Should never be reached from the Android update dialog, but
      // never leave the caller hanging if it somehow is.
      window.open(url, "_blank");
      return;
    }

    setStatus("downloading");
    setError(null);
    setPercent(0);
    setBytesWritten(0);
    setTotalBytes(0);

    listenerRef.current = await ApkUpdater.addListener(
      "downloadProgress",
      (event: DownloadProgressEvent) => {
        setBytesWritten(event.bytesWritten);
        setTotalBytes(event.totalBytes);
        if (event.percent >= 0) setPercent(Math.min(100, Math.round(event.percent)));
      }
    );

    try {
      const fileName = `cafe-maestro-${version}.apk`;
      const { path } = await ApkUpdater.download({ url, fileName });
      setApkPath(path);
      setStatus("downloaded");
      setPercent(100);
    } catch (err: any) {
      setStatus("error");
      setError(err?.message ?? "Download failed. Check your connection and try again.");
    } finally {
      listenerRef.current?.remove();
      listenerRef.current = null;
    }
  }, []);

  const install = useCallback(async () => {
    if (!apkPath) return;
    try {
      await ApkUpdater.install({ path: apkPath });
    } catch (err: any) {
      setStatus("error");
      setError(err?.message ?? "Could not launch the installer.");
    }
  }, [apkPath]);

  return { status, percent, bytesWritten, totalBytes, error, apkPath, download, install, reset };
}
