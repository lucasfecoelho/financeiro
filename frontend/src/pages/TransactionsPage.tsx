import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleSlash,
  Pencil,
  Plus,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateBlocks";
import { StatusPill } from "@/components/StatusPill";
import { useApiQuery } from "@/hooks/useApiQuery";
import { api } from "@/lib/api";
import type {
  ApiCategory,
  ApiTransaction,
  CategoryRuleInput,
  CreateTransactionInput,
  TransactionFilters,
  UpdateTransactionInput,
} from "@/lib/apiTypes";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCurrentPeriod, getSelectedPeriod, setSelectedPeriod } from "@/lib/period";
import { cn } from "@/lib/utils";

function buildDefaultFilters(): TransactionFilters {
  const selectedPeriod = getSelectedPeriod();

  return {
    month: selectedPeriod.month,
    year: selectedPeriod.year,
    categoryId: "",
    reviewStatus: "",
    source: "",
    direction: "",
    paymentMethod: "",
    importBatchId: "",
    invoiceId: "",
  };
}

type ImportFilterContext = {
  importBatchId?: string;
  mode?: "import" | "review" | "invoice";
  source?: ApiTransaction["source"];
  month?: string;
  year?: string;
  label?: string;
  invoiceId?: string;
};

type TransactionsView = "all" | "review";
type QuickFilter = "all" | "review" | "account" | "card" | "manual";

type ReviewFormState = {
  descriptionClean: string;
  categoryId: string;
  direction: ApiTransaction["direction"];
  paymentMethod: ApiTransaction["paymentMethod"];
  reviewStatus: ApiTransaction["reviewStatus"];
};

type RuleDraft = {
  transaction: ApiTransaction;
  pattern: string;
  categoryId: string;
  descriptionClean: string;
  direction: ApiTransaction["direction"];
  paymentMethod: ApiTransaction["paymentMethod"];
  warning: string | null;
};

const genericRulePatterns = new Set([
  "COMPRA",
  "PIX",
  "CRED",
  "TEV",
  "ENVIO",
  "PAGAMENTO",
]);

