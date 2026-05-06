import { cn } from "@/lib/utils";

type StatusPillProps = {
  tone: "positive" | "negative" | "review" | "invoiceOpen" | "invoicePaid" | "neutral";
  children: React.ReactNode;
};

const toneClasses: Record<StatusPillProps["tone"], string> = {
  positive: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
  negative: "border-rose-300/20 bg-rose-400/10 text-rose-200",
  review: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  invoiceOpen: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
  invoicePaid: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
  neutral: "border-border bg-secondary text-muted-foreground",
};

export function StatusPill({ tone, children }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}
