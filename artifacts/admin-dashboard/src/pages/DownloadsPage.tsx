import { useState } from "react";
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
  Package,
  History,
  FileText,
  Zap,
  Bug,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import QRCode from "react-qr-code";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  PLATFORMS,
  LATEST_RELEASE,
  VERSION_HISTORY,
  CURRENT_VERSION,
  type PlatformDownload,
} from "@/config/downloads";

const WEB_APP_URL = typeof window !== "undefined" ? window.location.origin : "";

function PlatformIcon({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  const cls = cn("shrink-0", className);
  if (id === "android" || id === "android-tv") return <Smartphone className={cls} />;
  if (id === "windows") return <Monitor className={cls} />;
  if (id === "macos" || id === "ios") return <Apple className={cls} />;
  if (id === "linux") return <Monitor className={cls} />;
  if (id === "pwa") return <Globe className={cls} />;
  return <Package className={cls} />;
}

function StatusBadge({ status }: { status: PlatformDownload["status"] }) {
  if (status === "available") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Available
      </Badge>
    );
  }
  if (status === "beta") {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
        Beta
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <Clock className="w-3 h-3 mr-1" />
      Coming Soon
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

function AndroidCard({ item }: { item: PlatformDownload }) {
  const { toast } = useToast();
  const isTV = item.id === "android-tv";

  const handleDownload = () => {
    if (item.downloadUrl) {
      window.open(item.downloadUrl, "_blank");
    } else {
      toast({ title: "APK not yet published", description: "Configure downloadUrl in src/config/downloads.ts", variant: "destructive" });
    }
  };

  return (
    <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center w-12 h-12 rounded-xl shrink-0",
            isTV ? "bg-purple-100 text-purple-600" : "bg-emerald-100 text-emerald-600"
          )}>
            {isTV ? <Tv2 className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{item.label}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{item.platform}</p>
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground">{item.description}</p>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-3">
        {item.version && (
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Version</p>
            <p className="text-sm font-semibold text-foreground">v{item.version}</p>
          </div>
        )}
        {item.buildDate && (
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Build Date</p>
            <p className="text-sm font-semibold text-foreground">{item.buildDate}</p>
          </div>
        )}
        {item.minOs && (
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Minimum OS</p>
            <p className="text-sm font-semibold text-foreground">{item.minOs}</p>
          </div>
        )}
        {item.fileSize && (
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">APK Size</p>
            <p className="text-sm font-semibold text-foreground">{item.fileSize}</p>
          </div>
        )}
      </div>

      {/* Release notes summary */}
      {item.releaseNotesSummary && (
        <div className="bg-muted/30 border border-border rounded-lg p-3">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Release Notes</p>
          <p className="text-xs text-foreground">{item.releaseNotesSummary}</p>
        </div>
      )}

      {/* QR Code */}
      {item.qrUrl || item.downloadUrl ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="p-3 bg-white border border-border rounded-xl">
            <QRCode
              value={item.qrUrl || item.downloadUrl || WEB_APP_URL}
              size={128}
            />
          </div>
          <p className="text-xs text-muted-foreground">Scan to download APK</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="p-3 bg-muted/30 border border-dashed border-border rounded-xl w-[154px] h-[154px] flex items-center justify-center">
            <p className="text-xs text-muted-foreground text-center">QR code will appear once APK URL is configured</p>
          </div>
        </div>
      )}

      {/* Build status */}
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-2 h-2 rounded-full",
          item.downloadUrl ? "bg-emerald-500" : "bg-amber-400"
        )} />
        <p className="text-xs text-muted-foreground">
          {item.downloadUrl ? "Build published" : "Awaiting APK upload — configure downloadUrl in downloads.ts"}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
        <Button
          size="sm"
          onClick={handleDownload}
          className="gap-1.5 flex-1 sm:flex-none"
        >
          <Download className="w-3.5 h-3.5" />
          Download APK
        </Button>
        <CopyButton
          text={item.downloadUrl || WEB_APP_URL}
          label="APK download link copied"
        />
      </div>
    </div>
  );
}

function ComingSoonCard({ item }: { item: PlatformDownload }) {
  return (
    <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm flex flex-col gap-4 opacity-70">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted text-muted-foreground shrink-0">
            <PlatformIcon id={item.id} className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{item.label}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{item.platform}</p>
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <p className="text-sm text-muted-foreground">{item.description}</p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-auto pt-2 border-t border-border">
        <Clock className="w-3.5 h-3.5" />
        Planned for a future release
      </div>
    </div>
  );
}

