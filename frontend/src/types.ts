import type { LucideIcon } from "lucide-react";

export type PageId =
  | "inicio"
  | "importar"
  | "lancamentos"
  | "fatura-caixa"
  | "configuracoes";

export type ReviewStatus = "reviewed" | "pending";

export type InvoiceStatus = "open" | "closed" | "paid";

export type Tone = "positive" | "negative" | "neutral" | "review" | "invoice";

export type NavItem = {
  id: PageId;
  label: string;
  icon: LucideIcon;
};

export type Metric = {
  label: string;
  value: number;
  helper: string;
  tone: Tone;
  icon: LucideIcon;
  format?: "currency" | "number";
};

export type Transaction = {
  id: string;
  date: string;
  description: string;
  category: string;
  source: string;
  paymentMethod: string;
  value: number;
  status: ReviewStatus;
};

export type CategorySpend = {
  name: string;
  value: number;
  color: string;
  icon: LucideIcon;
};

export type InvoiceSummary = {
  informedTotal: number;
  calculatedTotal: number;
  difference: number;
  dueDate: string;
  closingDate: string;
  status: InvoiceStatus;
};

export type CreditCardPurchase = {
  id: string;
  date: string;
  description: string;
  category: string;
  value: number;
  type: "national" | "international";
};
