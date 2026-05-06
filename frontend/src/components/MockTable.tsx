import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";
import { StatusPill } from "./StatusPill";

type MockTableProps = {
  rows: Transaction[];
};

export function MockTable({ rows }: MockTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="hidden grid-cols-[92px_minmax(220px,1.3fr)_120px_120px_128px_120px_118px] gap-4 bg-secondary/70 px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground xl:grid">
        <span>Data</span>
        <span>Descrição</span>
        <span>Categoria</span>
        <span>Origem</span>
        <span>Pagamento</span>
        <span className="text-right">Valor</span>
        <span>Status</span>
      </div>
      <div className="divide-y divide-border/80">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid gap-3 px-4 py-4 text-sm xl:grid-cols-[92px_minmax(220px,1.3fr)_120px_120px_128px_120px_118px] xl:items-center xl:gap-4"
          >
            <span className="text-muted-foreground">{formatDate(row.date)}</span>
            <span className="font-medium text-foreground">{row.description}</span>
            <span className="text-muted-foreground">{row.category}</span>
            <span className="text-muted-foreground">{row.source}</span>
            <span className="text-muted-foreground">{row.paymentMethod}</span>
            <span
              className={cn(
                "font-semibold xl:text-right",
                row.value < 0 ? "text-rose-200" : "text-emerald-200",
              )}
            >
              {formatCurrency(row.value)}
            </span>
            <StatusPill tone={row.status === "pending" ? "review" : "invoicePaid"}>
              {row.status === "pending" ? "a revisar" : "revisado"}
            </StatusPill>
          </div>
        ))}
      </div>
    </div>
  );
}