function PwaCard() {
  const { toast } = useToast();
  const appUrl = WEB_APP_URL || "https://your-app.replit.app";

  const handleInstall = () => {
    toast({
      title: "Install as PWA",
      description: "Open the app in Chrome or Safari, then use 'Add to Home Screen' from the browser menu.",
    });
  };

  return (
    <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 text-blue-600 shrink-0">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Web App (PWA)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Progressive Web App</p>
          </div>
        </div>
        <StatusBadge status="available" />
      </div>

      <p className="text-sm text-muted-foreground">
        Install Cafe Maestro directly from your browser — no app store required. Works on any device with a modern browser.
      </p>

      <div className="flex flex-col items-center gap-2 py-2">
        <div className="p-3 bg-white border border-border rounded-xl">
          <QRCode value={appUrl} size={128} />
        </div>
        <p className="text-xs text-muted-foreground">Scan to open the web app</p>
      </div>

      <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
        <Button
          size="sm"
          onClick={() => window.open(appUrl, "_blank")}
          className="gap-1.5 flex-1 sm:flex-none"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open Web App
        </Button>
        <Button variant="outline" size="sm" onClick={handleInstall} className="gap-1.5">
          <Download className="w-3.5 h-3.5" />
          Install as PWA
        </Button>
        <CopyButton text={appUrl} label="Web app link copied" />
      </div>
    </div>
  );
}

function ReleaseNotesCard() {
  return (
    <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Release Notes</h3>
          <p className="text-xs text-muted-foreground">v{LATEST_RELEASE.version} · {LATEST_RELEASE.releaseDate}</p>
        </div>
      </div>

      <div className="space-y-5">
        {LATEST_RELEASE.features.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="w-3.5 h-3.5 text-blue-500" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">New Features</p>
            </div>
            <ul className="space-y-1.5">
              {LATEST_RELEASE.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {LATEST_RELEASE.fixes.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Bug className="w-3.5 h-3.5 text-red-500" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Bug Fixes</p>
            </div>
            <ul className="space-y-1.5">
              {LATEST_RELEASE.fixes.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {LATEST_RELEASE.perf.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Performance</p>
            </div>
            <ul className="space-y-1.5">
              {LATEST_RELEASE.perf.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function VersionHistoryCard() {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? VERSION_HISTORY : VERSION_HISTORY.slice(0, 5);

  return (
    <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted text-muted-foreground shrink-0">
          <History className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Version History</h3>
          <p className="text-xs text-muted-foreground">{VERSION_HISTORY.length} release{VERSION_HISTORY.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

        <div className="space-y-5">
          {shown.map((entry, i) => (
            <div key={entry.version} className="flex gap-4 relative">
              <div className={cn(
                "w-3.5 h-3.5 rounded-full border-2 shrink-0 mt-0.5 z-10",
                i === 0
                  ? "bg-primary border-primary"
                  : "bg-card border-border"
              )} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground">v{entry.version}</span>
                  {i === 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Latest</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{entry.summary}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {VERSION_HISTORY.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-4 pt-4 border-t border-border"
        >
          {expanded ? (
            <><ChevronUp className="w-3.5 h-3.5" />Show less</>
          ) : (
            <><ChevronDown className="w-3.5 h-3.5" />Show all {VERSION_HISTORY.length} versions</>
          )}
        </button>
      )}
    </div>
  );
}

function CapacitorReadinessCard() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Building the Android APK</p>
          <p className="text-xs text-blue-700 mt-1 leading-relaxed">
            This project is Capacitor-ready. Run the following commands in the{" "}
            <code className="bg-blue-100 px-1 rounded font-mono">artifacts/admin-dashboard</code>{" "}
            directory to generate the Android project:
          </p>
          <div className="mt-3 space-y-1.5">
            {[
              "pnpm run build:cap",
              "npx cap sync android",
              "# Then open android/ in Android Studio to build the APK",
            ].map((cmd) => (
              <code
                key={cmd}
                className={cn(
                  "block text-xs font-mono px-3 py-1.5 rounded",
                  cmd.startsWith("#")
                    ? "text-blue-500"
                    : "bg-blue-100 text-blue-900"
                )}
              >
                {cmd}
              </code>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DownloadsPage() {
  const android = PLATFORMS.find((p) => p.id === "android")!;
  const androidTv = PLATFORMS.find((p) => p.id === "android-tv")!;
  const comingSoon = PLATFORMS.filter((p) => p.status === "coming_soon");

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <PageHeader
        title="Downloads"
        subtitle={`Distribute Cafe Maestro clients · Current version v${CURRENT_VERSION}`}
      />

      {/* Capacitor readiness banner */}
      <div className="mb-8">
        <CapacitorReadinessCard />
      </div>

      {/* Android apps */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
          Android
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <AndroidCard item={android} />
          <AndroidCard item={androidTv} />
        </div>
      </section>

      {/* PWA */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
          Web
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <PwaCard />
        </div>
      </section>

      {/* Coming soon */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
          Coming Soon
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {comingSoon.map((item) => (
            <ComingSoonCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* Release notes + Version history */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
          Release Information
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ReleaseNotesCard />
          <VersionHistoryCard />
        </div>
      </section>
    </div>
  );
}
