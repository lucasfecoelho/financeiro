import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileDown,
  ListChecks,
  ReceiptText,
  Search,
  WalletCards,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateBlocks";
import { StatusPill } from "@/components/StatusPill";
import { useApiQuery } from "@/hooks/useApiQuery";
import { api } from "@/lib/api";
import type { ApiInvoice, ApiTransaction } from "@/lib/apiTypes";
import { formatCurrency, formatDate } from "@/lib/format";
import { getSelectedPeriod, setSelectedPeriod } from "@/lib/period";
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
    if (!invoices) {
      return;
    }

    const selectedPeriod = getSelectedPeriod();
    const invoiceForPeriod = invoices.find(
      (item) =>
        item.referenceMonth === Number(selectedPeriod.month) &&
        item.referenceYear === Number(selectedPeriod.year),
    );

    if (invoiceForPeriod) {
      setSelectedInvoiceId(invoiceForPeriod.id);
      return;
    }

    setSelectedInvoiceId("");
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
  const pendingTransactions = transactions.filter(
    (transaction) => transaction.reviewStatus === "needs_review",
  );
  const biggestTransaction = transactions
    .filter((transaction) => classifyInvoiceTransaction(transaction) !== "fee")
    .slice()
    .sort((left, right) => Math.abs(Number(right.amount)) - Math.abs(Number(left.amount)))[0];
  const internationalAndFeesTotal =
    (invoice?.internationalTotal ?? 0) + (invoice?.feesTotal ?? 0);
  const previousInvoice = useMemo(() => {
    if (!invoice || !invoices) {
      return null;
    }

    return (
      invoices
        .filter((item) => {
          const currentKey = invoice.referenceYear * 100 + invoice.referenceMonth;
          const itemKey = item.referenceYear * 100 + item.referenceMonth;
          return item.id !== invoice.id && itemKey < currentKey;
        })
        .sort(
          (left, right) =>
            right.referenceYear * 100 +
            right.referenceMonth -
            (left.referenceYear * 100 + left.referenceMonth),
        )[0] ?? null
    );
  }, [invoice, invoices]);
  const previousComparison =
    previousInvoice && invoice
      ? totalCalculated - (previousInvoice.totalCalculated ?? 0)
      : null;

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
          eyebrow="cartão caixa"
          title="Sua fatura, sem surpresa."
          description="Compras, vencimento, categorias e pontos de revisão em um só lugar."
        />

        <div className="grid gap-3 sm:grid-cols-[1fr_150px] xl:w-[560px]">
          <label className="block">
            <span className="mb-2 block text-sm text-muted-foreground">Fatura</span>
            <select
              value={selectedInvoiceId}
              onChange={(event) => {
                const nextInvoiceId = event.target.value;
                const nextInvoice = invoices?.find((item) => item.id === nextInvoiceId);

                setSelectedInvoiceId(nextInvoiceId);

                if (nextInvoice) {
                  setSelectedPeriod({
                    month: String(nextInvoice.referenceMonth),
                    year: String(nextInvoice.referenceYear),
                  });
                }
              }}
              className="h-10 w-full rounded-lg border border-border bg-secondary/35 px-3 text-sm text-foreground outline-none transition focus:border-primary/50"
            >
              <option value="">Nenhuma fatura neste mês</option>
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
            title="Nenhuma fatura por aqui ainda"
            description="Importe o PDF da fatura Caixa para acompanhar compras, categorias e vencimento."
            action={
              <button
                type="button"
                  onClick={() => navigateToImport("pdf")}
                className="h-10 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15"
              >
                Importar fatura PDF
              </button>
            }
          />
        </Panel>
      )}

      {!isLoadingInvoices &&
        !isLoadingInvoice &&
        !invoicesError &&
        !invoiceError &&
        (invoices?.length ?? 0) > 0 &&
        !invoice && (
          <Panel>
            <EmptyBlock
              title="Nenhuma fatura neste mês"
              description="Não encontrei fatura para o período selecionado. Escolha outra fatura acima ou importe o PDF da Caixa."
              action={
                <button
                  type="button"
                  onClick={() => navigateToImport("pdf")}
                  className="h-10 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15"
                >
                  Importar fatura PDF
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

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigateToInvoiceReview(invoice)}
                disabled={pendingTransactions.length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 text-sm font-medium text-amber-100 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ListChecks className="size-4" aria-hidden="true" />
                Revisar compras da fatura
              </button>
              <button
                type="button"
                onClick={() => navigateToInvoiceTransactions(invoice)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-accent"
              >
                <Search className="size-4" aria-hidden="true" />
                Ver na consulta geral
              </button>
            </div>
          </Panel>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <InfoCard label="Total da fatura" value={formatCurrency(totalCalculated)} icon={CreditCard} />
            <InfoCard
              label="Vencimento"
              value={formatDate(buildInvoiceDate(invoice, invoice.dueDay))}
              icon={CalendarClock}
            />
            <InfoCard
              label="Compras a revisar"
              value={String(pendingTransactions.length)}
              icon={ListChecks}
              tone={pendingTransactions.length > 0 ? "warning" : undefined}
            />
            <InfoCard
              label="Maior compra"
              value={biggestTransaction ? formatCurrency(Math.abs(Number(biggestTransaction.amount))) : "-"}
              helper={biggestTransaction?.descriptionClean}
              icon={ReceiptText}
            />
            <InfoCard
              label="Internacional/IOF"
              value={formatCurrency(internationalAndFeesTotal)}
              icon={WalletCards}
            />
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

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <Panel title="Maiores compras">
              <CompactPurchaseList
                rows={transactions
                  .filter((transaction) => classifyInvoiceTransaction(transaction) !== "fee")
                  .slice()
                  .sort(
                    (left, right) =>
                      Math.abs(Number(right.amount)) - Math.abs(Number(left.amount)),
                  )
                  .slice(0, 5)}
              />
            </Panel>

            <Panel title="Compras a revisar">
              {pendingTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Tudo revisado nesta fatura.
                </p>
              ) : (
                <CompactPurchaseList rows={pendingTransactions.slice(0, 5)} />
              )}
            </Panel>

            <Panel title="Comparação">
              {previousInvoice ? (
                <div>
                  <p className="text-sm text-muted-foreground">
                    Fatura anterior: {previousInvoice.referenceMonth}/
                    {previousInvoice.referenceYear}
                  </p>
                  <p
                    className={cn(
                      "mt-3 text-2xl font-semibold",
                      (previousComparison ?? 0) > 0 ? "text-rose-100" : "text-emerald-100",
                    )}
                  >
                    {previousComparison === null
                      ? "-"
                      : formatCurrency(Math.abs(previousComparison))}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {previousComparison !== null && previousComparison > 0
                      ? "acima da fatura anterior"
                      : "abaixo da fatura anterior"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Importe outra fatura para comparar evolução de gastos.
                </p>
              )}
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
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  helper?: string;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone?: "warning";
}) {
  return (
    <article
      className={cn(
        "rounded-lg border border-border bg-card p-4 shadow-soft",
        tone === "warning" && "border-amber-300/20 bg-amber-300/10",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && <Icon className="size-4 text-primary" aria-hidden={true} />}
      </div>
      <p className="mt-3 text-xl font-semibold">{value}</p>
      {helper && (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{helper}</p>
      )}
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

function CompactPurchaseList({ rows }: { rows: ApiTransaction[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nada para mostrar aqui.</p>;
  }

  return (
    <div className="divide-y divide-border/80">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-4 py-3 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.descriptionClean}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(row.date)} · {row.category?.name ?? "A revisar"}
            </p>
          </div>
          <span className="shrink-0 font-semibold text-rose-200">
            {formatCurrency(Math.abs(Number(row.amount)))}
          </span>
        </div>
      ))}
    </div>
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
  window.dispatchEvent(new CustomEvent("financas:open-import", { detail: { mode } }));
}

function navigateToInvoiceTransactions(invoice: ApiInvoice) {
  window.sessionStorage.setItem(
    "financas:transactions-filter",
    JSON.stringify({
      mode: "invoice",
      month: String(invoice.referenceMonth),
      year: String(invoice.referenceYear),
      source: "pdf_invoice",
      invoiceId: invoice.id,
      label: `fatura ${invoice.referenceMonth}/${invoice.referenceYear}`,
    }),
  );
  navigateToPage("lancamentos");
}

function navigateToInvoiceReview(invoice: ApiInvoice) {
  window.sessionStorage.setItem(
    "financas:transactions-filter",
    JSON.stringify({
      mode: "review",
      month: String(invoice.referenceMonth),
      year: String(invoice.referenceYear),
      source: "pdf_invoice",
      invoiceId: invoice.id,
      label: `fatura ${invoice.referenceMonth}/${invoice.referenceYear}`,
    }),
  );
  navigateToPage("lancamentos");
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
