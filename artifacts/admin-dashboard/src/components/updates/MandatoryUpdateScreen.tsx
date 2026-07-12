/**
 * MandatoryUpdateScreen
 *
 * Full-screen, non-dismissable update page shown when the installed
 * Android build is older than the latest published release AND that
 * release has is_force_update = true. Rendered in place of the entire
 * app (see MandatoryUpdateGate) — nothing behind it is reachable:
 * there is no close/cancel button, no backdrop, no escape handling,
 * and the Android hardware back button is disabled for as long as
 * this is on screen (see AndroidBackHandler's `disabled` prop).
 *
 * Handles the full lifecycle itself: download (via the existing
 * ApkUpdater native plugin / useApkDownload), automatic install once
 * the download finishes, graceful pause + automatic resume when
 * connectivity is lost mid-update, and retry for both download and
 * install failures.
 */

import { useEffect, useState } from "react";
import { AlertCircle, Download, RotateCcw, ShieldAlert, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LatestReleaseInfo } from "@/services/releaseService";
import { useApkDownload } from "@/hooks/useApkDownload";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

interface MandatoryUpdateScreenProps {
  installedVersion: string;
  release: LatestReleaseInfo;
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function Field({
  label,
  value,
  accent,
  span2,
}: {
  label: string;
  value: string;
  accent?: boolean;
  span2?: boolean;
}) {
  return (
    <div className={cn("bg-muted/50 rounded-lg p-3", span2 && "col-span-2")}>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={cn("text-sm font-semibold", accent ? "text-primary" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

export function MandatoryUpdateScreen({ installedVersion, release }: MandatoryUpdateScreenProps) {
  const isOnline = useNetworkStatus();
  const { status, percent, bytesWritten, totalBytes, error, apkPath, download, install } =
    useApkDownload();
  const [requested, setRequested] = useState(false);

  const releaseDate = release.published_at
    ? new Date(release.published_at).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  const hasApk = !!release.download_url;

  const startDownload = () => {
    if (!release.download_url) return;
    void download(release.download_url, release.version);
  };

  const handleUpdateNow = () => {
    setRequested(true);
    if (isOnline) startDownload();
  };

  // Network lost mid-update: pause gracefully (handled by rendering
  // priority below) and automatically resume the moment connectivity
  // returns — only for a genuine download failure, never while a
  // download is still in flight (it may still succeed on its own).
  useEffect(() => {
    if (!requested || !isOnline) return;
    if (status === "error" && !apkPath) {
      startDownload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // Download finished — launch the Android package installer
  // automatically. No extra tap required.
  useEffect(() => {
    if (status === "downloaded") {
      void install();
    }
  }, [status, install]);

  const offline = requested && !isOnline;

  return (
    <div
      className="fixed inset-0 z-[100] bg-background overflow-y-auto flex items-center justify-center p-4"
      style={{
        paddingTop: "calc(1rem + env(safe-area-inset-top))",
        paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
      }}
      role="alertdialog"
      aria-label="Mandatory app update"
    >
      <div className="w-full max-w-md bg-card border border-card-border rounded-2xl shadow-lg p-6 space-y-5 my-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">
              Cafe Maestro Update Available
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              This update is required to continue using the app.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          Update is mandatory — the app is locked until you update.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Current Version" value={`v${installedVersion}`} />
          <Field label="Latest Version" value={`v${release.version}`} accent />
          <Field label="Release Date" value={releaseDate} span2 />
          {release.file_size && <Field label="APK Size" value={release.file_size} />}
          {release.file_size && <Field label="Estimated Download" value={release.file_size} />}
        </div>

        {release.release_notes && (
          <div className="bg-muted/30 border border-border rounded-lg p-3 max-h-32 overflow-y-auto">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Release Notes
            </p>
            <p className="text-sm text-foreground whitespace-pre-line">{release.release_notes}</p>
          </div>
        )}

        {!hasApk && (
          <div className="flex items-center gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            No APK is available for this release yet. Please contact the owner.
          </div>
        )}

        {offline && (
          <div className="flex items-center gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            <WifiOff className="w-4 h-4 shrink-0" />
            Waiting for internet…
          </div>
        )}

        {!offline && requested && status === "downloading" && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Downloading Update</p>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-200 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{percent}%</span>
              {totalBytes > 0 && (
                <span>
                  {formatMb(bytesWritten)} MB / {formatMb(totalBytes)} MB
                </span>
              )}
            </div>
          </div>
        )}

        {!offline && status === "downloaded" && (
          <div className="flex items-center gap-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
            <Download className="w-4 h-4 shrink-0 animate-pulse" />
            Opening installer…
          </div>
        )}

        {!offline && status === "error" && apkPath && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Couldn't open the installer. {error}
            </div>
            <Button onClick={() => void install()} className="w-full gap-1.5">
              <RotateCcw className="w-4 h-4" />
              Retry Install
            </Button>
          </div>
        )}

        {!offline && status === "error" && !apkPath && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Download failed. {error}
            </div>
            <Button onClick={startDownload} className="w-full gap-1.5">
              <RotateCcw className="w-4 h-4" />
              Retry
            </Button>
          </div>
        )}

        {!requested && (
          <Button onClick={handleUpdateNow} disabled={!hasApk} className="w-full gap-1.5" size="lg">
            <Download className="w-4 h-4" />
            Update Now
          </Button>
        )}
      </div>
    </div>
  );
}