export function TransactionsPage() {
  const [importContext, setImportContext] = useState<ImportFilterContext | null>(
    readImportFilterContext,
  );
  const [filters, setFilters] = useState<TransactionFilters>(() =>
    importContext
      ? buildContextFilters(importContext)
      : buildDefaultFilters(),
  );
  const [view, setView] = useState<TransactionsView>(
    importContext?.mode === "review" ? "review" : "all",
  );
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(() =>
    importContext?.mode === "review"
      ? "review"
      : importContext?.mode === "invoice"
        ? "card"
        : "all",
  );
  const [isFiltersOpen, setIsFiltersOpen] = useState(Boolean(importContext));
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft | null>(null);
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [editingManualTransaction, setEditingManualTransaction] =
    useState<ApiTransaction | null>(null);
  const filtersKey = JSON.stringify(filters);
  const queryFilters = useMemo(
    () =>
      view === "review"
        ? { ...filters, reviewStatus: "needs_review" as const }
        : filters,
    [filtersKey, view],
  );
  const {
    data: apiTransactions,
    error,
    isLoading,
    refetch,
  } = useApiQuery(() => api.transactions(queryFilters), [filtersKey, view]);
  const {
    data: categories,
    error: categoriesError,
    isLoading: isLoadingCategories,
    refetch: refetchCategories,
  } = useApiQuery(api.categories);
  const transactions = apiTransactions ?? [];
  const reviewCategory = categories?.find(
    (category) => category.name.toLowerCase() === "a revisar",
  );
  const pendingCount = transactions.filter(
    (transaction) => transaction.reviewStatus === "needs_review",
  ).length;
  const recentlyImportedCount = transactions.filter(isRecentlyImported).length;
  const canMarkVisibleReviewed = transactions.some(
    (transaction) =>
      transaction.reviewStatus === "needs_review" &&
      Boolean(transaction.categoryId) &&
      transaction.categoryId !== reviewCategory?.id,
  );

  async function updateTransaction(
    transactionId: string,
    data: Parameters<typeof api.updateTransaction>[1],
  ) {
    setSavingId(transactionId);
    setMessage(null);

    try {
      await api.updateTransaction(transactionId, data);
      await refetch();
      setMessage("Lançamento atualizado.");
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível atualizar o lançamento.",
      );
    } finally {
      setSavingId(null);
    }
  }

  async function saveManualTransaction(data: CreateTransactionInput) {
    setMessage(null);

    try {
      if (editingManualTransaction) {
        setSavingId(editingManualTransaction.id);
        await api.updateTransaction(editingManualTransaction.id, data);
        setMessage("Lancamento manual atualizado.");
      } else {
        await api.createTransaction(data);
        setMessage("Lancamento manual criado.");
      }

      await refetch();
      setIsManualFormOpen(false);
      setEditingManualTransaction(null);
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Nao foi possivel salvar o lancamento manual.",
      );
      throw caughtError;
    } finally {
      setSavingId(null);
    }
  }

  async function deleteManualTransaction(transaction: ApiTransaction) {
    if (transaction.source !== "manual") {
      return;
    }

    const shouldDelete = window.confirm("Excluir este lancamento manual?");
    if (!shouldDelete) {
      return;
    }

    setSavingId(transaction.id);
    setMessage(null);

    try {
      await api.deleteTransaction(transaction.id);
      await refetch();
      setMessage("Lancamento manual excluido.");
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Nao foi possivel excluir o lancamento manual.",
      );
    } finally {
      setSavingId(null);
    }
  }

  function openNewManualTransaction() {
    setEditingManualTransaction(null);
    setIsManualFormOpen(true);
  }

  function openManualTransactionEditor(transaction: ApiTransaction) {
    setEditingManualTransaction(transaction);
    setIsManualFormOpen(true);
  }

  async function markReviewed(transactionId: string) {
    setSavingId(transactionId);
    setMessage(null);

    try {
      await api.reviewTransaction(transactionId);
      await refetch();
      setMessage("Lançamento marcado como revisado.");
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível revisar o lançamento.",
      );
    } finally {
      setSavingId(null);
    }
  }

  async function markVisibleReviewed() {
    const eligibleTransactions = transactions.filter(
      (transaction) =>
        transaction.reviewStatus === "needs_review" &&
        Boolean(transaction.categoryId) &&
        transaction.categoryId !== reviewCategory?.id,
    );

    if (eligibleTransactions.length === 0) {
      setMessage("Escolha categorias finais antes de revisar em lote.");
      return;
    }

    setMessage(null);

    try {
      await Promise.all(
        eligibleTransactions.map((transaction) =>
          api.updateTransaction(transaction.id, { reviewStatus: "reviewed" }),
        ),
      );
      await refetch();
      setMessage(`${eligibleTransactions.length} lançamentos marcados como revisados.`);
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível revisar os lançamentos visíveis.",
      );
    }
  }

  async function applyExistingRules() {
    const transactionIds = transactions.map((transaction) => transaction.id);
    if (transactionIds.length === 0) {
      return;
    }

    setMessage(null);

    try {
      const result = await api.applyCategoryRules(transactionIds);
      await refetch();
      setMessage(`${result.appliedCount} regras aplicadas.`);
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível aplicar as regras existentes.",
      );
    }
  }

  async function createRuleFromDraft(draft: RuleDraft) {
    const category = categories?.find((item) => item.id === draft.categoryId);
    const warning = validateRulePattern(draft.pattern);

    if (warning) {
      setRuleDraft({ ...draft, warning });
      return;
    }

    if (!category || category.id === reviewCategory?.id) {
      setRuleDraft({
        ...draft,
        warning: "Escolha uma categoria final antes de criar a regra.",
      });
      return;
    }

    setSavingId(draft.transaction.id);
    setMessage(null);

    try {
      const input: CategoryRuleInput = {
        pattern: draft.pattern.trim(),
        matchType: "contains",
        categoryId: draft.categoryId,
        descriptionClean: draft.descriptionClean.trim(),
        paymentMethod: draft.paymentMethod,
      };
      await api.createCategoryRule(input);
      await api.updateTransaction(draft.transaction.id, {
        descriptionClean: draft.descriptionClean.trim(),
        categoryId: draft.categoryId,
        direction: draft.direction,
        paymentMethod: draft.paymentMethod,
        reviewStatus: "reviewed",
      });
      await refetch();
      setRuleDraft(null);
      setMessage(`Regra criada para ${category.name}.`);
    } catch (caughtError) {
      setRuleDraft({
        ...draft,
        warning:
          caughtError instanceof Error
            ? caughtError.message
            : "Não foi possível criar a regra.",
      });
    } finally {
      setSavingId(null);
    }
  }

  function openRuleDraft(transaction: ApiTransaction, form?: ReviewFormState) {
    const categoryId = form?.categoryId ?? transaction.categoryId ?? "";
    const category = categories?.find((item) => item.id === categoryId);
    if (!category || category.id === reviewCategory?.id) {
      setMessage("Escolha uma categoria final antes de criar uma regra.");
      return;
    }

    const pattern = suggestRulePattern(transaction.descriptionOriginal);
    setRuleDraft({
      transaction,
      pattern,
      categoryId,
      descriptionClean: form?.descriptionClean ?? transaction.descriptionClean,
      direction: form?.direction ?? transaction.direction,
      paymentMethod: form?.paymentMethod ?? transaction.paymentMethod,
      warning: validateRulePattern(pattern),
    });
  }

  function applyQuickFilter(nextFilter: QuickFilter) {
    setQuickFilter(nextFilter);
    setView(nextFilter === "review" ? "review" : "all");
    setMessage(null);

    setFilters((currentFilters) => ({
      ...currentFilters,
      reviewStatus: nextFilter === "review" ? "needs_review" : "",
      paymentMethod:
        nextFilter === "account"
          ? "account"
          : nextFilter === "card"
            ? "credit"
            : "",
      source:
        nextFilter === "manual"
          ? "manual"
          : nextFilter === "card"
            ? "pdf_invoice"
            : currentFilters.invoiceId
              ? currentFilters.source
              : "",
    }));
  }

  return (
    <div>
      <PageHeader
        eyebrow="lançamentos"
        title="Revise e organize seus movimentos."
        description="Consulte, filtre e ajuste seus movimentos sem perder o contexto do mês."
      />

      {importContext && (
        <Panel className="mb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {getContextTitle(importContext)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {getContextDescription(importContext)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setImportContext(null);
                setQuickFilter("all");
                setView("all");
                setFilters(buildDefaultFilters());
              }}
              className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground transition hover:bg-accent"
            >
              Limpar filtro
            </button>
          </div>
        </Panel>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
          {quickFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => applyQuickFilter(filter.value)}
              className={cn(
                "h-9 rounded-md px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground",
                quickFilter === filter.value &&
                  (filter.value === "review"
                    ? "bg-amber-300/10 text-amber-100 ring-1 ring-amber-300/20"
                    : "bg-primary/10 text-foreground ring-1 ring-primary/20"),
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusPill tone="positive">
            {transactions.filter((item) => item.direction === "income").length} receitas
          </StatusPill>
          <StatusPill tone="negative">
            {transactions.filter((item) => item.direction === "expense").length} despesas
          </StatusPill>
          <StatusPill tone="review">{pendingCount} a revisar</StatusPill>
          {recentlyImportedCount > 0 && (
            <StatusPill tone="neutral">{recentlyImportedCount} importados recentes</StatusPill>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsFiltersOpen((current) => !current)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-muted-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Filtros
          </button>
          {view === "review" && (
            <>
              <button
                type="button"
                onClick={() => void applyExistingRules()}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-muted-foreground transition hover:bg-accent"
              >
                <Sparkles className="size-4" aria-hidden="true" />
                Aplicar regras
              </button>
              <button
                type="button"
                disabled={!canMarkVisibleReviewed}
                onClick={() => void markVisibleReviewed()}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Marcar visíveis como revisados
              </button>
            </>
          )}
          <button
            type="button"
            onClick={openNewManualTransaction}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15"
          >
            <Plus className="size-4" aria-hidden="true" />
            Novo lançamento
          </button>
        </div>
      </div>

      {isFiltersOpen && (
      <Panel title="Filtros" className="mb-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <FilterField
            label="Mês"
            value={filters.month ?? ""}
            onChange={(value) => updateFilter("month", value)}
            options={monthOptions}
          />
          <FilterField
            label="Ano"
            value={filters.year ?? ""}
            onChange={(value) => updateFilter("year", value)}
            options={yearOptions}
          />
          <FilterField
            label="Categoria"
            value={filters.categoryId ?? ""}
            onChange={(value) => updateFilter("categoryId", value)}
            options={[
              { label: "Todas", value: "" },
              ...(categories ?? []).map((category) => ({
                label: category.name,
                value: category.id,
              })),
            ]}
          />
          <FilterField
            label="Status"
            value={filters.reviewStatus ?? ""}
            onChange={(value) => updateFilter("reviewStatus", value)}
            options={[
              { label: "Todos", value: "" },
              { label: "A revisar", value: "needs_review" },
              { label: "Revisados", value: "reviewed" },
            ]}
          />
          <FilterField
            label="Origem"
            value={filters.source ?? ""}
            onChange={(value) => updateFilter("source", value)}
            options={[
              { label: "Todas", value: "" },
              { label: "Manual", value: "manual" },
              { label: "Conta", value: "ofx" },
              { label: "Cartão", value: "pdf_invoice" },
            ]}
          />
          <FilterField
            label="Tipo"
            value={filters.direction ?? ""}
            onChange={(value) => updateFilter("direction", value)}
            options={[
              { label: "Todas", value: "" },
              { label: "Entradas", value: "income" },
              { label: "Saídas", value: "expense" },
              { label: "Neutros", value: "neutral" },
            ]}
          />
          <FilterField
            label="Forma"
            value={filters.paymentMethod ?? ""}
            onChange={(value) => updateFilter("paymentMethod", value)}
            options={[
              { label: "Todos", value: "" },
              { label: "Conta", value: "account" },
              { label: "Débito", value: "debit" },
              { label: "Cartão", value: "credit" },
              { label: "Ajuste", value: "adjustment" },
            ]}
          />
        </div>
      </Panel>
      )}

      <Panel>
        {(isLoading || isLoadingCategories) && (
          <LoadingBlock label="Carregando lançamentos..." />
        )}
        {(error || categoriesError) && (
          <ErrorBlock
            message={error ?? categoriesError ?? "Erro ao carregar dados."}
            onRetry={() => {
              void refetch();
              void refetchCategories();
            }}
          />
        )}
        {!isLoading &&
          !isLoadingCategories &&
          !error &&
          !categoriesError &&
          transactions.length === 0 && (
            <EmptyBlock
              title={view === "review" ? "Tudo revisado por enquanto." : "Nenhum lançamento neste mês."}
              description={
                view === "review"
                  ? "Não há pendências neste filtro. Quando algo precisar de atenção, aparece aqui."
                  : importContext
                    ? "Nenhum lançamento neste filtro. Talvez o arquivo tenha sido importado em outro mês, tenha sido todo duplicado ou não tenha gerado linhas novas."
                    : "Nenhum lançamento neste filtro. Talvez o arquivo tenha sido importado em outro mês ou os filtros estejam estreitos demais."
              }
              action={
                <button
                  type="button"
                  onClick={openImport}
                  className="h-10 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15"
                >
                  Importar arquivo
                </button>
              }
            />
          )}
        {!isLoading &&
          !isLoadingCategories &&
          !error &&
          !categoriesError &&
          transactions.length > 0 &&
          view === "all" && (
            <EditableTransactionsTable
              categories={categories ?? []}
              rows={transactions}
              savingId={savingId}
              onUpdate={updateTransaction}
              onReview={markReviewed}
              onCreateRule={(transaction) => {
                openRuleDraft(transaction);
                return Promise.resolve();
              }}
              onEditManual={openManualTransactionEditor}
              onDeleteManual={deleteManualTransaction}
            />
          )}
        {!isLoading &&
          !isLoadingCategories &&
          !error &&
          !categoriesError &&
          transactions.length > 0 &&
          view === "review" && (
            <ReviewCards
              categories={categories ?? []}
              reviewCategory={reviewCategory}
              rows={transactions}
              savingId={savingId}
              onSave={updateTransaction}
              onReview={markReviewed}
              onCreateRule={openRuleDraft}
            />
          )}
        {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}
      </Panel>

      {ruleDraft && (
        <RuleConfirmDialog
          draft={ruleDraft}
          categories={categories ?? []}
          onChange={setRuleDraft}
          onClose={() => setRuleDraft(null)}
          onConfirm={() => void createRuleFromDraft(ruleDraft)}
          isSaving={savingId === ruleDraft.transaction.id}
        />
      )}

      {isManualFormOpen && (
        <ManualTransactionDrawer
          categories={categories ?? []}
          transaction={editingManualTransaction}
          onClose={() => {
            setIsManualFormOpen(false);
            setEditingManualTransaction(null);
          }}
          onSubmit={saveManualTransaction}
        />
      )}
    </div>
  );

  function updateFilter(key: keyof TransactionFilters, value: string) {
    if (key === "month" || key === "year") {
      const nextFilters = {
        ...filters,
        [key]: value,
      };

      if (nextFilters.month && nextFilters.year) {
        setSelectedPeriod({
          month: nextFilters.month,
          year: nextFilters.year,
        });
      }
    }

    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value,
    }));
  }
}

