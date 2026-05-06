import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateBlocks";
import { StatusPill } from "@/components/StatusPill";
import { useApiQuery } from "@/hooks/useApiQuery";
import { api } from "@/lib/api";
import type { ApiInvoice, ApiTransaction } from "@/lib/apiTypes";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type SectionType = "national" | "international" | "fee";

export function CaixaInvoicePage() {
  const {
    data: invoices,
    error: invoicesError,
    isLoading: isLoadingInvoices,
    refetch: refetchInvoices,
  } = useApiQuery(api.invoices);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const {
    data: invoice,
    error: invoiceError,
    isLoading: isLoadingInvoice,
    refetch: refetchInvoice,
  } = useApiQuery<ApiInvoice | null>(
    () => (selectedInvoiceId ? api.invoice(selectedInvoiceId) : Promise.resolve(null)),
    [selectedInvoiceId],
  );

  useEffect(() => {
    if (!selectedInvoiceId && invoices?.[0]) {
      setSelectedInvoiceId(invoices[0].id);
    }
  }, [invoices, selectedInvoiceId]);

  const transactions = invoice?.transactions ?? [];
  const categorizedOptions = invoice?.summaryByCategory ?? [];
  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const categoryMatch = categoryFilter
        ? transaction.categoryId === categoryFilter
        : true;
      const statusMatch = statusFilter
        ? transaction.reviewStatus === statusFilter
        : true;
      return categoryMatch && statusMatch;
    });
  }, [transactions, categoryFilter, statusFilter]);
  const nationalTransactions = filteredTransactions.filter(
    (transaction) => classifyInvoiceTransaction(transaction) === "national",
  );
  const internationalTransactions = filteredTransactions.filter(
    (transaction) => classifyInvoiceTransaction(transaction) === "international",
  );
  const feeTransactions = filteredTransactions.filter(
    (transaction) => classifyInvoiceTransaction(transaction) === "fee",
  );
  const totalFromFile = invoice?.totalFromFile ?? null;
  const totalCalculated = invoice?.totalCalculated ?? 0;
  const difference =
    invoice?.difference ?? (totalFromFile === null ? null : totalFromFile - totalCalculated);
  const hasDifference = difference !== null && Math.abs(difference) > 0.01;

  async function markAsPaid() {
    if (!invoice) {
      return;
    }

    setMessage(null);

    try {
      await api.updateInvoice(invoice.id, { status: "paid" });
      await Promise.all([refetchInvoice(), refetchInvoices()]);
      setMessage("Fatura marcada como paga.");
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível marcar a fatura como paga.",
      );
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <PageHeader
          eyebrow="fatura caixa"
          title="Acompanhe a fatura com clareza."
          description="Veja totais, diferença, status, categorias e compras importadas do PDF da fatura Caixa."
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:w-[520px]">
          <label className="block">
            <span className="mb-2 block text-sm text-muted-foreground">Fatura</span>
            <select
              value={selectedInvoiceId}
              onChange={(event) => setSelectedInvoiceId(event.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-secondary/35 px-3 text-sm text-foreground outline-none transition focus:border-primary/50"
            >
              {(invoices ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.cardName} {item.referenceMonth}/{item.referenceYear} final{" "}
                  {item.cardLastDigits || "-"}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-muted-foreground">Status</span>
            <select
              value={invoice?.status ?? ""}
              disabled={!invoice}
              onChange={(event) => {
                if (invoice) {
                  void api
                    .updateInvoice(invoice.id, {
                      status: event.target.value as ApiInvoice["status"],
                    })
                    .then(() => Promise.all([refetchInvoice(), refetchInvoices()]));
                }
              }}
              className="h-10 w-full rounded-lg border border-border bg-secondary/35 px-3 text-sm text-foreground outline-none transition focus:border-primary/50 disabled:opacity-60"
            >
              <option value="open">Aberta</option>
              <option value="closed">Fechada</option>
              <option value="paid">Paga</option>
            </select>
          </label>
        </div>
      </div>

      {isLoadingInvoices || isLoadingInvoice ? (
        <Panel>
          <LoadingBlock label="Carregando fatura..." />
        </Panel>
      ) : null}

      {invoicesError || invoiceError ? (
        <Panel>
          <ErrorBlock
            message={invoicesError ?? invoiceError ?? "Erro ao carregar fatura."}
            onRetry={() => {
              void refetchInvoices();
              void refetchInvoice();
            }}
          />
        </Panel>
      ) : null}

      {!isLoadingInvoices && !invoicesError && (invoices?.length ?? 0) === 0 && (
        <Panel>
          <EmptyBlock
            title="Nenhuma fatura cadastrada ainda"
            description="Importe um PDF de fatura Caixa para ver totais, compras nacionais, internacionais, taxas e resumo por categoria."
            action={
              <button
                type="button"
                  onClick={() => navigateToImport("pdf")}
                className="h-10 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15"
              >
                Importar PDF da fatura
              </button>
            }
          />
        </Panel>
      )}

      {!isLoadingInvoices && !isLoadingInvoice && !invoicesError && !invoiceError && invoice && (
        <>
          <Panel className="mb-6">
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-start">
              <div>
                <p className="text-sm text-muted-foreground">
                  {invoice.cardName} final {invoice.cardLastDigits || "-"} ·{" "}
                  {invoice.referenceMonth}/{invoice.referenceYear}
                </p>
                <p className="mt-4 text-4xl font-semibold tracking-normal">
                  {formatCurrency(totalCalculated)}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <StatusPill tone={invoice.status === "paid" ? "invoicePaid" : "invoiceOpen"}>
                    {statusLabels[invoice.status]}
                  </StatusPill>
                  {hasDifference && <StatusPill tone="review">diferença visível</StatusPill>}
                  <StatusPill tone="neutral">{transactions.length} lançamentos</StatusPill>
                </div>
                {hasDifference && (
                  <p className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                    O total informado no PDF difere do total calculado em{" "}
                    {formatCurrency(difference)}. A diferença não foi escondida para
                    facilitar a conferência.
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoCard
                  label="Total informado"
                  value={totalFromFile === null ? "-" : formatCurrency(totalFromFile)}
                />
                <InfoCard label="Total calculado" value={formatCurrency(totalCalculated)} />
                <InfoCard
                  label="Diferença"
                  value={difference === null ? "-" : formatCurrency(difference)}
                  tone={hasDifference ? "warning" : undefined}
                />
                <InfoCard
                  label="Fechamento"
                  value={formatDate(buildInvoiceDate(invoice, invoice.closingDay))}
                />
                <InfoCard
                  label="Vencimento"
                  value={formatDate(buildInvoiceDate(invoice, invoice.dueDay))}
                />
                <button
                  type="button"
                  onClick={() => void markAsPaid()}
                  disabled={invoice.status === "paid"}
                  className="inline-flex h-full min-h-20 items-center justify-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  {invoice.status === "paid" ? "Fatura paga" : "Marcar como paga"}
                </button>
              </div>
            </div>
            {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}
          </Panel>

          <div className="grid gap-4 md:grid-cols-3">
            <InfoCard label="Nacionais" value={formatCurrency(invoice.nationalTotal ?? 0)} />
            <InfoCard
              label="Internacionais"
              value={formatCurrency(invoice.internationalTotal ?? 0)}
            />
            <InfoCard label="Taxas e IOF" value={formatCurrency(invoice.feesTotal ?? 0)} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <Panel title="Resumo por categoria">
              {categorizedOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sem categorias para resumir.
                </p>
              ) : (
                <div className="divide-y divide-border/80">
                  {categorizedOptions.map((category) => (
                    <div
                      key={category.categoryId ?? category.categoryName}
                      className="flex items-center justify-between gap-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{category.categoryName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {category.count} lançamento(s)
                        </p>
                      </div>
                      <span className="font-semibold text-rose-200">
                        {formatCurrency(category.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Filtros da lista">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-muted-foreground">
                    Categoria
                  </span>
                  <select
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-secondary/35 px-3 text-sm text-foreground outline-none transition focus:border-primary/50"
                  >
                    <option value="">Todas</option>
                    {categorizedOptions.map((category) => (
                      <option
                        key={category.categoryId ?? category.categoryName}
                        value={category.categoryId ?? ""}
                      >
                        {category.categoryName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-muted-foreground">
                    Revisão
                  </span>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-secondary/35 px-3 text-sm text-foreground outline-none transition focus:border-primary/50"
                  >
                    <option value="">Todos</option>
                    <option value="needs_review">A revisar</option>
                    <option value="reviewed">Revisados</option>
                  </select>
                </label>
              </div>
            </Panel>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
            <PurchaseSection title="Compras nacionais" rows={nationalTransactions} />
            <PurchaseSection title="Compras internacionais" rows={internationalTransactions} />
          </div>

          <PurchaseSection title="Taxas e IOF" rows={feeTransactions} className="mt-6" />
        </>
      )}
    </div>
  );
}

function InfoCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <article
      className={cn(
        "rounded-lg border border-border bg-card p-4 shadow-soft",
        tone === "warning" && "border-amber-300/20 bg-amber-300/10",
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 text-xl font-semibold">{value}</p>
    </article>
  );
}

function PurchaseSection({
  title,
  rows,
  className,
}: {
  title: string;
  rows: ApiTransaction[];
  className?: string;
}) {
  return (
    <Panel
      title={title}
      className={className}
      action={
        <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
          <CreditCard className="size-4" aria-hidden="true" />
        </div>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum lançamento nesta seção.</p>
      ) : (
        <div className="divide-y divide-border/80">
          {rows.map((row) => (
            <div
              key={row.id}
              className="grid gap-3 py-4 text-sm sm:grid-cols-[80px_minmax(160px,1fr)_112px]"
            >
              <span className="text-muted-foreground">{formatDate(row.date)}</span>
              <div>
                <p className="font-medium text-foreground">{row.descriptionOriginal}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ReceiptText className="size-3.5" aria-hidden="true" />
                  {row.category?.name ?? "A revisar"} ·{" "}
                  {row.reviewStatus === "needs_review" ? "a revisar" : "revisado"}
                </p>
              </div>
              <span className="font-semibold text-rose-200 sm:text-right">
                {formatCurrency(-Math.abs(Number(row.amount)))}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function buildInvoiceDate(invoice: ApiInvoice, day: number) {
  const lastDayOfMonth = new Date(
    invoice.referenceYear,
    invoice.referenceMonth,
    0,
  ).getDate();
  const safeDay = Math.min(Math.max(day, 1), lastDayOfMonth);

  return `${invoice.referenceYear}-${String(invoice.referenceMonth).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

function navigateToPage(page: "inicio" | "importar" | "lancamentos" | "fatura-caixa" | "configuracoes") {
  window.dispatchEvent(new CustomEvent("financas:navigate", { detail: { page } }));
}

function navigateToImport(mode: "ofx" | "pdf") {
  window.sessionStorage.setItem("financas:import-mode", mode);
  navigateToPage("importar");
}

function classifyInvoiceTransaction(transaction: ApiTransaction): SectionType {
  if (/IOF|TAXA|ENCARGO/i.test(transaction.descriptionOriginal)) {
    return "fee";
  }

  if (
    /OPENAI|MICROSOFT|INTERNACIONAL|USD|US\$|COMPRA INTERNACIONAL/i.test(
      transaction.descriptionOriginal,
    )
  ) {
    return "international";
  }

  return "national";
}

const statusLabels: Record<ApiInvoice["status"], string> = {
  open: "Aberta",
  closed: "Fechada",
  paid: "Paga",
};
