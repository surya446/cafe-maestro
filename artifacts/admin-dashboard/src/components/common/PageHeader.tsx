import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  subtitle?: string;
  action?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  icon: Icon,
  description,
  subtitle,
  action,
  actions,
  className,
}: PageHeaderProps) {
  const desc = description ?? subtitle;
  const actionContent = actions ?? action;

  return (
    <div className={cn("flex items-center justify-between gap-4 mb-5", className)}>
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-foreground leading-tight">{title}</h1>
          {desc && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{desc}</p>
          )}
        </div>
      </div>
      {actionContent && (
        <div className="flex items-center gap-2 shrink-0">{actionContent}</div>
      )}
    </div>
  );
}