function ReviewCards({
  rows,
  categories,
  reviewCategory,
  savingId,
  onSave,
  onReview,
  onCreateRule,
}: {
  rows: ApiTransaction[];
  categories: ApiCategory[];
  reviewCategory: ApiCategory | undefined;
  savingId: string | null;
  onSave: (
    transactionId: string,
    data: UpdateTransactionInput,
  ) => Promise<void>;
  onReview: (transactionId: string) => Promise<void>;
  onCreateRule: (transaction: ApiTransaction, form?: ReviewFormState) => void;
}) {
  const [skippedIds, setSkippedIds] = useState<Set<string>>(() => new Set());
  const visibleRows = rows.filter((row) => !skippedIds.has(row.id));

  if (visibleRows.length === 0) {
    return (
      <EmptyBlock
        title="Tudo visto neste filtro."
        description="Você pulou os itens visíveis. Limpe filtros ou volte para Todos quando quiser retomar."
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {visibleRows.map((row) => (
        <ReviewTransactionCard
          key={row.id}
          row={row}
          categories={categories}
          reviewCategory={reviewCategory}
          isSaving={savingId === row.id}
          onSave={onSave}
          onReview={onReview}
          onSkip={() =>
            setSkippedIds((current) => {
              const next = new Set(current);
              next.add(row.id);
              return next;
            })
          }
          onCreateRule={onCreateRule}
        />
      ))}
    </div>
  );
}

function ReviewTransactionCard({
  row,
  categories,
  reviewCategory,
  isSaving,
  onSave,
  onReview,
  onSkip,
  onCreateRule,
}: {
  row: ApiTransaction;
  categories: ApiCategory[];
  reviewCategory: ApiCategory | undefined;
  isSaving: boolean;
  onSave: (
    transactionId: string,
    data: UpdateTransactionInput,
  ) => Promise<void>;
  onReview: (transactionId: string) => Promise<void>;
  onSkip: () => void;
  onCreateRule: (transaction: ApiTransaction, form?: ReviewFormState) => void;
}) {
  const [form, setForm] = useState<ReviewFormState>({
    descriptionClean: row.descriptionClean,
    categoryId: row.categoryId ?? reviewCategory?.id ?? "",
    direction: row.direction,
    paymentMethod: row.paymentMethod,
    reviewStatus: row.reviewStatus,
  });
  const selectedCategory = categories.find((category) => category.id === form.categoryId);
  const categoryReviewStatus =
    !selectedCategory || selectedCategory.id === reviewCategory?.id
      ? "needs_review"
      : "reviewed";
  const finalReviewStatus =
    form.reviewStatus === "reviewed" ? "reviewed" : categoryReviewStatus;
  const displayValue =
    form.direction === "expense" ? -Math.abs(row.amount) : Math.abs(row.amount);

  async function save() {
    await onSave(row.id, {
      descriptionClean: form.descriptionClean.trim(),
      categoryId: form.categoryId || null,
      direction: form.direction,
      paymentMethod: form.paymentMethod,
      reviewStatus: finalReviewStatus,
    });
  }

  return (
    <article className="rounded-lg border border-border bg-secondary/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{formatDate(row.date)}</p>
          <h2 className="mt-2 text-lg font-semibold leading-tight">{row.descriptionClean}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Original: {row.descriptionOriginal}
          </p>
        </div>
        <AmountBadge value={displayValue} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusPill tone={sourceTone[row.source]}>{sourceLabels[row.source]}</StatusPill>
        <StatusPill tone="neutral">{paymentLabels[form.paymentMethod]}</StatusPill>
        {row.importBatchId && <StatusPill tone="review">importado</StatusPill>}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm text-muted-foreground">Descrição limpa</span>
          <input
            value={form.descriptionClean}
            onChange={(event) =>
              setForm((current) => ({ ...current, descriptionClean: event.target.value }))
            }
            className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary/50"
          />
        </label>
        <FilterField
          label="Categoria"
          value={form.categoryId}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              categoryId: value,
              reviewStatus:
                !value || value === reviewCategory?.id ? "needs_review" : "reviewed",
            }))
          }
          options={[
            { label: "A revisar", value: reviewCategory?.id ?? "" },
            ...categories
              .filter((category) => category.id !== reviewCategory?.id)
              .map((category) => ({ label: category.name, value: category.id })),
          ]}
        />
        <FilterField
          label="Tipo"
          value={form.direction}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              direction: value as ApiTransaction["direction"],
            }))
          }
          options={[
            { label: "Entrada", value: "income" },
            { label: "Saída", value: "expense" },
            { label: "Neutro", value: "neutral" },
          ]}
        />
        <FilterField
          label="Forma"
          value={form.paymentMethod}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              paymentMethod: value as ApiTransaction["paymentMethod"],
            }))
          }
          options={[
            { label: "Conta", value: "account" },
            { label: "Débito", value: "debit" },
            { label: "Cartão", value: "credit" },
            { label: "Ajuste", value: "adjustment" },
          ]}
        />
        <FilterField
          label="Status"
          value={form.reviewStatus}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              reviewStatus: value as ApiTransaction["reviewStatus"],
            }))
          }
          options={[
            { label: "A revisar", value: "needs_review" },
            { label: "Revisado", value: "reviewed" },
          ]}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void save()}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-3 text-xs font-medium text-emerald-100 transition hover:bg-emerald-400/15 disabled:opacity-60"
        >
          <Save className="size-3.5" aria-hidden="true" />
          Salvar
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void onReview(row.id)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition hover:bg-accent disabled:opacity-60"
        >
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          Marcar revisado
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => onCreateRule(row, form)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 text-xs font-medium text-amber-100 transition hover:bg-amber-300/15 disabled:opacity-60"
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          Criar regra
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={onSkip}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition hover:bg-accent disabled:opacity-60"
        >
          <ArrowRight className="size-3.5" aria-hidden="true" />
          Pular
        </button>
      </div>
    </article>
  );
}

