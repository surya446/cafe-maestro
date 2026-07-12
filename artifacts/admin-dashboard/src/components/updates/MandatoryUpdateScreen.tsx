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

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Bug, ChevronDown, ChevronUp, Download, RotateCcw, ShieldAlert, WifiOff } from "lucide-react";
import { App } from "@capacitor/app";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import type { LatestReleaseInfo } from "@/services/releaseService";
import { useApkDownload } from "@/hooks/useApkDownload";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

// versionCode and versionName as compiled into build.gradle at build time.
// UPDATE THESE whenever build.gradle changes.
const GRADLE_VERSION_CODE = 1;
const GRADLE_VERSION_NAME = "1.0";

interface MandatoryUpdateScreenProps {
  installedVersion: string;
  installedBuild: number;
  release: LatestReleaseInfo;
}

// ─── Diagnostic panel ────────────────────────────────────────────────────────

interface DiagRow { label: string; value: string; highlight?: "ok" | "warn" | "error" }

function DiagSection({ title, rows }: { title: string; rows: DiagRow[] }) {
  return (
    <div className="space-y-1">
      <p className="text-[9px] font-bold uppercase tracking-widest text-amber-700">{title}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex gap-1.5 text-[10px] leading-snug">
          <span className="text-amber-600 shrink-0 w-36">{r.label}</span>
          <span
            className={cn(
              "font-mono break-all",
              r.highlight === "error" && "text-red-600 font-bold",
              r.highlight === "warn"  && "text-amber-800 font-semibold",
              r.highlight === "ok"    && "text-emerald-700 font-semibold",
              !r.highlight            && "text-foreground",
            )}
          >
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function DiagPanel({
  installedBuild,
  release,
}: {
  installedBuild: number;
  release: LatestReleaseInfo;
}) {
  const [open, setOpen] = useState(false);
  const [rawInfo, setRawInfo] = useState<{ id: string; version: string; build: string } | null>(null);
  const [rawInfoError, setRawInfoError] = useState<string | null>(null);
  const [allLatestRows, setAllLatestRows] = useState<
    { id: string; version: string; build_number: number; is_latest: boolean; platform: string }[]
  >([]);
  const [dbError, setDbError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;

    // 1. Fresh App.getInfo() call (bypasses any state already in context)
    void App.getInfo()
      .then((info) => setRawInfo({ id: info.id, version: info.version, build: info.build }))
      .catch((e) => setRawInfoError(String(e)));

    // 2. Direct DB query — bypasses the get_latest_release RPC — to see
    //    every row with is_latest=true for android and confirm there is
    //    exactly one.
    void supabase
      .from("app_releases")
      .select("id, version, build_number, is_latest, platform")
      .eq("platform", "android")
      .order("build_number", { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (error) { setDbError(error.message); return; }
        setAllLatestRows((data ?? []) as typeof allLatestRows);
      });
  }, [open]);

  const parsedBuild = rawInfo ? (parseInt(rawInfo.build, 10) || 0) : null;
  const buildMatchesContext = parsedBuild !== null ? parsedBuild === installedBuild : null;
  const buildMatchesGradle  = parsedBuild !== null ? parsedBuild === GRADLE_VERSION_CODE : null;
  const comparisonResult    = release.build_number > installedBuild;
  const latestRows          = allLatestRows.filter((r) => r.is_latest);

  return (
    <div className="border border-amber-300 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-amber-50 text-left"
      >
        <Bug className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span className="text-xs font-semibold text-amber-800 flex-1">Diagnostic Info</span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-amber-600" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-amber-600" />
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 pt-2 bg-amber-50/60 space-y-3 overflow-x-auto">
          {/* ── 1 & 6: App.getInfo() — fresh call independent of context ── */}
          <DiagSection
            title="1 & 6 — App.getInfo() (fresh call, not from context)"
            rows={
              rawInfoError
                ? [{ label: "error", value: rawInfoError, highlight: "error" }]
                : rawInfo === null
                  ? [{ label: "status", value: "loading…" }]
                  : [
                      { label: "appId",   value: rawInfo.id },
                      { label: "version", value: rawInfo.version },
                      { label: "build (raw string)", value: rawInfo.build },
                      {
                        label: "parsedBuildNumber",
                        value: String(parsedBuild),
                        highlight: buildMatchesContext === false ? "error" : "ok",
                      },
                    ]
            }
          />

          {/* ── 2: versionService result (from context / hook) ── */}
          <DiagSection
            title="2 — versionService result (from AppUpdateContext)"
            rows={[
              { label: "installedBuild", value: String(installedBuild) },
              {
                label: "matches fresh getInfo()",
                value: buildMatchesContext === null ? "loading…"
                  : buildMatchesContext ? "YES ✓" : "NO — MISMATCH ✗",
                highlight: buildMatchesContext === false ? "error"
                  : buildMatchesContext ? "ok" : undefined,
              },
            ]}
          />

          {/* ── 3: Latest release from DB (as passed to this screen) ── */}
          <DiagSection
            title="3 — Latest release (from DB, passed via props)"
            rows={[
              { label: "id",           value: release.id },
              { label: "version",      value: release.version },
              { label: "build_number", value: String(release.build_number) },
              { label: "is_force_update", value: String(release.is_force_update) },
              { label: "published_at", value: release.published_at },
              { label: "download_url", value: release.download_url ?? "(null)" },
            ]}
          />

          {/* ── 4: Exact comparison ── */}
          <DiagSection
            title="4 — Comparison (exact)"
            rows={[
              { label: "installedBuild",        value: String(installedBuild) },
              { label: "latestBuild",           value: String(release.build_number) },
              {
                label: "latestBuild > installed",
                value: String(comparisonResult),
                highlight: comparisonResult ? "error" : "ok",
              },
              { label: "hasUpdate",      value: String(comparisonResult) },
              { label: "isForceUpdate",  value: String(comparisonResult && release.is_force_update) },
            ]}
          />

          {/* ── 5: Data source ── */}
          <DiagSection
            title="5 — Data source"
            rows={[
              { label: "source", value: "always fresh — no client-side cache in releaseService or versionService", highlight: "ok" },
            ]}
          />

          {/* ── 7: build.gradle compile-time constants ── */}
          <DiagSection
            title="7 — build.gradle (compile-time constants)"
            rows={[
              { label: "versionCode", value: String(GRADLE_VERSION_CODE),
                highlight: parsedBuild !== null && parsedBuild !== GRADLE_VERSION_CODE ? "error" : undefined },
              { label: "versionName", value: GRADLE_VERSION_NAME },
              {
                label: "getInfo().build matches gradle",
                value: buildMatchesGradle === null ? "loading…"
                  : buildMatchesGradle ? "YES ✓" : "NO — APK was built with a DIFFERENT versionCode ✗",
                highlight: buildMatchesGradle === false ? "error"
                  : buildMatchesGradle ? "ok" : undefined,
              },
            ]}
          />

          {/* ── 8: SHA256 note ── */}
          <DiagSection
            title="8 — APK SHA256"
            rows={[
              { label: "note", value: "Cannot compute SHA256 from within the running app. Compare the file hash of the locally-built APK against the file downloaded from download_url above using sha256sum or certutil." },
            ]}
          />

          {/* ── 9: All is_latest rows from DB ── */}
          <DiagSection
            title="9 — app_releases (android, all rows, is_latest check)"
            rows={
              dbError
                ? [{ label: "error", value: dbError, highlight: "error" }]
                : allLatestRows.length === 0
                  ? [{ label: "status", value: "loading…" }]
                  : [
                      {
                        label: "rows with is_latest=true",
                        value: String(latestRows.length),
                        highlight: latestRows.length === 1 ? "ok" : "error",
                      },
                      ...allLatestRows.map((r) => ({
                        label: `build #${r.build_number}`,
                        value: `v${r.version} | is_latest=${r.is_latest} | id=${r.id.slice(0, 8)}…`,
                        highlight: (r.is_latest ? "warn" : undefined) as DiagRow["highlight"],
                      })),
                    ]
            }
          />

          {/* ── 10: Mismatch summary ── */}
          <DiagSection
            title="10 — Mismatch summary"
            rows={[
              ...(buildMatchesContext === false
                ? [{ label: "MISMATCH", value: "App.getInfo().build ≠ installedBuild in context. The context has stale data from before install.", highlight: "error" as const }]
                : []),
              ...(buildMatchesGradle === false
                ? [{ label: "MISMATCH", value: `App.getInfo().build (${parsedBuild}) ≠ build.gradle versionCode (${GRADLE_VERSION_CODE}). The running APK was built with a different versionCode than build.gradle currently shows.`, highlight: "error" as const }]
                : []),
              ...(latestRows.length !== 1
                ? [{ label: "MISMATCH", value: `${latestRows.length} rows have is_latest=true (expected exactly 1).`, highlight: "error" as const }]
                : []),
              ...(comparisonResult && parsedBuild === release.build_number
                ? [{ label: "MISMATCH", value: `App.getInfo().build (${parsedBuild}) equals DB build_number (${release.build_number}) but hasUpdate is true — impossible unless context is stale.`, highlight: "error" as const }]
                : []),
              ...(
                !comparisonResult && !buildMatchesContext === false && latestRows.length === 1
                  ? [{ label: "NO MISMATCH FOUND", value: "All values agree — update screen should NOT be showing. Check if isForceUpdate is being set incorrectly.", highlight: "warn" as const }]
                  : []
              ),
              ...(
                buildMatchesContext !== false && buildMatchesGradle !== false && latestRows.length === 1 && comparisonResult
                  ? [{ label: "EXPECTED MISMATCH", value: `DB build_number (${release.build_number}) > installed build (${installedBuild}). Update is legitimately required.`, highlight: "ok" as const }]
                  : []
              ),
            ]}
          />
        </div>
      )}
    </div>
  );
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

export function MandatoryUpdateScreen({ installedVersion, installedBuild, release }: MandatoryUpdateScreenProps) {
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

        {/* ── Diagnostic panel — tap to expand, scroll to see all 10 items ── */}
        <DiagPanel installedBuild={installedBuild} release={release} />
      </div>
    </div>
  );
}
