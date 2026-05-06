import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";
import { StatusPill } from "./StatusPill";

type TransactionListProps = {
  transactions: Transaction[];
  compact?: boolean;
};

export function TransactionList({ transactions, compact }: TransactionListProps) {
  return (
    <div className="divide-y divide-border/80">
      {transactions.map((transaction) => (
        <div
          key={transaction.id}
          className={cn(
            "grid gap-3 py-4 text-sm sm:grid-cols-[84px_minmax(180px,1fr)_120px_130px_120px]",
            compact && "sm:grid-cols-[72px_minmax(160px,1fr)_112px]",
          )}
        >
          <div className="text-muted-foreground">{formatDate(transaction.date)}</div>
          <div>
            <p className="font-medium text-foreground">{transaction.description}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {transaction.source} · {transaction.paymentMethod}
            </p>
          </div>
          <div className="text-muted-foreground">{transaction.category}</div>
          {!compact && (
            <div>
              <StatusPill
                tone={transaction.status === "pending" ? "review" : "invoicePaid"}
              >
                {transaction.status === "pending" ? "a revisar" : "revisado"}
              </StatusPill>
            </div>
          )}
          <div
            className={cn(
              "font-semibold sm:text-right",
              transaction.value < 0 ? "text-rose-200" : "text-emerald-200",
            )}
          >
            {formatCurrency(transaction.value)}
          </div>
        </div>
      ))}
    </div>
  );
}
