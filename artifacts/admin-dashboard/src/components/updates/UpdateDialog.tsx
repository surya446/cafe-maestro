import { useState } from "react";
import { Sparkles, Download, AlertCircle, RotateCcw, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { LatestReleaseInfo } from "@/services/releaseService";
import { useApkDownload } from "@/hooks/useApkDownload";

interface UpdateDialogProps {
  installedVersion: string;
  isForceUpdate: boolean;
  release: LatestReleaseInfo;
  onDismiss: () => void;
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export function UpdateDialog({
  installedVersion,
  isForceUpdate,
  release,
  onDismiss,
}: UpdateDialogProps) {
  const { status, percent, bytesWritten, totalBytes, error, download, install, reset } =
    useApkDownload();
  const [started, setStarted] = useState(false);

  const releaseDate = release.published_at
    ? new Date(release.published_at).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  const locked = isForceUpdate || status === "downloading";

  const handleUpdateNow = async () => {
    setStarted(true);
    if (!release.download_url) return;
    await download(release.download_url, release.version);
  };

  const handleRetry = () => {
    reset();
    setStarted(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && locked) return;
    if (!next) onDismiss();
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        hideClose={locked}
        onInteractOutside={(e) => {
          if (locked) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (locked) e.preventDefault();
        }}
      >
        {!started && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <DialogTitle>Cafe Maestro Update Available</DialogTitle>
              </div>
              <DialogDescription>
                {isForceUpdate
                  ? "This update is required to continue using the app."
                  : "A new version of the app is ready to install."}
              </DialogDescription>
            </DialogHeader>

            {isForceUpdate && (
              <div className="flex items-center gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                Update is mandatory — the app cannot be used until you update.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Current Version
                </p>
                <p className="text-sm font-semibold text-foreground">v{installedVersion}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Latest Version
                </p>
                <p className="text-sm font-semibold text-primary">v{release.version}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 col-span-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Release Date
                </p>
                <p className="text-sm font-semibold text-foreground">{releaseDate}</p>
              </div>
            </div>

            {release.release_notes && (
              <div className="bg-muted/30 border border-border rounded-lg p-3 max-h-32 overflow-y-auto">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Release Notes
                </p>
                <p className="text-sm text-foreground whitespace-pre-line">{release.release_notes}</p>
              </div>
            )}

            <DialogFooter className="mt-1">
              {!isForceUpdate && (
                <Button variant="ghost" onClick={onDismiss}>
                  Later
                </Button>
              )}
              <Button onClick={handleUpdateNow} className="gap-1.5">
                <Download className="w-4 h-4" />
                Update Now
              </Button>
            </DialogFooter>
          </>
        )}

        {started && status !== "downloaded" && (
          <>
            <DialogHeader>
              <DialogTitle>{status === "error" ? "Update Failed" : "Downloading Update"}</DialogTitle>
              <DialogDescription>
                {status === "error"
                  ? "Something went wrong while downloading the update."
                  : `Cafe Maestro v${release.version}`}
              </DialogDescription>
            </DialogHeader>

            {status === "error" ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <AlertCircle className="w-8 h-8 text-destructive" />
                <p className="text-sm text-muted-foreground text-center">{error}</p>
              </div>
            ) : (
              <div className="py-3 space-y-2">
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

            <DialogFooter>
              {status === "error" && (
                <>
                  {!isForceUpdate && (
                    <Button variant="ghost" onClick={onDismiss}>
                      Later
                    </Button>
                  )}
                  <Button onClick={handleRetry} className="gap-1.5">
                    <RotateCcw className="w-4 h-4" />
                    Retry
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}

        {status === "downloaded" && (
          <>
            <DialogHeader>
              <DialogTitle>Ready to Install</DialogTitle>
              <DialogDescription>
                Cafe Maestro v{release.version} has finished downloading.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => install()} className="gap-1.5">
                <Download className="w-4 h-4" />
                Install Update
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
