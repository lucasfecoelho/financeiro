import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Metric } from "@/types";

type MetricCardProps = {
  metric: Metric;
};

const toneClasses = {
  positive: "text-emerald-300 bg-emerald-400/10 border-emerald-300/20",
  negative: "text-rose-300 bg-rose-400/10 border-rose-300/20",
  neutral: "text-cyan-200 bg-cyan-400/10 border-cyan-200/20",
  review: "text-amber-200 bg-amber-300/10 border-amber-200/20",
  invoice: "text-amber-200 bg-amber-300/10 border-amber-200/20",
};

export function MetricCard({ metric }: MetricCardProps) {
  const Icon = metric.icon;

  return (
    <article className="surface-hover rounded-2xl border border-border/80 bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{metric.label}</p>
          <p
            className={cn(
              "mt-3 text-2xl font-extrabold tracking-tight",
              metric.value < 0 ? "text-rose-200" : "text-foreground",
            )}
          >
            {metric.format === "number" ? metric.value : formatCurrency(metric.value)}
          </p>
        </div>
        <div
          className={cn(
            "flex size-11 items-center justify-center rounded-xl border",
            toneClasses[metric.tone],
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{metric.helper}</p>
    </article>
  );
}
