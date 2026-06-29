import { useState, useEffect, useRef } from "react";
import {
  Globe,
  Save,
  Upload,
  Trash2,
  Palette,
  Phone,
  Mail,
  MapPin,
  Instagram,
  Facebook,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  Link,
  Type,
  FileText,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import {
  useWebsiteSettings,
  useUpsertWebsiteSettings,
  useUploadWebsiteImage,
  useDeleteWebsiteImage,
} from "@/hooks/useWebsiteSettings";
import { OpeningHoursEntry } from "@/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_HOURS: OpeningHoursEntry[] = [
  { day: "Monday",    open: "08:00", close: "17:00", closed: false },
  { day: "Tuesday",   open: "08:00", close: "17:00", closed: false },
  { day: "Wednesday", open: "08:00", close: "17:00", closed: false },
  { day: "Thursday",  open: "08:00", close: "17:00", closed: false },
  { day: "Friday",    open: "08:00", close: "17:00", closed: false },
  { day: "Saturday",  open: "09:00", close: "15:00", closed: false },
  { day: "Sunday",    open: "09:00", close: "15:00", closed: true  },
];

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-start gap-4 px-6 py-5 border-b border-border bg-muted/30">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <label className="relative cursor-pointer">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
          />
          <div
            className="w-10 h-10 rounded-lg border-2 border-border shadow-sm transition-shadow hover:shadow-md"
            style={{ background: value }}
          />
        </label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#1a1a1a"
          className="font-mono text-sm uppercase w-32"
          maxLength={7}
        />
      </div>
    </div>
  );
}

