import { useState, useEffect, useRef } from "react";
import {
  Users,
  UserPlus,
  Mail,
  Trash2,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useStaff,
  useUpdateMemberRole,
  useToggleMemberActive,
  useDeleteStaffUser,
  useCreateStaffMember,
} from "@/hooks/useStaff";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { StaffUser, UserRole, AuthUser } from "@/types";
import { ROLE_LABELS, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const ROLES: UserRole[] = ["owner", "manager", "staff", "chef"];

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: "Full access — manage staff, settings, and all content",
  manager: "Admin access — manage menu, bookings, gallery, and offers",
  staff: "Front of house — view orders and manage table sessions",
  chef: "Kitchen-only — view and update order items",
};

const ROLE_COLORS: Record<UserRole, string> = {
  owner: "bg-purple-100 text-purple-800 border-purple-200",
  manager: "bg-blue-100 text-blue-800 border-blue-200",
  staff: "bg-emerald-100 text-emerald-800 border-emerald-200",
  chef: "bg-amber-100 text-amber-800 border-amber-200",
};

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        ROLE_COLORS[role]
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

function canManageMember(viewer: AuthUser, member: StaffUser): boolean {
  if (member.id === viewer.id) return false;
  if (viewer.role === "owner") return member.role !== "owner";
  if (viewer.role === "manager")
    return member.role === "staff" || member.role === "chef";
  return false;
}

function canDeleteMember(viewer: AuthUser, member: StaffUser): boolean {
  return canManageMember(viewer, member);
}

