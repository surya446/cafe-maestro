import { useState } from "react";
import { Settings, Coffee, Save, AlertCircle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Cafe } from "@/types";

const TIMEZONES = [
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Perth",
  "Australia/Adelaide",
  "Australia/Hobart",
  "Australia/Darwin",
  "Pacific/Auckland",
];

export function SettingsPage() {
  const { user, isOwner } = useAuth();
  const qc = useQueryClient();

  const { data: cafe, isLoading } = useQuery({
    queryKey: ["cafe", user?.cafeId],
    queryFn: async (): Promise<Cafe | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("cafes")
        .select("*")
        .eq("id", user.cafeId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const updateCafe = useMutation({
    mutationFn: async (updates: Partial<Cafe>) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("cafes")
        .update(updates)
        .eq("id", user.cafeId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cafe", user?.cafeId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [timezone, setTimezone] = useState("");
  const [saved, setSaved] = useState(false);

  // Sync state when cafe loads
  useState(() => {
    if (cafe) {
      setName(cafe.name);
      setLogoUrl(cafe.logo_url ?? "");
      setTimezone(cafe.timezone);
    }
  });

  if (!isOwner) {
    return (
      <AppLayout>
        <div className="p-8 max-w-3xl mx-auto">
          <PageHeader title="Settings" />
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Owner access required</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Only cafe owners can manage settings.
              </p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-2xl mx-auto">
        <PageHeader
          title="Settings"
          subtitle="Manage your cafe's public information"
        />

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm space-y-6">
            {/* Cafe logo preview */}
            <div className="flex items-center gap-4 pb-6 border-b border-border">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-sidebar text-sidebar-primary shrink-0 overflow-hidden">
                {(logoUrl || cafe?.logo_url) ? (
                  <img
                    src={logoUrl || cafe?.logo_url!}
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Coffee className="w-8 h-8" />
                )}
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {name || cafe?.name || "Your Cafe"}
                </p>
                <p className="text-sm text-muted-foreground">{cafe?.slug}</p>
              </div>
            </div>

            {/* Fields */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Cafe name *</Label>
                <Input
                  value={name || (cafe?.name ?? "")}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Cup & Cozy"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Logo URL</Label>
                <Input
                  value={logoUrl || (cafe?.logo_url ?? "")}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <Select
                  value={timezone || (cafe?.timezone ?? "")}
                  onValueChange={setTimezone}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Save */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              {saved && (
                <p className="text-sm text-emerald-600 font-medium">
                  ✓ Saved successfully
                </p>
              )}
              <Button
                onClick={() =>
                  updateCafe.mutate({
                    name: name || cafe?.name,
                    logo_url: logoUrl || null,
                    timezone: timezone || cafe?.timezone,
                  })
                }
                disabled={updateCafe.isPending}
              >
                <Save className="w-4 h-4 mr-1.5" />
                {updateCafe.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
