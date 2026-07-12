import { useState, useRef, useEffect } from "react";
import {
  Download,
  Smartphone,
  Tv2,
  Monitor,
  Apple,
  Globe,
  Clock,
  CheckCircle2,
  Copy,
  ExternalLink,
  Upload,
  RotateCcw,
  Trash2,
  AlertCircle,
  PackageOpen,
  ShieldAlert,
  Zap,
  ChevronRight,
  FileText,
  Hash,
  Loader2,
  XCircle,
  Package,
  RefreshCw,
} from "lucide-react";
import QRCode from "react-qr-code";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { COMING_SOON_PLATFORMS } from "@/config/downloads";
import { compareVersions, formatFileSize, type AppReleasePlatform } from "@/services/releaseService";
import {
  useLatestRelease,
  useReleaseHistory,
  usePublishRelease,
  useRollbackRelease,
  useDeleteRelease,
  findReleaseBySha256,
  type AppRelease,
} from "@/hooks/useAppReleases";
import { useStaffDevices, type StaffDeviceRow } from "@/hooks/useStaffDevices";
import { parseApkFile, formatAndroidVersion, type ParsedApkMetadata } from "@/services/apkParser";

const WEB_APP_URL = typeof window !== "undefined" ? window.location.origin : "";

type ActivePlatform = "android" | "android-tv";

const PLATFORM_META: Record<
  ActivePlatform,
  { label: string; description: string; color: string; icon: React.ReactNode }
> = {
  android: {
    label: "Android App",
    description: "Full management dashboard for Android phones and tablets.",
    color: "bg-emerald-100 text-emerald-700",
    icon: <Smartphone className="w-5 h-5" />,
  },
  "android-tv": {
    label: "Android TV — Kitchen Display",
    description:
      "Optimised for kitchen televisions. Large order cards, realtime updates, touch-friendly. Chef role auto-opens KDS.",
    color: "bg-purple-100 text-purple-700",
    icon: <Tv2 className="w-5 h-5" />,
  },
};

function LatestBadge() {
  return (
    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 gap-1">
      <CheckCircle2 className="w-3 h-3" />
      Live
    </Badge>
  );
}

function ForceUpdateBadge() {
  return (
    <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 gap-1">
      <Zap className="w-3 h-3" />
      Force Update
    </Badge>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copied!", description: label });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Please copy manually.", variant: "destructive" });
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
      <Copy className="w-3.5 h-3.5" />
      {copied ? "Copied!" : "Copy Link"}
    </Button>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function LiveReleaseCard({
  platform,
  release,
}: {
  platform: ActivePlatform;
  release: AppRelease;
}) {
  const meta = PLATFORM_META[platform];
  const publishDate = new Date(release.published_at).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={cn("flex items-center justify-center w-10 h-10 rounded-xl shrink-0", meta.color)}>
            {meta.icon}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{meta.label}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LatestBadge />
          {release.is_force_update && <ForceUpdateBadge />}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MetaCell label="Version" value={`v${release.version}`} />
        <MetaCell label="Build" value={`#${release.build_number}`} />
        <MetaCell label="Released" value={publishDate} />
        {release.min_android_version && (
          <MetaCell label="Min Android" value={release.min_android_version} />
        )}
        {release.file_size && (
          <MetaCell label="APK Size" value={release.file_size} />
        )}
        {release.package_name && (
          <MetaCell label="Package Name" value={release.package_name} />
        )}
        {release.target_android_version && (
          <MetaCell label="Target Android" value={release.target_android_version} />
        )}
        {release.apk_sha256 && <ShaCell label="SHA256" value={release.apk_sha256} />}
        {release.apk_signature && (
          <MetaCell label="Signature" value="Verified ✓" />
        )}
      </div>

      {release.release_notes && (
        <div className="bg-muted/30 border border-border rounded-lg p-3">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Release Notes
          </p>
          <p className="text-sm text-foreground whitespace-pre-line">{release.release_notes}</p>
        </div>
      )}

      {release.download_url ? (
        <div className="flex flex-col items-center gap-2 py-1">
          <div className="p-3 bg-white border border-border rounded-xl">
            <QRCode value={release.download_url} size={120} />
          </div>
          <p className="text-xs text-muted-foreground">Scan to download APK</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-1">
          <div className="p-3 bg-muted/30 border border-dashed border-border rounded-xl w-[146px] h-[146px] flex items-center justify-center">
            <p className="text-xs text-muted-foreground text-center">
              QR code available after first APK upload
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
        {release.download_url ? (
          <Button
            size="sm"
            onClick={() => window.open(release.download_url!, "_blank")}
            className="gap-1.5 flex-1 sm:flex-none"
          >
            <Download className="w-3.5 h-3.5" />
            Download APK
          </Button>
        ) : (
          <Button size="sm" disabled className="gap-1.5 flex-1 sm:flex-none">
            <Download className="w-3.5 h-3.5" />
            No APK yet
          </Button>
        )}
        {release.download_url && (
          <CopyButton text={release.download_url} label="APK download link copied" />
        )}
      </div>
    </div>
  );
}

function NoReleaseCard({ platform }: { platform: ActivePlatform }) {
  const meta = PLATFORM_META[platform];
  return (
    <div className="bg-card border border-dashed border-card-border rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
      <div className={cn("flex items-center justify-center w-12 h-12 rounded-xl", meta.color)}>
        {meta.icon}
      </div>
      <div>
        <p className="font-medium text-foreground">{meta.label}</p>
        <p className="text-sm text-muted-foreground mt-1">
          No release published yet. Upload an APK to get started.
        </p>
      </div>
    </div>
  );
}

function ShaCell({ label, value }: { label: string; value: string | null }) {
  const { toast } = useToast();
  if (!value) return <MetaCell label={label} value="—" />;
  const short = `${value.slice(0, 12)}…`;
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <button
        type="button"
        className="text-sm font-mono font-semibold text-foreground hover:text-primary transition-colors"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          toast({ title: "Copied!", description: `${label} copied to clipboard` });
        }}
        title={value}
      >
        {short}
      </button>
    </div>
  );
}

