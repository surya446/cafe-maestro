import { useState } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Mail,
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
  CreateStaffResult,
} from "@/hooks/useStaff";
import { useAuth } from "@/hooks/useAuth";
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

// ── Copy button with transient ✓ feedback ─────────────────────

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "shrink-0 p-1.5 rounded transition-colors",
        copied
          ? "text-emerald-600 bg-emerald-50"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
      title={label ?? "Copy"}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Credentials card shown after account creation ─────────────

function CredentialsCard({ result, name }: { result: CreateStaffResult; name: string }) {
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="space-y-4">
      {result.email_sent ? (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Mail className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-sm">
            Credentials emailed to <strong>{result.email}</strong>.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Share these credentials with <strong>{name}</strong>. They will be
          asked to set a permanent password on first login.
        </p>
      )}

      <div className="rounded-xl border border-card-border bg-muted/40 divide-y divide-card-border overflow-hidden">
        {/* Email */}
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
              Email
            </p>
            <p className="text-sm font-medium truncate">{result.email}</p>
          </div>
          <CopyButton value={result.email} label="Copy email" />
        </div>

        {/* Temporary password */}
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
              Temporary password
            </p>
            <p className="text-sm font-mono font-medium tracking-widest">
              {showPass ? result.temp_password : "•".repeat(result.temp_password.length)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            className="shrink-0 p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={showPass ? "Hide password" : "Reveal password"}
          >
            {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <CopyButton value={result.temp_password} label="Copy password" />
        </div>

        {/* Login URL */}
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
              Login URL
            </p>
            <a
              href={result.login_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1 truncate"
            >
              {result.login_url}
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
          <CopyButton value={result.login_url} label="Copy login URL" />
        </div>
      </div>
    </div>
  );
}

// ── Add Member dialog ─────────────────────────────────────────

function AddMemberDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const createMember = useCreateStaffMember();
  const [fullName, setFullName]     = useState("");
  const [email, setEmail]           = useState("");
  const [role, setRole]             = useState<UserRole>("staff");
  const [result, setResult]         = useState<CreateStaffResult | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  function handleClose() {
    onOpenChange(false);
    // Reset after close animation
    setTimeout(() => {
      setFullName("");
      setEmail("");
      setRole("staff");
      setResult(null);
      setCreateError(null);
    }, 200);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      const data = await createMember.mutateAsync({
        email,
        role,
        full_name: fullName,
      });
      setResult(data);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to create account. Please try again.";
      setCreateError(msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {result ? "Account created" : "Add staff member"}
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <>
            <CredentialsCard result={result} name={fullName} />
            <DialogFooter>
              <Button className="w-full" onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full name *</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jamie Lee"
                required
                disabled={createMember.isPending}
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
                disabled={createMember.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as UserRole)}
                disabled={createMember.isPending}
              >
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

            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={handleClose}
                disabled={createMember.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMember.isPending}>
                {createMember.isPending ? "Creating…" : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Delete confirmation dialog ────────────────────────────────

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

// ── Main page ─────────────────────────────────────────────────

export function StaffPage() {
  const { data: members = [], isLoading } = useStaff();
  const updateRole    = useUpdateMemberRole();
  const toggleActive  = useToggleMemberActive();
  const deleteUser    = useDeleteStaffUser();
  const { user }      = useAuth();

  const [addOpen, setAddOpen]           = useState(false);
  const [deletingMember, setDeletingMember] = useState<StaffUser | null>(null);

  const active = members.filter((m) => m.is_active);

  function handleDeleteConfirm() {
    if (!deletingMember) return;
    deleteUser.mutate(deletingMember.id, {
      onSuccess: () => setDeletingMember(null),
    });
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl mx-auto">
        <PageHeader
          title="Staff"
          subtitle={`${active.length} active member${active.length !== 1 ? "s" : ""}`}
          actions={
            <Button onClick={() => setAddOpen(true)}>
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
        ) : members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No staff members yet"
            description="Add your team to manage the cafe together."
            action={
              <Button onClick={() => setAddOpen(true)}>
                <UserPlus className="w-4 h-4 mr-1.5" />
                Add first member
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {members.map((member) => {
              const isSelf    = member.id === user?.id;
              const canManage = user ? canManageMember(user, member) : false;
              const canDelete = user ? canDeleteMember(user, member) : false;
              const isOwner   = member.role === "owner";

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
                      {member.must_change_password && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-4 border-amber-300 text-amber-700 bg-amber-50"
                        >
                          Pending first login
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.email} · Joined {formatDate(member.created_at)}
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

                  {/* Disable / Enable toggle */}
                  {canManage && (
                    <Switch
                      checked={member.is_active}
                      onCheckedChange={(v) =>
                        toggleActive.mutate({ id: member.id, is_active: v })
                      }
                      title={
                        member.is_active ? "Disable member" : "Enable member"
                      }
                    />
                  )}

                  {/* Delete button */}
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
                  {!canManage && !isSelf && <div className="w-8 shrink-0" />}
                </div>
              );
            })}
          </div>
        )}

        <AddMemberDialog open={addOpen} onOpenChange={setAddOpen} />

        <DeleteConfirmDialog
          member={deletingMember}
          open={!!deletingMember}
          onOpenChange={(o) => { if (!o) setDeletingMember(null); }}
          onConfirm={handleDeleteConfirm}
          isPending={deleteUser.isPending}
        />
      </div>
    </AppLayout>
  );
}
