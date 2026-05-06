import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateBlocks";
import { StatusPill } from "@/components/StatusPill";
import { useApiQuery } from "@/hooks/useApiQuery";
import { api } from "@/lib/api";
import type {
  ApiCategory,
  ApiTransaction,
  CreateTransactionInput,
  TransactionFilters,
} from "@/lib/apiTypes";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const currentDate = new Date();

const defaultFilters: TransactionFilters = {
  month: String(currentDate.getMonth() + 1),
  year: String(currentDate.getFullYear()),
  categoryId: "",
  reviewStatus: "",
  source: "",
  direction: "",
  paymentMethod: "",
};

export function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFilters>(defaultFilters);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [editingManualTransaction, setEditingManualTransaction] =
    useState<ApiTransaction | null>(null);
  const filtersKey = JSON.stringify(filters);
  const queryFilters = useMemo(() => filters, [filtersKey]);
  const {
    data: apiTransactions,
    error,
    isLoading,
    refetch,
  } = useApiQuery(() => api.transactions(queryFilters), [filtersKey]);
  const {
    data: categories,
    error: categoriesError,
    isLoading: isLoadingCategories,
    refetch: refetchCategories,
  } = useApiQuery(api.categories);
  const transactions = apiTransactions ?? [];
  const pendingCount = transactions.filter(
    (transaction) => transaction.reviewStatus === "needs_review",
  ).length;
  const recentlyImportedCount = transactions.filter(isRecentlyImported).length;

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

  async function createRuleFromTransaction(transaction: ApiTransaction) {
    if (!transaction.categoryId) {
      setMessage("Escolha uma categoria antes de criar a regra.");
      return;
    }

    setSavingId(transaction.id);
    setMessage(null);

    try {
      await api.createCategoryRule({
        pattern: suggestRulePattern(transaction.descriptionOriginal),
        matchType: "contains",
        categoryId: transaction.categoryId,
        descriptionClean: transaction.descriptionClean,
        paymentMethod: transaction.paymentMethod,
      });
      setMessage("Regra criada para próximos lançamentos parecidos.");
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error ? caughtError.message : "Não foi possível criar a regra.",
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="lançamentos"
        title="Revise e organize seus movimentos."
        description="Edite a descrição limpa, escolha uma categoria e marque lançamentos como revisados. Tudo persiste no SQLite."
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
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
            onClick={() => updateFilter("reviewStatus", "needs_review")}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-muted-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Revisar pendências
          </button>
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
              { label: "OFX", value: "ofx" },
              { label: "PDF fatura", value: "pdf_invoice" },
            ]}
          />
          <FilterField
            label="Direção"
            value={filters.direction ?? ""}
            onChange={(value) => updateFilter("direction", value)}
            options={[
              { label: "Todas", value: "" },
              { label: "Receitas", value: "income" },
              { label: "Despesas", value: "expense" },
              { label: "Neutras", value: "neutral" },
            ]}
          />
          <FilterField
            label="Pagamento"
            value={filters.paymentMethod ?? ""}
            onChange={(value) => updateFilter("paymentMethod", value)}
            options={[
              { label: "Todos", value: "" },
              { label: "Conta", value: "account" },
              { label: "Débito", value: "debit" },
              { label: "Crédito", value: "credit" },
              { label: "Ajuste", value: "adjustment" },
            ]}
          />
        </div>
      </Panel>

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
              title="Nenhum lançamento encontrado"
              description="Ajuste os filtros ou importe um OFX para começar a revisar os movimentos da conta."
              action={
                <button
                  type="button"
                  onClick={() => navigateToPage("importar")}
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
          transactions.length > 0 && (
            <EditableTransactionsTable
              categories={categories ?? []}
              rows={transactions}
              savingId={savingId}
              onUpdate={updateTransaction}
              onReview={markReviewed}
              onCreateRule={createRuleFromTransaction}
              onEditManual={openManualTransactionEditor}
              onDeleteManual={deleteManualTransaction}
            />
          )}
        {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}
      </Panel>

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
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value,
    }));
  }
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
        <span>Pagamento</span>
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
        <option value="credit">Crédito</option>
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
              label="Direção"
              value={direction}
              onChange={(value) => setDirection(value as ApiTransaction["direction"])}
              options={[
                { label: "Despesa", value: "expense" },
                { label: "Receita", value: "income" },
                { label: "Neutro", value: "neutral" },
              ]}
            />
            <FilterField
              label="Pagamento"
              value={paymentMethod}
              onChange={(value) => setPaymentMethod(value as ApiTransaction["paymentMethod"])}
              options={[
                { label: "Conta", value: "account" },
                { label: "Débito", value: "debit" },
                { label: "Crédito", value: "credit" },
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
    const year = currentDate.getFullYear() - index;
    return { label: String(year), value: String(year) };
  }),
];

const sourceLabels: Record<ApiTransaction["source"], string> = {
  manual: "Manual",
  ofx: "OFX",
  pdf_invoice: "PDF fatura",
};

const sourceTone: Record<ApiTransaction["source"], "neutral" | "positive" | "invoiceOpen"> = {
  manual: "neutral",
  ofx: "positive",
  pdf_invoice: "invoiceOpen",
};

function navigateToPage(page: "inicio" | "importar" | "lancamentos" | "fatura-caixa" | "configuracoes") {
  window.dispatchEvent(new CustomEvent("financas:navigate", { detail: { page } }));
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
  const ignoredWords = new Set(["COMPRA", "CRED", "PIX", "ENVIO", "PAGAMENTO", "DEBITO"]);
  const word =
    description
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, " ")
      .split(/\s+/)
      .find((item) => item.length >= 3 && !ignoredWords.has(item)) ?? description;

  return word.slice(0, 40);
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