function DeleteConfirmDialog({
  member,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  member: StaffUser | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  if (!member) return null;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {member.full_name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove <strong>{member.full_name}</strong> from active
            staff lists. Historical records including orders, sessions, and
            audit logs will remain intact.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_EXISTS_MSG = "An account with this email already exists.";

function CreateMemberDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const create = useCreateStaffMember();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("staff");
  const [result, setResult] = useState<{
    emailSent: boolean;
    tempPassword?: string;
    message: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Real-time email duplicate check ───────────────────────────
  const [emailFieldError, setEmailFieldError] = useState<string | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const trimmed = email.trim().toLowerCase();

    // Reset immediately when field clears or format is invalid
    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      setEmailFieldError(null);
      setEmailChecking(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }

    setEmailChecking(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc("check_email_exists", {
          p_email: trimmed,
        });
        if (error) {
          setEmailFieldError(null);
        } else if (data?.exists) {
          setEmailFieldError(EMAIL_EXISTS_MSG);
        } else {
          setEmailFieldError(null);
        }
      } catch {
        setEmailFieldError(null);
      } finally {
        setEmailChecking(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [email]);

  const emailFormatValid = EMAIL_RE.test(email.trim());
  const submitBlocked =
    create.isPending ||
    emailChecking ||
    !emailFormatValid ||
    !!emailFieldError;

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (submitBlocked) return;
    setErrorMsg(null);
    try {
      const data = await create.mutateAsync({ email: email.trim(), role, full_name: displayName });
      setResult({
        emailSent: data.email_sent,
        tempPassword: data.temp_password,
        message: data.message,
      });
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "";
      const msg = raw.includes("EMAIL_ALREADY_EXISTS") || raw.includes("already exists")
        ? EMAIL_EXISTS_MSG
        : raw || "Failed to create account. Please try again.";
      setErrorMsg(msg);
    }
  }

  function handleClose() {
    onOpenChange(false);
    setResult(null);
    setErrorMsg(null);
    setEmailFieldError(null);
    setEmailChecking(false);
    setEmail("");
    setDisplayName("");
    setRole("staff");
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add staff member</DialogTitle>
        </DialogHeader>
        {result ? (
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto">
              <Mail className="w-6 h-6" />
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">Account created!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {result.message}
              </p>
            </div>
            {!result.emailSent && result.tempPassword && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
                <p className="text-xs font-medium text-amber-800">
                  Email not sent — share these credentials manually:
                </p>
                <p className="text-xs text-amber-700">
                  <strong>Email:</strong> {email}
                </p>
                <p className="text-xs text-amber-700 flex items-center gap-1.5">
                  <strong>Temp password:</strong>
                  <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">
                    {result.tempPassword}
                  </code>
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Staff must change this password on first login.
                </p>
              </div>
            )}
            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handle} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full name *</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Jamie Smith"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@example.com"
                required
                className={emailFieldError ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {emailChecking && (
                <p className="text-xs text-muted-foreground">Checking…</p>
              )}
              {emailFieldError && !emailChecking && (
                <p className="text-xs text-destructive">{emailFieldError}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter((r) => r !== "owner").map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
            {errorMsg && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {errorMsg}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              A secure temporary password will be generated. Staff must set a
              new password on first login.
            </p>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitBlocked}>
                {create.isPending
                  ? "Creating…"
                  : emailChecking
                  ? "Checking…"
                  : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StaffPage() {
  const { data: members = [], isLoading, isError, error } = useStaff();
  const updateRole = useUpdateMemberRole();
  const toggleActive = useToggleMemberActive();
  const deleteUser = useDeleteStaffUser();
  const { user } = useAuth();

  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deletingMember, setDeletingMember] = useState<StaffUser | null>(null);

  const active = members.filter((m) => m.is_active);

  function handleDeleteConfirm() {
    if (!deletingMember) return;
    const name = deletingMember.full_name;
    deleteUser.mutate(deletingMember.id, {
      onSuccess: () => {
        setDeletingMember(null);
        toast({ title: `${name} has been removed` });
      },
      onError: (err) => {
        toast({
          title: "Failed to delete staff member",
          description: err instanceof Error ? err.message : "An unexpected error occurred",
          variant: "destructive",
        });
      },
    });
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl mx-auto">
        <PageHeader
          title="Staff"
          subtitle={`${active.length} active member${active.length !== 1 ? "s" : ""}`}
          actions={
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="w-4 h-4 mr-1.5" />
              Add member
            </Button>
          }
        />

        {/* Role legend */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {ROLES.map((role) => (
            <div
              key={role}
              className="p-3 bg-card border border-card-border rounded-xl shadow-sm"
            >
              <RoleBadge role={role} />
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
            <p className="font-medium">Failed to load staff members</p>
            <p className="mt-1 text-destructive/80">
              {error instanceof Error ? error.message : "An unexpected error occurred. Please refresh the page."}
            </p>
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No staff members yet"
            description="Add your team members to manage the cafe together."
            action={
              <Button onClick={() => setInviteOpen(true)}>
                <UserPlus className="w-4 h-4 mr-1.5" />
                Add first member
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {members.map((member) => {
              const isSelf = member.id === user?.id;
              const canManage = user ? canManageMember(user, member) : false;
              const canDelete = user ? canDeleteMember(user, member) : false;
              const isOwner = member.role === "owner";

              return (
                <div
                  key={member.id}
                  className={cn(
                    "flex items-center gap-4 p-4 bg-card border border-card-border rounded-xl shadow-sm",
                    !member.is_active && "opacity-60"
                  )}
                >
                  {/* Avatar */}
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                    {member.full_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground flex items-center gap-2 flex-wrap">
                      {member.full_name}
                      {isSelf && (
                        <span className="text-xs text-muted-foreground font-normal">
                          (you)
                        </span>
                      )}
                      {!member.is_active && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-4"
                        >
                          Disabled
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.email}
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      Joined {formatDate(member.created_at)}
                    </p>
                  </div>

                  {/* Role select */}
                  <Select
                    value={member.role}
                    onValueChange={(v) =>
                      updateRole.mutate({ id: member.id, role: v as UserRole })
                    }
                    disabled={isSelf || isOwner || !canManage}
                  >
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r} className="text-xs">
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Disable / Enable toggle — hidden for owners and self */}
                  {canManage && (
                    <Switch
                      checked={member.is_active}
                      onCheckedChange={(v) =>
                        toggleActive.mutate({ id: member.id, is_active: v })
                      }
                      title={member.is_active ? "Disable member" : "Enable member"}
                    />
                  )}

                  {/* Delete button — hidden for owners, self, and those without permission */}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => setDeletingMember(member)}
                      title={`Delete ${member.full_name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}

                  {/* Spacer so rows align when no action buttons */}
                  {!canManage && !isSelf && (
                    <div className="w-8 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <CreateMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />

        <DeleteConfirmDialog
          member={deletingMember}
          open={!!deletingMember}
          onOpenChange={(o) => {
            if (!o) setDeletingMember(null);
          }}
          onConfirm={handleDeleteConfirm}
          isPending={deleteUser.isPending}
        />
      </div>
    </AppLayout>
  );
}
