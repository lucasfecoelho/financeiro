import { cn } from "@/lib/utils";

type StatusPillProps = {
  tone: "positive" | "negative" | "review" | "invoiceOpen" | "invoicePaid" | "neutral";
  children: React.ReactNode;
};

const toneClasses: Record<StatusPillProps["tone"], string> = {
  positive: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  negative: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-200",
  review: "border-amber-500/20 bg-amber-400/15 text-amber-700 dark:text-amber-200",
  invoiceOpen: "border-cyan-500/20 bg-cyan-400/10 text-cyan-700 dark:text-cyan-100",
  invoicePaid: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  neutral: "border-border bg-secondary text-muted-foreground",
};

export function StatusPill({ tone, children }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}
