import { cn } from "@/lib/utils";

type PanelProps = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function Panel({
  title,
  description,
  action,
  className,
  children,
}: PanelProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-card p-5 shadow-soft",
        className,
      )}
    >
      {(title || description || action) && (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && (
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