function RuleConfirmDialog({
  draft,
  categories,
  onChange,
  onClose,
  onConfirm,
  isSaving,
}: {
  draft: RuleDraft;
  categories: ApiCategory[];
  onChange: (draft: RuleDraft) => void;
  onClose: () => void;
  onConfirm: () => void;
  isSaving: boolean;
}) {
  const category = categories.find((item) => item.id === draft.categoryId);
  const liveWarning = validateRulePattern(draft.pattern);
  const warning = draft.warning ?? liveWarning;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border border-amber-300/20 bg-amber-300/10 text-amber-100">
            <Sparkles className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Criar regra</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Lançamentos que contenham {draft.pattern || "..."} serão categorizados como {category?.name ?? "categoria escolhida"}.
            </p>
          </div>
        </div>

        <label className="mt-5 block">
          <span className="mb-2 block text-sm text-muted-foreground">Padrão</span>
          <input
            value={draft.pattern}
            onChange={(event) =>
              onChange({
                ...draft,
                pattern: event.target.value,
                warning: validateRulePattern(event.target.value),
              })
            }
            className="h-10 w-full rounded-lg border border-border bg-secondary/35 px-3 text-foreground outline-none transition focus:border-primary/50"
          />
        </label>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <InfoRow label="Categoria" value={category?.name ?? "-"} />
          <InfoRow label="Forma" value={paymentLabels[draft.paymentMethod]} />
          <InfoRow label="Descrição limpa" value={draft.descriptionClean || "-"} />
          <InfoRow label="Tipo de regra" value="Contém" />
        </div>

        {warning && (
          <div className="mt-4 flex gap-3 rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            <CircleSlash className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{warning}</p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground transition hover:bg-accent"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSaving || Boolean(liveWarning)}
            onClick={onConfirm}
            className="h-10 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Criando..." : "Confirmar regra"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AmountBadge({ value }: { value: number }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-right",
        value < 0
          ? "border-rose-300/20 bg-rose-400/10 text-rose-100"
          : "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
      )}
    >
      <p className="text-xs text-muted-foreground">Valor</p>
      <p className="mt-1 text-lg font-semibold">{formatCurrency(value)}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/25 px-3 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function EditableTransactionsTable({
  rows,
  categories,
  savingId,
  onUpdate,
  onReview,
  onCreateRule,
  onEditManual,
  onDeleteManual,
}: {
  rows: ApiTransaction[];
  categories: ApiCategory[];
  savingId: string | null;
  onUpdate: (
    transactionId: string,
    data: Parameters<typeof api.updateTransaction>[1],
  ) => Promise<void>;
  onReview: (transactionId: string) => Promise<void>;
  onCreateRule: (transaction: ApiTransaction) => Promise<void>;
  onEditManual: (transaction: ApiTransaction) => void;
  onDeleteManual: (transaction: ApiTransaction) => Promise<void>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="hidden grid-cols-[86px_minmax(210px,1fr)_180px_120px_120px_150px_170px] gap-4 bg-secondary/70 px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground 2xl:grid">
        <span>Data</span>
        <span>Descrição limpa</span>
        <span>Categoria</span>
        <span>Origem</span>
        <span>Forma</span>
        <span className="text-right">Valor</span>
        <span>Ações</span>
      </div>
      <div className="divide-y divide-border/80">
        {rows.map((row) => (
          <EditableTransactionRow
            key={row.id}
            row={row}
            categories={categories}
            isSaving={savingId === row.id}
            onUpdate={onUpdate}
            onReview={onReview}
            onCreateRule={onCreateRule}
            onEditManual={onEditManual}
            onDeleteManual={onDeleteManual}
          />
        ))}
      </div>
    </div>
  );
}

function EditableTransactionRow({
  row,
  categories,
  isSaving,
  onUpdate,
  onReview,
  onCreateRule,
  onEditManual,
  onDeleteManual,
}: {
  row: ApiTransaction;
  categories: ApiCategory[];
  isSaving: boolean;
  onUpdate: (
    transactionId: string,
    data: Parameters<typeof api.updateTransaction>[1],
  ) => Promise<void>;
  onReview: (transactionId: string) => Promise<void>;
  onCreateRule: (transaction: ApiTransaction) => Promise<void>;
  onEditManual: (transaction: ApiTransaction) => void;
  onDeleteManual: (transaction: ApiTransaction) => Promise<void>;
}) {
  const [description, setDescription] = useState(row.descriptionClean);
  const displayValue =
    row.direction === "expense" ? -Math.abs(row.amount) : Math.abs(row.amount);
  const isPending = row.reviewStatus === "needs_review";

  return (
    <div
      className={cn(
        "grid gap-3 px-4 py-4 text-sm 2xl:grid-cols-[86px_minmax(210px,1fr)_180px_120px_120px_150px_170px] 2xl:items-center 2xl:gap-4",
        isPending && "bg-amber-300/5",
        isRecentlyImported(row) && "ring-1 ring-primary/20",
      )}
    >
      <span className="text-muted-foreground">{formatDate(row.date)}</span>
      <div>
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={() => {
            if (description.trim() !== row.descriptionClean) {
              void onUpdate(row.id, { descriptionClean: description.trim() });
            }
          }}
          className="h-10 w-full rounded-lg border border-border bg-secondary/35 px-3 text-foreground outline-none transition focus:border-primary/50"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Original: {row.descriptionOriginal}
        </p>
      </div>
      <select
        value={row.categoryId ?? ""}
        onChange={(event) => {
          const categoryId = event.target.value || null;
          const category = categories.find((item) => item.id === categoryId);
          void onUpdate(row.id, {
            categoryId,
            reviewStatus:
              category?.name.toLowerCase() === "a revisar" || !categoryId
                ? "needs_review"
                : "reviewed",
          });
        }}
        className="h-10 rounded-lg border border-border bg-secondary/35 px-3 text-foreground outline-none transition focus:border-primary/50"
      >
        <option value="">A revisar</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <StatusPill tone={sourceTone[row.source]}>{sourceLabels[row.source]}</StatusPill>
        {isRecentlyImported(row) && <StatusPill tone="neutral">recente</StatusPill>}
      </div>
      <select
        value={row.paymentMethod}
        onChange={(event) =>
          void onUpdate(row.id, {
            paymentMethod: event.target.value as ApiTransaction["paymentMethod"],
          })
        }
        className="h-10 rounded-lg border border-border bg-secondary/35 px-3 text-foreground outline-none transition focus:border-primary/50"
      >
        <option value="account">Conta</option>
        <option value="debit">Débito</option>
        <option value="credit">Cartão</option>
        <option value="adjustment">Ajuste</option>
      </select>
      <span
        className={cn(
          "font-semibold 2xl:text-right",
          displayValue < 0 ? "text-rose-200" : "text-emerald-200",
        )}
      >
        {formatCurrency(displayValue)}
      </span>
      <div className="flex flex-wrap gap-2">
        {isPending ? (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void onReview(row.id)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-3 text-xs font-medium text-emerald-100 transition hover:bg-emerald-400/15 disabled:opacity-60"
          >
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Revisado
          </button>
        ) : (
          <StatusPill tone="invoicePaid">revisado</StatusPill>
        )}
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void onCreateRule(row)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition hover:bg-accent disabled:opacity-60"
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          Criar regra
        </button>
        {row.source === "manual" && (
          <>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onEditManual(row)}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent disabled:opacity-60"
              aria-label="Editar lançamento manual"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void onDeleteManual(row)}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-rose-300/20 text-rose-100 transition hover:bg-rose-400/10 disabled:opacity-60"
              aria-label="Excluir lançamento manual"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ManualTransactionDrawer({
  categories,
  transaction,
  onClose,
  onSubmit,
}: {
  categories: ApiCategory[];
  transaction: ApiTransaction | null;
  onClose: () => void;
  onSubmit: (data: CreateTransactionInput) => Promise<void>;
}) {
  const reviewCategory = categories.find(
    (category) => category.name.toLowerCase() === "a revisar",
  );
  const [date, setDate] = useState(
    transaction ? toDateInputValue(transaction.date) : toDateInputValue(new Date()),
  );
  const [descriptionClean, setDescriptionClean] = useState(transaction?.descriptionClean ?? "");
  const [amount, setAmount] = useState(
    transaction ? String(Math.abs(transaction.amount)) : "",
  );
  const [direction, setDirection] = useState<ApiTransaction["direction"]>(
    transaction?.direction ?? "expense",
  );
  const [paymentMethod, setPaymentMethod] = useState<ApiTransaction["paymentMethod"]>(
    transaction?.paymentMethod ?? "account",
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    transaction?.categoryId ?? reviewCategory?.id ?? null,
  );
  const [reviewStatus, setReviewStatus] = useState<ApiTransaction["reviewStatus"]>(
    transaction?.reviewStatus ?? (reviewCategory ? "needs_review" : "reviewed"),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = Boolean(transaction);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsedAmount = Number(amount.replace(",", "."));
    if (!date) {
      setFormError("Informe a data do lançamento.");
      return;
    }

    if (!descriptionClean.trim()) {
      setFormError("Informe uma descrição.");
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setFormError("Informe um valor positivo.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        date,
        descriptionClean: descriptionClean.trim(),
        amount: parsedAmount,
        direction,
        paymentMethod,
        categoryId,
        reviewStatus,
      });
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível salvar o lançamento.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/70 backdrop-blur-sm">
      <button
        type="button"
        className="hidden flex-1 cursor-default md:block"
        aria-label="Fechar formulário"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              lançamento manual
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">
              {isEditing ? "Editar lançamento" : "Novo lançamento"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent"
            aria-label="Fechar"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="grid gap-4 px-6 py-6 sm:grid-cols-2">
            <TextInput
              label="Data"
              type="date"
              value={date}
              onChange={setDate}
            />
            <TextInput
              label="Valor"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={setAmount}
            />
            <div className="sm:col-span-2">
              <TextInput
                label="Descrição"
                value={descriptionClean}
                onChange={setDescriptionClean}
                placeholder="Ex.: Ajuste de saldo"
              />
            </div>
            <FilterField
              label="Tipo"
              value={direction}
              onChange={(value) => setDirection(value as ApiTransaction["direction"])}
              options={[
                { label: "Saída", value: "expense" },
                { label: "Entrada", value: "income" },
                { label: "Neutro", value: "neutral" },
              ]}
            />
            <FilterField
              label="Forma"
              value={paymentMethod}
              onChange={(value) => setPaymentMethod(value as ApiTransaction["paymentMethod"])}
              options={[
                { label: "Conta", value: "account" },
                { label: "Débito", value: "debit" },
                { label: "Cartão", value: "credit" },
                { label: "Ajuste", value: "adjustment" },
              ]}
            />
            <FilterField
              label="Categoria"
              value={categoryId ?? ""}
              onChange={(value) => {
                setCategoryId(value || null);
                const selectedCategory = categories.find((category) => category.id === value);
                if (selectedCategory?.name.toLowerCase() === "a revisar") {
                  setReviewStatus("needs_review");
                }
              }}
              options={[
                { label: "Sem categoria", value: "" },
                ...categories.map((category) => ({
                  label: category.name,
                  value: category.id,
                })),
              ]}
            />
            <FilterField
              label="Status"
              value={reviewStatus}
              onChange={(value) => setReviewStatus(value as ApiTransaction["reviewStatus"])}
              options={[
                { label: "Revisado", value: "reviewed" },
                { label: "A revisar", value: "needs_review" },
              ]}
            />
          </div>

          <div className="mt-auto border-t border-border px-6 py-5">
            <p className="mb-4 text-sm text-muted-foreground">
              O valor é informado como positivo. A direção define receita, despesa ou neutro.
            </p>
            {formError && <p className="mb-4 text-sm text-rose-200">{formError}</p>}
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground transition hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-10 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15 disabled:opacity-60"
              >
                {isSubmitting ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  min,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  min?: string;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        min={min}
        step={step}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-border bg-secondary/35 px-3 text-sm text-foreground outline-none transition focus:border-primary/50"
      />
    </label>
  );
}

function FilterField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-border bg-secondary/35 px-3 text-sm text-foreground outline-none transition focus:border-primary/50"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const monthOptions = [
  { label: "Todos", value: "" },
  { label: "Janeiro", value: "1" },
  { label: "Fevereiro", value: "2" },
  { label: "Março", value: "3" },
  { label: "Abril", value: "4" },
  { label: "Maio", value: "5" },
  { label: "Junho", value: "6" },
  { label: "Julho", value: "7" },
  { label: "Agosto", value: "8" },
  { label: "Setembro", value: "9" },
  { label: "Outubro", value: "10" },
  { label: "Novembro", value: "11" },
  { label: "Dezembro", value: "12" },
];

const yearOptions = [
  { label: "Todos", value: "" },
  ...Array.from({ length: 5 }, (_item, index) => {
    const year = Number(getCurrentPeriod().year) - index;
    return { label: String(year), value: String(year) };
  }),
];

const quickFilters: Array<{ label: string; value: QuickFilter }> = [
  { label: "Todos", value: "all" },
  { label: "A revisar", value: "review" },
  { label: "Conta", value: "account" },
  { label: "Cartão", value: "card" },
  { label: "Manual", value: "manual" },
];

const sourceLabels: Record<ApiTransaction["source"], string> = {
  manual: "Manual",
  ofx: "Conta",
  pdf_invoice: "Cartão",
};

const sourceTone: Record<ApiTransaction["source"], "neutral" | "positive" | "invoiceOpen"> = {
  manual: "neutral",
  ofx: "positive",
  pdf_invoice: "invoiceOpen",
};

const paymentLabels: Record<ApiTransaction["paymentMethod"], string> = {
  account: "Conta",
  debit: "Débito",
  credit: "Cartão",
  adjustment: "Ajuste",
};

function openImport() {
  window.dispatchEvent(new CustomEvent("financas:open-import", { detail: { mode: "ofx" } }));
}

function getContextTitle(context: ImportFilterContext) {
  if (context.mode === "review" && context.invoiceId) {
    return "Compras desta fatura para revisar";
  }

  if (context.mode === "review") {
    return "Exibindo pendências para revisar";
  }

  if (context.mode === "invoice") {
    return "Exibindo compras desta fatura";
  }

  return "Exibindo lançamentos importados agora";
}

function getContextDescription(context: ImportFilterContext) {
  const label = context.label ? ` (${context.label})` : "";

  if (context.mode === "review" && context.invoiceId) {
    return `A lista está focada nas compras da fatura${label} que ainda pedem atenção.`;
  }

  if (context.mode === "review") {
    return "A lista está filtrada para lançamentos que ainda pedem atenção.";
  }

  if (context.mode === "invoice") {
    return `A lista mostra apenas as compras da fatura selecionada${label}.`;
  }

  return "A lista mostra somente os movimentos da importação que você acabou de confirmar.";
}

function readImportFilterContext(): ImportFilterContext | null {
  const rawContext = window.sessionStorage.getItem("financas:transactions-filter");
  window.sessionStorage.removeItem("financas:transactions-filter");

  if (!rawContext) {
    return null;
  }

  try {
    const context = JSON.parse(rawContext) as Partial<ImportFilterContext>;
    if (context.mode === "review") {
      return {
        mode: "review",
        month: typeof context.month === "string" ? context.month : "",
        year: typeof context.year === "string" ? context.year : "",
        source: context.source,
        label: context.label,
        invoiceId: typeof context.invoiceId === "string" ? context.invoiceId : "",
      };
    }

    if (context.mode === "invoice") {
      return {
        mode: "invoice",
        month: typeof context.month === "string" ? context.month : "",
        year: typeof context.year === "string" ? context.year : "",
        source: context.source,
        label: context.label,
        invoiceId: typeof context.invoiceId === "string" ? context.invoiceId : "",
      };
    }

    return typeof context.importBatchId === "string" && context.importBatchId
      ? {
          mode: "import",
          importBatchId: context.importBatchId,
          month: typeof context.month === "string" ? context.month : "",
          year: typeof context.year === "string" ? context.year : "",
          label: context.label,
        }
      : null;
  } catch {
    return null;
  }
}

function buildContextFilters(context: ImportFilterContext): TransactionFilters {
  const defaultFilters = buildDefaultFilters();

  if (context.month && context.year) {
    setSelectedPeriod({
      month: context.month,
      year: context.year,
    });
  }

  if (context.mode === "review") {
    return {
      ...defaultFilters,
      month: context.month ?? defaultFilters.month,
      year: context.year ?? defaultFilters.year,
      source: context.source ?? "",
      reviewStatus: "needs_review",
      invoiceId: context.invoiceId ?? "",
    };
  }

  if (context.mode === "invoice") {
    return {
      ...defaultFilters,
      month: context.month ?? defaultFilters.month,
      year: context.year ?? defaultFilters.year,
      source: context.source ?? "pdf_invoice",
      invoiceId: context.invoiceId ?? "",
    };
  }

  return {
    ...defaultFilters,
    month: context.month || "",
    year: context.year || "",
    importBatchId: context.importBatchId ?? "",
  };
}

function isRecentlyImported(transaction: ApiTransaction) {
  if (!transaction.importBatchId || transaction.source === "manual") {
    return false;
  }

  const createdAt = new Date(transaction.createdAt).getTime();
  if (Number.isNaN(createdAt)) {
    return false;
  }

  return Date.now() - createdAt < 24 * 60 * 60 * 1000;
}

function suggestRulePattern(description: string) {
  const word =
    description
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, " ")
      .split(/\s+/)
      .find((item) => item.length >= 3 && !genericRulePatterns.has(item)) ?? description;

  return word.slice(0, 40);
}

function validateRulePattern(pattern: string) {
  const normalized = pattern.trim().toUpperCase();

  if (normalized.length < 3) {
    return "Use um padrão mais específico antes de criar a regra.";
  }

  if (genericRulePatterns.has(normalized)) {
    return "Esse padrão é amplo demais. Edite para algo mais específico, como o nome do estabelecimento.";
  }

  return null;
}

function toDateInputValue(date: string | Date) {
  if (date instanceof Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return date.slice(0, 10);
}