function ImageUploadField({
  label,
  hint,
  previewUrl,
  uploading,
  onSelect,
  onRemove,
  accept,
}: {
  label: string;
  hint: string;
  previewUrl: string | null;
  uploading: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {previewUrl ? (
        <div className="relative inline-block">
          <img
            src={previewUrl}
            alt={label}
            className="h-24 w-auto max-w-xs rounded-lg border border-border object-cover shadow-sm"
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute -top-2 -right-2 flex items-center justify-center w-6 h-6 rounded-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/80 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "flex flex-col items-center justify-center gap-2 w-full h-28 rounded-xl border-2 border-dashed border-border",
            "text-muted-foreground text-sm font-medium transition-colors",
            "hover:border-primary/60 hover:bg-primary/5 hover:text-primary",
            uploading && "opacity-60 cursor-not-allowed"
          )}
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Upload className="w-5 h-5" />
          )}
          {uploading ? "Uploading…" : "Click to upload"}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept ?? "image/jpeg,image/png,image/webp,image/gif,image/svg+xml"}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSelect(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function WebsiteSettingsPage() {
  const { user, isOwner } = useAuth();
  const { toast } = useToast();
  const { data: settings, isLoading } = useWebsiteSettings();
  const upsert = useUpsertWebsiteSettings();
  const uploadImage = useUploadWebsiteImage();
  const deleteImage = useDeleteWebsiteImage();

  // ── Branding ─────────────────────────────────────────────────
  const [cafeName,       setCafeName]       = useState("");
  const [tagline,        setTagline]        = useState("");
  const [primaryColor,   setPrimaryColor]   = useState("#1a1a1a");
  const [secondaryColor, setSecondaryColor] = useState("#f5f0eb");
  const [logoUrl,        setLogoUrl]        = useState<string | null>(null);
  const [logoPath,       setLogoPath]       = useState<string | null>(null);

  // ── Hero ──────────────────────────────────────────────────────
  const [heroTitle,     setHeroTitle]     = useState("");
  const [heroSubtitle,  setHeroSubtitle]  = useState("");
  const [heroImageUrl,  setHeroImageUrl]  = useState<string | null>(null);
  const [heroImagePath, setHeroImagePath] = useState<string | null>(null);

  // ── About ─────────────────────────────────────────────────────
  const [aboutContent, setAboutContent] = useState("");

  // ── Contact ───────────────────────────────────────────────────
  const [address,       setAddress]       = useState("");
  const [phone,         setPhone]         = useState("");
  const [email,         setEmail]         = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");

  // ── Social ────────────────────────────────────────────────────
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl,  setFacebookUrl]  = useState("");

  // ── Opening hours ─────────────────────────────────────────────
  const [openingHours, setOpeningHours] = useState<OpeningHoursEntry[]>(DEFAULT_HOURS);

  // ── Upload tracking ───────────────────────────────────────────
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);

  // Sync from DB
  useEffect(() => {
    if (!settings) return;
    setCafeName(settings.cafe_name ?? "");
    setTagline(settings.tagline ?? "");
    setPrimaryColor(settings.primary_color ?? "#1a1a1a");
    setSecondaryColor(settings.secondary_color ?? "#f5f0eb");
    setLogoUrl(settings.logo_url);
    setLogoPath(settings.logo_path);
    setHeroTitle(settings.hero_title ?? "");
    setHeroSubtitle(settings.hero_subtitle ?? "");
    setHeroImageUrl(settings.hero_image_url);
    setHeroImagePath(settings.hero_image_path);
    setAboutContent(settings.about_content ?? "");
    setAddress(settings.address ?? "");
    setPhone(settings.phone ?? "");
    setEmail(settings.email ?? "");
    setGoogleMapsUrl(settings.google_maps_url ?? "");
    setInstagramUrl(settings.instagram_url ?? "");
    setFacebookUrl(settings.facebook_url ?? "");
    if (Array.isArray(settings.opening_hours) && settings.opening_hours.length > 0) {
      setOpeningHours(settings.opening_hours);
    }
  }, [settings]);

  function updateHours(index: number, patch: Partial<OpeningHoursEntry>) {
    setOpeningHours((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    );
  }

  async function handleLogoSelect(file: File) {
    setUploadingLogo(true);
    try {
      const { publicUrl, path } = await uploadImage.mutateAsync({ file, slot: "logo" });
      if (logoPath) await deleteImage.mutateAsync(logoPath).catch(() => {});
      setLogoUrl(publicUrl);
      setLogoPath(path);
    } catch {
      toast({ title: "Upload failed", description: "Could not upload logo.", variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleHeroSelect(file: File) {
    setUploadingHero(true);
    try {
      const { publicUrl, path } = await uploadImage.mutateAsync({ file, slot: "hero" });
      if (heroImagePath) await deleteImage.mutateAsync(heroImagePath).catch(() => {});
      setHeroImageUrl(publicUrl);
      setHeroImagePath(path);
    } catch {
      toast({ title: "Upload failed", description: "Could not upload hero image.", variant: "destructive" });
    } finally {
      setUploadingHero(false);
    }
  }

  async function handleSave() {
    try {
      await upsert.mutateAsync({
        cafe_name:       cafeName.trim()       || null,
        tagline:         tagline.trim()        || null,
        hero_title:      heroTitle.trim()      || null,
        hero_subtitle:   heroSubtitle.trim()   || null,
        about_content:   aboutContent.trim()   || null,
        logo_url:        logoUrl,
        logo_path:       logoPath,
        hero_image_url:  heroImageUrl,
        hero_image_path: heroImagePath,
        address:         address.trim()        || null,
        phone:           phone.trim()          || null,
        email:           email.trim()          || null,
        google_maps_url: googleMapsUrl.trim()  || null,
        instagram_url:   instagramUrl.trim()   || null,
        facebook_url:    facebookUrl.trim()    || null,
        opening_hours:   openingHours,
        primary_color:   primaryColor,
        secondary_color: secondaryColor,
      });
      toast({ title: "Saved", description: "Website settings updated successfully." });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  const saving = upsert.isPending;

  if (!isOwner) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
          <PageHeader title="Website Settings" />
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Owner access required</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Only cafe owners can manage website settings.
              </p>
            </div>
          </div>
        </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto pb-16">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <PageHeader
            title="Website Settings"
            subtitle="Control your public website's content and branding"
          />
          <div className="flex flex-col items-end gap-2 shrink-0 ml-4">
            <Button
              onClick={handleSave}
              disabled={saving || uploadingLogo || uploadingHero}
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Saving…</>
              ) : (
                <><Save className="w-4 h-4 mr-1.5" />Save changes</>
              )}
            </Button>
            <a
              href={`${import.meta.env.BASE_URL}cafe`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Visit website
            </a>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">

            {/* ── Branding ─────────────────────────────────────── */}
            <SectionCard
              icon={Palette}
              title="Branding"
              description="Your cafe name, tagline, logo and brand colours"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Cafe name</Label>
                  <Input
                    value={cafeName}
                    onChange={(e) => setCafeName(e.target.value)}
                    placeholder="Cup & Cozy"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tagline</Label>
                  <Input
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="Where every sip tells a story"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <ColorField
                  label="Primary colour"
                  value={primaryColor}
                  onChange={setPrimaryColor}
                />
                <ColorField
                  label="Secondary colour"
                  value={secondaryColor}
                  onChange={setSecondaryColor}
                />
              </div>
              <ImageUploadField
                label="Logo"
                hint="Recommended: PNG or SVG, square or landscape, max 5 MB"
                previewUrl={logoUrl}
                uploading={uploadingLogo}
                onSelect={handleLogoSelect}
                onRemove={() => { setLogoUrl(null); setLogoPath(null); }}
              />
            </SectionCard>

            {/* ── Hero Content ─────────────────────────────────── */}
            <SectionCard
              icon={ImageIcon}
              title="Hero Content"
              description="The large banner section at the top of your public website"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Hero title</Label>
                  <Input
                    value={heroTitle}
                    onChange={(e) => setHeroTitle(e.target.value)}
                    placeholder="Welcome to Cup & Cozy"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Hero subtitle</Label>
                  <Input
                    value={heroSubtitle}
                    onChange={(e) => setHeroSubtitle(e.target.value)}
                    placeholder="Artisan coffee · Fresh pastries"
                  />
                </div>
              </div>
              <ImageUploadField
                label="Hero image"
                hint="Recommended: landscape, at least 1920×800 px, max 5 MB"
                previewUrl={heroImageUrl}
                uploading={uploadingHero}
                onSelect={handleHeroSelect}
                onRemove={() => { setHeroImageUrl(null); setHeroImagePath(null); }}
              />
            </SectionCard>

            {/* ── About ────────────────────────────────────────── */}
            <SectionCard
              icon={FileText}
              title="About Content"
              description="Tell visitors the story of your cafe"
            >
              <div className="space-y-1.5">
                <Label>About text</Label>
                <Textarea
                  value={aboutContent}
                  onChange={(e) => setAboutContent(e.target.value)}
                  placeholder="Founded in 2012, Cup & Cozy is a neighbourhood institution…"
                  rows={6}
                  className="resize-y"
                />
                <p className="text-xs text-muted-foreground">
                  Plain text. Line breaks will be preserved.
                </p>
              </div>
            </SectionCard>

            {/* ── Contact ──────────────────────────────────────── */}
            <SectionCard
              icon={MapPin}
              title="Contact"
              description="How visitors can reach or find you"
            >
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 High Street, Melbourne VIC 3000"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> Phone
                    </span>
                  </Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+61 3 1234 5678"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> Email
                    </span>
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hello@cupcandcozy.com.au"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>
                  <span className="flex items-center gap-1.5">
                    <Link className="w-3.5 h-3.5" /> Google Maps URL
                  </span>
                </Label>
                <Input
                  value={googleMapsUrl}
                  onChange={(e) => setGoogleMapsUrl(e.target.value)}
                  placeholder="https://maps.google.com/?q=…"
                />
              </div>
            </SectionCard>

            {/* ── Social Links ─────────────────────────────────── */}
            <SectionCard
              icon={Globe}
              title="Social Links"
              description="Connect your social media profiles"
            >
              <div className="space-y-1.5">
                <Label>
                  <span className="flex items-center gap-1.5">
                    <Instagram className="w-3.5 h-3.5" /> Instagram
                  </span>
                </Label>
                <Input
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://instagram.com/yourcafe"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  <span className="flex items-center gap-1.5">
                    <Facebook className="w-3.5 h-3.5" /> Facebook
                  </span>
                </Label>
                <Input
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder="https://facebook.com/yourcafe"
                />
              </div>
            </SectionCard>

            {/* ── Opening Hours ─────────────────────────────────── */}
            <SectionCard
              icon={Clock}
              title="Opening Hours"
              description="Set your weekly schedule"
            >
              <div className="divide-y divide-border -mx-6 px-6">
                {openingHours.map((entry, i) => (
                  <div
                    key={entry.day}
                    className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="text-sm font-medium text-foreground w-28 shrink-0">
                      {entry.day}
                    </span>
                    <div className="flex items-center gap-2 ml-auto">
                      {entry.closed ? (
                        <span className="text-sm text-muted-foreground italic px-2">Closed</span>
                      ) : (
                        <>
                          <input
                            type="time"
                            value={entry.open}
                            onChange={(e) => updateHours(i, { open: e.target.value })}
                            className="text-sm border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                          />
                          <span className="text-muted-foreground text-xs">–</span>
                          <input
                            type="time"
                            value={entry.close}
                            onChange={(e) => updateHours(i, { close: e.target.value })}
                            className="text-sm border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                          />
                        </>
                      )}
                      <Switch
                        checked={!entry.closed}
                        onCheckedChange={(open) => updateHours(i, { closed: !open })}
                        className="ml-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* ── Bottom save ───────────────────────────────────── */}
            <div className="flex flex-col items-end gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={saving || uploadingLogo || uploadingHero}
                size="lg"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Saving…</>
                ) : (
                  <><Save className="w-4 h-4 mr-1.5" />Save all changes</>
                )}
              </Button>
              <a
                href={`${import.meta.env.BASE_URL}cafe`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Visit website
              </a>
            </div>
          </div>
        )}
      </div>
  );
}
