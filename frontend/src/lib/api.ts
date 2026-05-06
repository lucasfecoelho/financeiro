import { apiRequest } from "./apiClient";
import type {
  AiTransactionSuggestionInput,
  ApiAiMonthlySummary,
  ApiAiStatus,
  ApiAiTransactionSuggestions,
  ApiBackup,
  ApiCategory,
  ApiCategoryRule,
  ApiDashboard,
  ApiInvoice,
  ApiInvoiceSummary,
  ApiImportBatch,
  ApiOfxConfirmResult,
  ApiOfxPreview,
  ApiPdfInvoiceConfirmResult,
  ApiPdfInvoicePreview,
  ApiSetting,
  ApiTransaction,
  CategoryRuleInput,
  CreateTransactionInput,
  TransactionFilters,
  UpdateTransactionInput,
  UpdateInvoiceInput,
} from "./apiTypes";

export const api = {
  aiStatus: () => apiRequest<ApiAiStatus>("/api/ai/status"),
  suggestTransactionsWithAi: (transactions: AiTransactionSuggestionInput[]) =>
    apiRequest<ApiAiTransactionSuggestions>("/api/ai/suggest-transactions", {
      method: "POST",
      body: { transactions },
    }),
  monthlySummaryWithAi: ({
    month,
    year,
    dashboard,
  }: {
    month: string;
    year: string;
    dashboard: ApiDashboard;
  }) =>
    apiRequest<ApiAiMonthlySummary>("/api/ai/monthly-summary", {
      method: "POST",
      body: { month, year, dashboard },
    }),
  backups: () => apiRequest<ApiBackup[]>("/api/backups"),
  importBatches: () => apiRequest<ApiImportBatch[]>("/api/import-batches"),
  createBackup: () =>
    apiRequest<ApiBackup>("/api/backups/create", {
      method: "POST",
    }),
  categories: () => apiRequest<ApiCategory[]>("/api/categories"),
  categoryRules: () => apiRequest<ApiCategoryRule[]>("/api/category-rules"),
  createCategoryRule: (data: CategoryRuleInput) =>
    apiRequest<ApiCategoryRule>("/api/category-rules", {
      method: "POST",
      body: data,
    }),
  updateCategoryRule: (id: string, data: Partial<CategoryRuleInput>) =>
    apiRequest<ApiCategoryRule>(`/api/category-rules/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: data,
    }),
  deleteCategoryRule: (id: string) =>
    apiRequest<void>(`/api/category-rules/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  applyCategoryRulesPreview: (transactionIds?: string[]) =>
    apiRequest<{
      totalMatches: number;
      matches: Array<{
        transactionId: string;
        descriptionOriginal: string;
        descriptionClean: string;
        currentCategoryId: string | null;
        suggestedCategoryId: string;
        suggestedCategoryName: string;
        ruleId: string;
        pattern: string;
        matchType: ApiCategoryRule["matchType"];
      }>;
    }>("/api/category-rules/apply-preview", {
      method: "POST",
      body: { transactionIds },
    }),
  applyCategoryRules: (transactionIds?: string[]) =>
    apiRequest<{ appliedCount: number }>("/api/category-rules/apply", {
      method: "POST",
      body: { transactionIds },
    }),
  dashboard: ({ month, year }: { month: string; year: string }) =>
    apiRequest<ApiDashboard>(`/api/dashboard?month=${month}&year=${year}`),
  settings: () => apiRequest<ApiSetting[]>("/api/settings"),
  updateSetting: (key: string, value: string) =>
    apiRequest<ApiSetting>(`/api/settings/${encodeURIComponent(key)}`, {
      method: "PATCH",
      body: { value },
    }),
  transactions: (filters: TransactionFilters = {}) => {
    const searchParams = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        searchParams.set(key, value);
      }
    });

    const queryString = searchParams.toString();
    return apiRequest<ApiTransaction[]>(
      `/api/transactions${queryString ? `?${queryString}` : ""}`,
    );
  },
  updateTransaction: (id: string, data: UpdateTransactionInput) =>
    apiRequest<ApiTransaction>(`/api/transactions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: data,
    }),
  createTransaction: (data: CreateTransactionInput) =>
    apiRequest<ApiTransaction>("/api/transactions", {
      method: "POST",
      body: data,
    }),
  deleteTransaction: (id: string) =>
    apiRequest<void>(`/api/transactions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  reviewTransaction: (id: string) =>
    apiRequest<ApiTransaction>(
      `/api/transactions/${encodeURIComponent(id)}/review`,
      {
        method: "PATCH",
      },
    ),
  invoices: () => apiRequest<ApiInvoice[]>("/api/invoices"),
  invoice: (id: string) => apiRequest<ApiInvoice>(`/api/invoices/${encodeURIComponent(id)}`),
  invoiceSummary: (id: string) =>
    apiRequest<ApiInvoiceSummary>(`/api/invoices/${encodeURIComponent(id)}/summary`),
  updateInvoice: (id: string, data: UpdateInvoiceInput) =>
    apiRequest<ApiInvoice>(`/api/invoices/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: data,
    }),
  previewOfx: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    return apiRequest<ApiOfxPreview>("/api/import/ofx/preview", {
      method: "POST",
      body: formData,
    });
  },
  confirmOfx: (preview: ApiOfxPreview) =>
    apiRequest<ApiOfxConfirmResult>("/api/import/ofx/confirm", {
      method: "POST",
      body: preview,
    }),
  previewPdfInvoice: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    return apiRequest<ApiPdfInvoicePreview>("/api/import/pdf-invoice/preview", {
      method: "POST",
      body: formData,
    });
  },
  confirmPdfInvoice: (preview: ApiPdfInvoicePreview) =>
    apiRequest<ApiPdfInvoiceConfirmResult>("/api/import/pdf-invoice/confirm", {
      method: "POST",
      body: preview,
    }),
};
