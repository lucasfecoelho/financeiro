import type { ApiInvoice, ApiTransaction } from "./apiTypes";
import type { InvoiceSummary, Transaction } from "@/types";

const paymentMethodLabels: Record<ApiTransaction["paymentMethod"], string> = {
  credit: "Crédito",
  debit: "Débito",
  account: "Conta",
  adjustment: "Ajuste",
};

const sourceLabels: Record<ApiTransaction["source"], string> = {
  manual: "Manual",
  ofx: "OFX",
  pdf_invoice: "Fatura PDF",
};

export function mapApiTransaction(transaction: ApiTransaction): Transaction {
  return {
    id: transaction.id,
    date: transaction.date,
    description:
      transaction.descriptionClean || transaction.descriptionOriginal || "Sem descrição",
    category: transaction.category?.name ?? "A revisar",
    source: sourceLabels[transaction.source],
    paymentMethod: paymentMethodLabels[transaction.paymentMethod],
    value:
      transaction.direction === "expense"
        ? -Math.abs(transaction.amount)
        : Math.abs(transaction.amount),
    status: transaction.reviewStatus === "needs_review" ? "pending" : "reviewed",
  };
}

export function mapApiInvoiceToSummary(invoice: ApiInvoice): InvoiceSummary {
  const totalFromFile = invoice.totalFromFile ?? 0;
  const totalCalculated = invoice.totalCalculated ?? 0;

  return {
    informedTotal: totalFromFile,
    calculatedTotal: totalCalculated,
    difference: totalFromFile - totalCalculated,
    dueDate: buildDate(invoice.referenceYear, invoice.referenceMonth, invoice.dueDay),
    closingDate: buildDate(
      invoice.referenceYear,
      invoice.referenceMonth,
      invoice.closingDay,
    ),
    status: invoice.status,
  };
}

function buildDate(year: number, month: number, day: number) {
  const normalizedMonth = String(month).padStart(2, "0");
  const normalizedDay = String(day).padStart(2, "0");
  return `${year}-${normalizedMonth}-${normalizedDay}`;
}
