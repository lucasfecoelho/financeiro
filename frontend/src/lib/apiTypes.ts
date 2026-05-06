export type ApiCategory = {
  id: string;
  name: string;
  type: "income" | "expense" | "neutral";
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiSetting = {
  id: string;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiBackup = {
  name: string;
  date: string;
  size: number;
  directory?: string;
};

export type ApiAiStatus = {
  enabled: boolean;
  model: string | null;
  message: string;
};

export type ApiCategoryRule = {
  id: string;
  pattern: string;
  matchType: "contains" | "starts_with" | "equals" | "regex";
  categoryId: string;
  category: ApiCategory;
  descriptionClean: string | null;
  paymentMethod: "credit" | "debit" | "account" | "adjustment" | null;
  createdAt: string;
  updatedAt: string;
};

export type CategoryRuleInput = {
  pattern: string;
  matchType: ApiCategoryRule["matchType"];
  categoryId: string;
  descriptionClean?: string | null;
  paymentMethod?: ApiCategoryRule["paymentMethod"];
};

export type ApiTransaction = {
  id: string;
  date: string;
  descriptionOriginal: string;
  descriptionClean: string;
  amount: number;
  direction: "income" | "expense" | "neutral";
  paymentMethod: "credit" | "debit" | "account" | "adjustment";
  source: "manual" | "ofx" | "pdf_invoice";
  categoryId: string | null;
  category: ApiCategory | null;
  reviewStatus: "reviewed" | "needs_review";
  externalId: string | null;
  bankCode: string | null;
  accountId: string | null;
  cardLastDigits: string | null;
  invoiceId: string | null;
  importBatchId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TransactionFilters = {
  month?: string;
  year?: string;
  categoryId?: string;
  direction?: ApiTransaction["direction"] | "";
  paymentMethod?: ApiTransaction["paymentMethod"] | "";
  source?: ApiTransaction["source"] | "";
  reviewStatus?: ApiTransaction["reviewStatus"] | "";
};

export type UpdateTransactionInput = Partial<{
  date: string;
  descriptionClean: string;
  amount: number;
  categoryId: string | null;
  direction: ApiTransaction["direction"];
  paymentMethod: ApiTransaction["paymentMethod"];
  reviewStatus: ApiTransaction["reviewStatus"];
}>;

export type CreateTransactionInput = {
  date: string;
  descriptionClean: string;
  amount: number;
  direction: ApiTransaction["direction"];
  paymentMethod: ApiTransaction["paymentMethod"];
  categoryId: string | null;
  reviewStatus?: ApiTransaction["reviewStatus"];
};

export type ApiInvoice = {
  id: string;
  cardName: string;
  cardLastDigits: string;
  referenceMonth: number;
  referenceYear: number;
  closingDay: number;
  dueDay: number;
  status: "open" | "closed" | "paid";
  totalFromFile: number | null;
  totalCalculated: number | null;
  difference?: number | null;
  summaryByCategory?: ApiInvoiceCategorySummary[];
  nationalTotal?: number;
  internationalTotal?: number;
  feesTotal?: number;
  createdAt: string;
  updatedAt: string;
  transactions?: ApiTransaction[];
  _count?: {
    transactions: number;
  };
};

export type ApiInvoiceCategorySummary = {
  categoryId: string | null;
  categoryName: string;
  total: number;
  count: number;
};

export type ApiInvoiceSummary = {
  id: string;
  totalFromFile: number | null;
  totalCalculated: number;
  difference: number | null;
  summaryByCategory: ApiInvoiceCategorySummary[];
  nationalTotal: number;
  internationalTotal: number;
  feesTotal: number;
};

export type UpdateInvoiceInput = Partial<{
  status: ApiInvoice["status"];
  closingDay: number;
  dueDay: number;
  totalFromFile: number | null;
}>;

export type ApiOfxPreviewTransaction = {
  previewId: string;
  import: boolean;
  date: string;
  trnType: string;
  amount: number;
  fitId: string | null;
  externalId: string;
  memo: string;
  direction: "income" | "expense" | "neutral";
  paymentMethod: "credit" | "debit" | "account" | "adjustment";
  reviewStatus: "reviewed" | "needs_review";
  categoryId: string | null;
  categoryName: string;
  descriptionClean: string | null;
  possibleDuplicate: boolean;
};

export type ApiOfxPreview = {
  fileName: string;
  bankCode: string | null;
  accountId: string | null;
  accountType: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  totalRows: number;
  transactions: ApiOfxPreviewTransaction[];
};

export type ApiOfxConfirmResult = {
  importBatchId: string;
  totalRows: number;
  importedRows: number;
  duplicatedRows: number;
  needsReviewRows: number;
  reviewedRows?: number;
};

export type ApiPdfInvoicePreviewTransaction = {
  previewId: string;
  import: boolean;
  date: string;
  descriptionOriginal: string;
  amount: number;
  section: "national" | "international";
  isFee: boolean;
  categoryId: string | null;
  categoryName: string;
  descriptionClean: string | null;
  reviewStatus: "reviewed" | "needs_review";
  suggestedCategory: string;
  possibleDuplicate: boolean;
};

export type ApiPdfInvoicePreview = {
  fileName: string;
  invoiceType: "proxima_fatura" | "fatura_anterior" | "unknown";
  totalFromFile: number | null;
  totalCalculated: number;
  difference: number | null;
  cardLastDigits: string | null;
  referenceMonth: number;
  referenceYear: number;
  nationalTransactions: ApiPdfInvoicePreviewTransaction[];
  internationalTransactions: ApiPdfInvoicePreviewTransaction[];
  fees: ApiPdfInvoicePreviewTransaction[];
};

export type ApiPdfInvoiceConfirmResult = {
  importBatchId: string;
  invoiceId: string;
  totalRows: number;
  importedRows: number;
  duplicatedRows: number;
  needsReviewRows: number;
  reviewedRows: number;
  totalFromFile: number | null;
  totalCalculated: number;
  difference: number | null;
};

export type ApiDashboardCategoryExpense = {
  categoryId: string | null;
  categoryName: string;
  color: string | null;
  total: number;
};

export type ApiDashboard = {
  month: number;
  year: number;
  totalIncome: number;
  totalExpense: number;
  balanceEstimated: number;
  creditTotal: number;
  debitTotal: number;
  accountTotal: number;
  needsReviewCount: number;
  expensesByCategory: ApiDashboardCategoryExpense[];
  latestTransactions: ApiTransaction[];
  biggestTransactions: ApiTransaction[];
};

export type AiTransactionSuggestionInput = {
  id?: string;
  descriptionOriginal: string;
  amount: number;
  direction: ApiTransaction["direction"];
  paymentMethod: ApiTransaction["paymentMethod"];
  source: ApiTransaction["source"];
};

export type ApiAiTransactionSuggestion = {
  transactionId: string | null;
  descriptionClean: string;
  category: string;
  categoryId: string | null;
  confidence: number;
  explanation: string;
};

export type ApiAiTransactionSuggestions = {
  suggestions: ApiAiTransactionSuggestion[];
};

export type ApiAiMonthlySummary = {
  summary: string;
  topExpenses: string[];
  alerts: string[];
};