type BuildNumberChoice = "unresolved" | "keep";

function UploadForm({
  platform,
  latestRelease,
}: {
  platform: ActivePlatform;
  latestRelease: AppRelease | null;
}) {
  const { toast } = useToast();
  const publishRelease = usePublishRelease();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ParsedApkMetadata | null>(null);

  const [version, setVersion] = useState("");
  const [buildNumber, setBuildNumber] = useState("");
  const [minAndroid, setMinAndroid] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [isForceUpdate, setIsForceUpdate] = useState(false);

  const [duplicateRelease, setDuplicateRelease] = useState<AppRelease | null>(null);
  const [replaceMode, setReplaceMode] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const [buildChoice, setBuildChoice] = useState<BuildNumberChoice>("unresolved");
  const [versionDowngradeConfirmed, setVersionDowngradeConfirmed] = useState(false);

  const reset = () => {
    setFile(null);
    setParsing(false);
    setParseError(null);
    setMetadata(null);
    setVersion("");
    setBuildNumber("");
    setMinAndroid("");
    setReleaseNotes("");
    setIsForceUpdate(false);
    setDuplicateRelease(null);
    setReplaceMode(false);
    setBuildChoice("unresolved");
    setVersionDowngradeConfirmed(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    reset();
    setFile(selected);
    setParsing(true);

    try {
      const parsed = await parseApkFile(selected);
      setMetadata(parsed);
      setVersion(parsed.versionName ?? "");
      setBuildNumber(parsed.versionCode ? String(parsed.versionCode) : "");
      setMinAndroid(formatAndroidVersion(parsed.minSdkVersion));

      setCheckingDuplicate(true);
      const existing = await findReleaseBySha256(platform, parsed.sha256);
      setDuplicateRelease(existing);
    } catch (err: any) {
      setParseError(
        err?.message ?? "Could not read this APK. Make sure it's a valid, unmodified .apk file."
      );
      setFile(null);
    } finally {
      setParsing(false);
      setCheckingDuplicate(false);
    }
  };

  const buildNum = parseInt(buildNumber, 10) || 0;
  // Build number conflict cases — kept separate so each gets its own UI.
  // "Too low" (buildNum < latest) is a hard block: the APK must be rebuilt.
  // "Same as current" (buildNum === latest) requires explicit confirmation to
  // republish the same build number (safe, but won't trigger updates on existing
  // installs). "Auto Increment" has been removed: storing a build_number in the
  // database that is higher than the APK's actual versionCode causes the
  // mandatory-update screen to reappear infinitely after installation.
  const isBuildTooLow =
    !!latestRelease && buildNum > 0 && buildNum < latestRelease.build_number;
  const isBuildSameAsCurrent =
    !!latestRelease && buildNum > 0 && buildNum === latestRelease.build_number;
  const isVersionDowngrade =
    !!latestRelease && !!version.trim() && compareVersions(version.trim(), latestRelease.version) < 0;

  const effectiveBuildNumber = buildNum;

  const blockedByDuplicate = !!duplicateRelease && !replaceMode;
  const blockedByBuildChoice =
    isBuildTooLow || (isBuildSameAsCurrent && buildChoice === "unresolved");
  const blockedByVersionDowngrade = isVersionDowngrade && !versionDowngradeConfirmed;

  const canPublish =
    !!file &&
    !!metadata &&
    !!version.trim() &&
    effectiveBuildNumber > 0 &&
    !blockedByDuplicate &&
    !blockedByBuildChoice &&
    !blockedByVersionDowngrade;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !metadata) return;
    if (!canPublish) {
      toast({
        title: "Resolve the warnings above",
        description: "Please address the highlighted issues before publishing.",
        variant: "destructive",
      });
      return;
    }

    try {
      await publishRelease.mutateAsync({
        platform,
        version: version.trim(),
        build_number: effectiveBuildNumber,
        release_notes: releaseNotes,
        min_android_version: minAndroid,
        is_force_update: isForceUpdate,
        file,
        package_name: metadata.packageName,
        target_android_version: formatAndroidVersion(metadata.targetSdkVersion),
        apk_sha256: metadata.sha256,
        apk_signature: metadata.signatureFingerprint,
        build_timestamp: metadata.buildTimestamp,
        replaceReleaseId: replaceMode ? duplicateRelease?.id : undefined,
      });
      toast({ title: "Release published!", description: `v${version.trim()} is now the live release.` });
      reset();
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" });
    }
  };

  const isPending = publishRelease.isPending;

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary shrink-0">
          <Upload className="w-4.5 h-4.5" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Upload New Release</h3>
          <p className="text-xs text-muted-foreground">
            Choose an APK — version, package, and SDK details are read automatically.
          </p>
        </div>
      </div>

      {/* File picker */}
      <div className="space-y-2">
        <Label>APK File *</Label>
        <div
          className={cn(
            "border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-colors",
            file ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted/30"
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".apk,application/vnd.android.package-archive,application/octet-stream"
            className="hidden"
            onChange={handleFileChange}
          />
          {parsing ? (
            <>
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm font-medium text-foreground">Reading APK…</p>
              <p className="text-xs text-muted-foreground">Extracting version, package, and SDK info</p>
            </>
          ) : file && metadata ? (
            <>
              <CheckCircle2 className="w-8 h-8 text-primary" />
              <p className="text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / (1024 * 1024)).toFixed(1)} MB — click to change
              </p>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">Choose APK file</p>
              <p className="text-xs text-muted-foreground">Click to browse — .apk only</p>
            </>
          )}
        </div>
        {parseError && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {parseError}
          </div>
        )}
      </div>

      {metadata && (
        <>
          {/* APK Information preview */}
          <div className="space-y-2">
            <Label>APK Information</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MetaCell label="Package Name" value={metadata.packageName ?? "Unknown"} />
              <MetaCell
                label="Target Android"
                value={formatAndroidVersion(metadata.targetSdkVersion)}
              />
              <MetaCell
                label="APK Size"
                value={formatFileSize(metadata.fileSizeBytes)}
              />
              <ShaCell label="SHA256" value={metadata.sha256} />
              <MetaCell
                label="Signature"
                value={metadata.signatureFingerprint ? "Verified ✓" : "Unavailable"}
              />
              <MetaCell
                label="Build Timestamp"
                value={
                  metadata.buildTimestamp
                    ? new Date(metadata.buildTimestamp).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "Unavailable"
                }
              />
            </div>
            {metadata.signatureUnavailableReason && !metadata.signatureFingerprint && (
              <p className="text-xs text-muted-foreground">{metadata.signatureUnavailableReason}</p>
            )}
          </div>

          {/* Duplicate detection */}
          {checkingDuplicate && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Checking for duplicate uploads…
            </div>
          )}
          {duplicateRelease && (
            <div className="flex flex-col gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">This APK has already been uploaded.</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Identical to v{duplicateRelease.version} (build #{duplicateRelease.build_number}),
                    uploaded {new Date(duplicateRelease.created_at).toLocaleDateString("en-AU")}.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={replaceMode ? "default" : "outline"}
                  onClick={() => setReplaceMode(true)}
                  className="gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Replace Existing Release
                </Button>
                {replaceMode && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setReplaceMode(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Version + Build (editable) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Version *</Label>
              <Input
                placeholder="1.0.0"
                value={version}
                onChange={(e) => {
                  setVersion(e.target.value);
                  setVersionDowngradeConfirmed(false);
                }}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Build Number *</Label>
              <Input
                type="number"
                min={1}
                placeholder="100"
                value={buildNumber}
                onChange={(e) => {
                  setBuildNumber(e.target.value);
                  setBuildChoice("unresolved");
                }}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Build number too low — hard block */}
          {isBuildTooLow && (
            <div className="flex items-start gap-2.5 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm text-destructive">
                <p className="font-medium">APK build number is too low.</p>
                <p className="mt-1">
                  This APK has <strong>versionCode {buildNum}</strong>, but the current live release
                  is build <strong>#{latestRelease?.build_number}</strong>. The build number in the
                  APK must be higher than the current live build — otherwise installed devices will
                  never see it as an update.
                </p>
                <p className="mt-1.5 font-medium">
                  Open <code className="font-mono">android/app/build.gradle</code>, set{" "}
                  <code className="font-mono">versionCode</code> to at least{" "}
                  {(latestRelease?.build_number ?? 0) + 1}, rebuild the APK, then upload again.
                </p>
              </div>
            </div>
          )}

          {/* Build number same as current — offer republish with confirmation */}
          {isBuildSameAsCurrent && (
            <div className="flex flex-col gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">
                    This APK has the same versionCode ({buildNum}) as the current live release
                    (build #{latestRelease?.build_number}).
                  </p>
                  <p className="mt-1">
                    Republishing replaces the existing release file but will{" "}
                    <strong>not prompt devices that already have build #{buildNum} to update</strong>.
                    If you want existing users to receive this update, rebuild the APK with a higher{" "}
                    <code className="font-mono">versionCode</code> in{" "}
                    <code className="font-mono">android/app/build.gradle</code>.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant={buildChoice === "keep" ? "default" : "outline"}
                onClick={() => setBuildChoice("keep")}
              >
                Republish as build #{buildNum} anyway
              </Button>
            </div>
          )}

          {/* Version regression warning */}
          {isVersionDowngrade && (
            <div className="flex flex-col gap-2.5 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">
                  Version {version.trim()} is older than the current live release (v
                  {latestRelease?.version}). Use Rollback instead if you want to return to a previous
                  release.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-red-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={versionDowngradeConfirmed}
                  onChange={(e) => setVersionDowngradeConfirmed(e.target.checked)}
                  className="rounded border-red-300"
                />
                Publish this older version anyway
              </label>
            </div>
          )}

          {/* Min Android (editable) */}
          <div className="space-y-1.5">
            <Label>Minimum Android Version</Label>
            <Input
              placeholder="Android 9.0 (API 28)"
              value={minAndroid}
              onChange={(e) => setMinAndroid(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* Release notes (manual, never generated) */}
          <div className="space-y-1.5">
            <Label>Release Notes</Label>
            <Textarea
              placeholder={"- Fixed order refresh bug\n- Improved table status display\n- Added force-update support"}
              rows={4}
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* Force update toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Force Update</p>
              <p className="text-xs text-muted-foreground">
                Employees must update before they can use the app.
              </p>
            </div>
            <Switch
              checked={isForceUpdate}
              onCheckedChange={setIsForceUpdate}
              disabled={isPending}
            />
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1 border-t border-border">
        <Button type="submit" disabled={isPending || !canPublish} className="gap-1.5">
          <Upload className="w-3.5 h-3.5" />
          {isPending ? "Publishing…" : "Publish Release"}
        </Button>
        {(file || version) && (
          <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={isPending}>
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}

function ReleaseHistoryItem({
  release,
  isOwner,
}: {
  release: AppRelease;
  isOwner: boolean;
}) {
  const { toast } = useToast();
  const rollback = useRollbackRelease();
  const deleteRelease = useDeleteRelease();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const publishDate = new Date(release.published_at).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const handleRollback = async () => {
    try {
      await rollback.mutateAsync({ id: release.id, platform: release.platform });
      toast({ title: "Rolled back!", description: `v${release.version} is now the live release.` });
    } catch (err: any) {
      toast({ title: "Rollback failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      await deleteRelease.mutateAsync({ release });
      toast({ title: "Deleted", description: `v${release.version} has been removed.` });
      setConfirmDelete(false);
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      setConfirmDelete(false);
    }
  };

  // Auto-cancel confirm state after 4 s
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 4000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  return (
    <div className={cn(
      "flex flex-col sm:flex-row sm:items-start gap-4 p-4 rounded-xl border transition-colors",
      release.is_latest
        ? "bg-emerald-50 border-emerald-200"
        : "bg-card border-card-border hover:bg-muted/20"
    )}>
      {/* Timeline dot */}
      <div className="hidden sm:flex flex-col items-center pt-1 shrink-0">
        <div className={cn(
          "w-3 h-3 rounded-full border-2",
          release.is_latest ? "bg-emerald-500 border-emerald-500" : "bg-card border-border"
        )} />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-semibold text-sm text-foreground">v{release.version}</span>
          <span className="text-xs text-muted-foreground">build #{release.build_number}</span>
          {release.is_latest && <LatestBadge />}
          {release.is_force_update && <ForceUpdateBadge />}
          <span className="text-xs text-muted-foreground ml-auto">{publishDate}</span>
        </div>
        {(release.file_size || release.package_name || release.target_android_version) && (
          <p className="text-xs text-muted-foreground">
            {[release.file_size, release.package_name, release.target_android_version]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {release.release_notes && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-line">
            {release.release_notes}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {release.download_url && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(release.download_url!, "_blank")}
            className="gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </Button>
        )}
        {isOwner && !release.is_latest && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRollback}
            disabled={rollback.isPending}
            className="gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {rollback.isPending ? "Rolling back…" : "Rollback"}
          </Button>
        )}
        {isOwner && !release.is_latest && (
          <Button
            variant={confirmDelete ? "destructive" : "ghost"}
            size="sm"
            onClick={handleDelete}
            disabled={deleteRelease.isPending}
            className="gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleteRelease.isPending
              ? "Deleting…"
              : confirmDelete
              ? "Confirm delete"
              : "Delete"}
          </Button>
        )}
      </div>
    </div>
  );
}

function ReleaseHistorySection({
  platform,
  isOwner,
}: {
  platform: ActivePlatform;
  isOwner: boolean;
}) {
  const { data: releases = [], isLoading, error } = useReleaseHistory(platform);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
        <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-destructive">Failed to load release history</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Run migration 040 in Supabase if you haven't already.
          </p>
        </div>
      </div>
    );
  }

  if (releases.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <FileText className="w-8 h-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No releases published yet.</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-2 pl-0 sm:pl-4">
      {/* Timeline vertical line */}
      <div className="hidden sm:block absolute left-[5px] top-3 bottom-3 w-px bg-border" />
      {releases.map((r) => (
        <ReleaseHistoryItem key={r.id} release={r} isOwner={isOwner} />
      ))}
    </div>
  );
}

function PwaCard() {
  const { toast } = useToast();
  const appUrl = WEB_APP_URL || "https://your-app.replit.app";

  return (
    <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 text-blue-600 shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Web App (PWA)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Progressive Web App · No app store required</p>
          </div>
        </div>
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Available
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Install Cafe Maestro directly from your browser on any device.
      </p>
      <div className="flex flex-col items-center gap-2 py-1">
        <div className="p-3 bg-white border border-border rounded-xl">
          <QRCode value={appUrl} size={120} />
        </div>
        <p className="text-xs text-muted-foreground">Scan to open the web app</p>
      </div>
      <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
        <Button size="sm" onClick={() => window.open(appUrl, "_blank")} className="gap-1.5 flex-1 sm:flex-none">
          <ExternalLink className="w-3.5 h-3.5" />
          Open Web App
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            toast({
              title: "Install as PWA",
              description: "Open the app in Chrome or Safari, then use 'Add to Home Screen' from the browser menu.",
            })
          }
          className="gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Install as PWA
        </Button>
        <CopyButton text={appUrl} label="Web app link copied" />
      </div>
    </div>
  );
}

function ComingSoonCard({ id, label, description }: { id: string; label: string; description: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    windows: <Monitor className="w-5 h-5" />,
    macos: <Apple className="w-5 h-5" />,
    linux: <Monitor className="w-5 h-5" />,
    ios: <Apple className="w-5 h-5" />,
  };
  return (
    <div className="bg-card border border-card-border rounded-2xl p-5 flex flex-col gap-3 opacity-70">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted text-muted-foreground shrink-0">
            {iconMap[id] ?? <PackageOpen className="w-5 h-5" />}
          </div>
          <h3 className="font-semibold text-sm text-foreground">{label}</h3>
        </div>
        <Badge variant="outline" className="text-muted-foreground shrink-0">
          <Clock className="w-3 h-3 mr-1" />
          Soon
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

type DeviceUpdateStatus = "up-to-date" | "update-available" | "outdated";

function deviceUpdateStatus(
  device: StaffDeviceRow,
  latest: AppRelease | null | undefined
): DeviceUpdateStatus {
  if (!latest || device.build_number == null) return "up-to-date";
  if (device.build_number >= latest.build_number) return "up-to-date";
  return latest.is_force_update ? "outdated" : "update-available";
}

function DeviceStatusBadge({ status }: { status: DeviceUpdateStatus }) {
  if (status === "up-to-date") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 gap-1">
        <CheckCircle2 className="w-3 h-3" />
        Up To Date
      </Badge>
    );
  }
  if (status === "update-available") {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 gap-1">
        <Clock className="w-3 h-3" />
        Update Available
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 gap-1">
      <Zap className="w-3 h-3" />
      Outdated
    </Badge>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function DeviceVersionsCard() {
  const { data: devices = [], isLoading, error } = useStaffDevices();
  // Reuses the same query key as the Live Release card — when a new
  // Android release is published, this cache updates automatically
  // and every device's status recomputes without extra refetch logic.
  const { data: latestAndroid } = useLatestRelease("android");

  return (
    <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary shrink-0">
          <Smartphone className="w-4.5 h-4.5" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Device Versions</h3>
          <p className="text-xs text-muted-foreground">
            Staff Android devices and their installed app version.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Failed to load device data</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Run migration 041_staff_devices.sql in Supabase if you haven't already.
            </p>
          </div>
        </div>
      ) : devices.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Smartphone className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No staff devices have logged in yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
                <th className="px-2 py-2">Employee</th>
                <th className="px-2 py-2">Device</th>
                <th className="px-2 py-2">App Version</th>
                <th className="px-2 py-2">Last Seen</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => {
                const status = deviceUpdateStatus(d, latestAndroid);
                return (
                  <tr key={d.id} className="border-b border-border/50 last:border-0">
                    <td className="px-2 py-3 font-medium text-foreground">
                      {d.staff_users?.full_name ?? "—"}
                    </td>
                    <td className="px-2 py-3 text-muted-foreground">
                      {d.device_name ?? d.device_model ?? "—"}
                    </td>
                    <td className="px-2 py-3 text-muted-foreground">
                      {d.app_version ? `v${d.app_version}` : "—"}
                      {latestAndroid &&
                        d.build_number != null &&
                        d.build_number === latestAndroid.build_number && (
                          <span className="ml-1.5 text-[10px] text-emerald-600 font-medium">
                            (latest)
                          </span>
                        )}
                    </td>
                    <td className="px-2 py-3 text-muted-foreground">{timeAgo(d.last_seen)}</td>
                    <td className="px-2 py-3">
                      <DeviceStatusBadge status={status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PlatformTab({
  platform,
  active,
  onClick,
}: {
  platform: ActivePlatform;
  active: boolean;
  onClick: () => void;
}) {
  const meta = PLATFORM_META[platform];
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      <span className="shrink-0">{meta.icon}</span>
      {meta.label.split("—")[0].trim()}
      {active && <ChevronRight className="w-3 h-3 opacity-60" />}
    </button>
  );
}

export function DownloadsPage() {
  const { isOwner, isManagerOrAbove } = useAuth();
  const [activePlatform, setActivePlatform] = useState<ActivePlatform>("android");

  const { data: latestRelease, isLoading: latestLoading } = useLatestRelease(activePlatform);

  // Staff / chef guard (page is managerOrAbove in sidebar, but guard in case of direct URL)
  if (!isManagerOrAbove) {
    return (
      <div className="max-w-2xl mx-auto pb-8">
        <PageHeader title="App Releases" />
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Manager access required</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Only managers and owners can view app releases.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <PageHeader
        title="App Releases"
        subtitle="Publish and manage Android APKs · Database is the source of truth"
      />

      {/* Migration notice (shown only until first release exists) */}
      {!latestLoading && !latestRelease && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800 leading-relaxed">
            <p className="font-semibold mb-1">First-time setup</p>
            <p>
              Run migration <code className="bg-blue-100 px-1 rounded font-mono">040_app_releases.sql</code> in
              your Supabase SQL editor, then create the{" "}
              <code className="bg-blue-100 px-1 rounded font-mono">downloads</code> storage bucket using{" "}
              <code className="bg-blue-100 px-1 rounded font-mono">sql/create-storage-buckets.sql</code>.
              Once done, upload your first APK below.
            </p>
          </div>
        </div>
      )}

      {/* Platform tabs */}
      <div className="flex items-center gap-2 mb-6 p-1 bg-muted/40 rounded-xl w-fit">
        <PlatformTab
          platform="android"
          active={activePlatform === "android"}
          onClick={() => setActivePlatform("android")}
        />
        <PlatformTab
          platform="android-tv"
          active={activePlatform === "android-tv"}
          onClick={() => setActivePlatform("android-tv")}
        />
      </div>

      {/* ── Current Live Release ── */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
          Current Live Release
        </h2>
        {latestLoading ? (
          <div className="h-64 bg-muted/50 rounded-2xl animate-pulse" />
        ) : latestRelease ? (
          <LiveReleaseCard platform={activePlatform} release={latestRelease} />
        ) : (
          <NoReleaseCard platform={activePlatform} />
        )}
      </section>

      {/* ── Upload New Release (owner only) ── */}
      {isOwner && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
            Upload New Release
          </h2>
          <UploadForm platform={activePlatform} latestRelease={latestRelease ?? null} />
        </section>
      )}

      {/* Manager read-only notice */}
      {!isOwner && (
        <div className="mb-8 flex items-center gap-2.5 p-3.5 bg-muted/40 border border-border rounded-xl text-sm text-muted-foreground">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          Uploading and publishing new releases requires Owner access.
        </div>
      )}

      {/* ── Release History ── */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
          Release History
        </h2>
        <ReleaseHistorySection platform={activePlatform} isOwner={isOwner} />
      </section>

      {/* ── Device Versions (Android only) ── */}
      {activePlatform === "android" && (
        <section className="mb-10">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
            Device Versions
          </h2>
          <DeviceVersionsCard />
        </section>
      )}

      {/* ── Web PWA ── */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
          Web
        </h2>
        <div className="max-w-sm">
          <PwaCard />
        </div>
      </section>

      {/* ── Coming Soon ── */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
          Coming Soon
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {COMING_SOON_PLATFORMS.map((p) => (
            <ComingSoonCard key={p.id} id={p.id} label={p.label} description={p.description} />
          ))}
        </div>
      </section>
    </div>
  );
}
