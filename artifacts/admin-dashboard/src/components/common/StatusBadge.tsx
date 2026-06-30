import { cn } from "@/lib/utils";

type StatusVariant =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "active"
  | "success"
  | "warning"
  | "info"
  | "default";

const VARIANT_STYLES: Record<StatusVariant, string> = {
  pending:   "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  active:    "bg-blue-100 text-blue-800 border-blue-200",
  success:   "bg-emerald-100 text-emerald-800 border-emerald-200",
  warning:   "bg-amber-100 text-amber-800 border-amber-200",
  info:      "bg-blue-100 text-blue-800 border-blue-200",
  default:   "bg-muted text-muted-foreground border-border",
};

interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
  className?: string;
}

export function StatusBadge({
  label,
  variant = "default",
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        VARIANT_STYLES[variant],
        className
      )}
    >
      {label}
    </span>
  );
}

export function bookingStatusVariant(
  status: string
): StatusVariant {
  switch (status) {
    case "pending": return "pending";
    case "confirmed": return "confirmed";
    case "seated": return "active";
    case "cancelled": return "cancelled";
    case "no_show": return "cancelled";
    default: return "default";
  }
}

export function orderStatusVariant(status: string): StatusVariant {
  switch (status) {
    case "pending_approval": return "pending";
    case "approved": return "info";
    case "in_kitchen": return "warning";
    case "ready": return "confirmed";
    case "served": return "success";
    case "cancelled": return "cancelled";
    default: return "default";
  }
}
