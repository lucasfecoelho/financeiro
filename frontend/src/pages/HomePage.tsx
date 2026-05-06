import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Banknote,
  CreditCard,
  Landmark,
  Scale,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateBlocks";
import { StatusPill } from "@/components/StatusPill";
import { TransactionList } from "@/components/TransactionList";
import { useApiQuery } from "@/hooks/useApiQuery";
import { api } from "@/lib/api";
import type { ApiDashboard, ApiInvoice } from "@/lib/apiTypes";
import { formatCurrency } from "@/lib/format";
import { mapApiTransaction } from "@/lib/mappers";
import type { Metric } from "@/types";

const currentDate = new Date();
const defaultMonth = String(currentDate.getMonth() + 1);
const defaultYear = String(currentDate.getFullYear());

export function HomePage() {
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const dashboardKey = `${month}-${year}`;
  const {
    data: dashboard,
    error,
    isLoading,
    refetch,
  } = useApiQuery(() => api.dashboard({ month, year }), [dashboardKey]);
  const { data: invoices } = useApiQuery(api.invoices);
  const hasData = Boolean(
    dashboard &&
      (dashboard.totalIncome > 0 ||
        dashboard.totalExpense > 0 ||
        dashboard.latestTransactions.length > 0),
  );
  const metrics = useMemo(
    () => (dashboard ? buildMetrics(dashboard) : []),
    [dashboard],
  );
  const currentInvoice = useMemo(
    () => pickCurrentInvoice(invoices ?? [], Number(month), Number(year)),
    [invoices, month, year],
  );

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          eyebrow="visão geral"
          title="Resumo real do mês."
          description="Receitas, despesas, saldo estimado e revisão calculados a partir dos lançamentos salvos no SQLite."
        />

        <div className="grid gap-3 sm:w-[420px] sm:grid-cols-2">
          <FilterField label="Mês" value={month} onChange={setMonth} options={monthOptions} />
          <FilterField label="Ano" value={year} onChange={setYear} options={yearOptions} />
          <button
            type="button"
            onClick={() => navigateToPage("lancamentos")}
            className="h-10 rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 text-sm font-medium text-amber-100 transition hover:bg-amber-300/15"
          >
            Revisar pendências
          </button>
          <button
            type="button"
            onClick={() => navigateToPage("importar")}
            className="h-10 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            Importar arquivo
          </button>
        </div>
      </div>

      {isLoading && (
        <Panel>
          <LoadingBlock label="Calculando resumo mensal..." />
        </Panel>
      )}

      {error && (
        <Panel>
          <ErrorBlock message={error} onRetry={refetch} />
        </Panel>
      )}

      {!isLoading && !error && dashboard && !hasData && (
        <Panel>
          <EmptyBlock
            title="Nenhum dado para este mês"
            description="Importe um OFX ou ajuste o mês e ano para ver o resumo real dos lançamentos."
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
        </Panel>
      )}

      {!isLoading && !error && dashboard && hasData && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {metrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </div>

          <Panel title="Fatura atual" className="mt-6">
            {currentInvoice ? (
              <div className="grid gap-4 md:grid-cols-[1fr_0.8fr] md:items-center">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {currentInvoice.cardName} final {currentInvoice.cardLastDigits || "-"} ·{" "}
                    {currentInvoice.referenceMonth}/{currentInvoice.referenceYear}
                  </p>
                  <p className="mt-3 text-3xl font-semibold">
                    {formatCurrency(currentInvoice.totalCalculated ?? 0)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusPill
                      tone={currentInvoice.status === "paid" ? "invoicePaid" : "invoiceOpen"}
                    >
                      {invoiceStatusLabels[currentInvoice.status]}
                    </StatusPill>
                    <StatusPill tone="neutral">
                      vencimento dia {currentInvoice.dueDay}
                    </StatusPill>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigateToPage("fatura-caixa")}
                  className="h-10 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-accent"
                >
                  Ver fatura Caixa
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Nenhuma fatura encontrada para este mês. Importe o PDF da Caixa para acompanhar total, vencimento e compras.
                </p>
                <button
                  type="button"
                  onClick={() => navigateToImport("pdf")}
                  className="h-10 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15"
                >
                  Importar PDF
                </button>
              </div>
            )}
          </Panel>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Panel
              title="Gastos por categoria"
              description="Categorias com maior despesa no período selecionado."
            >
              {dashboard.expensesByCategory.length > 0 ? (
                <>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dashboard.expensesByCategory}
                        margin={{ left: 0, right: 12 }}
                      >
                        <CartesianGrid
                          stroke="#2f342c"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="categoryName"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#9ca39a", fontSize: 12 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#9ca39a", fontSize: 12 }}
                          tickFormatter={(value) => `R$ ${Number(value) / 1000}k`}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(255,255,255,0.04)" }}
                          contentStyle={{
                            background: "#171914",
                            border: "1px solid #30352c",
                            borderRadius: 8,
                            color: "#f3f5ef",
                          }}
                          formatter={(value) => formatCurrency(Number(value))}
                        />
                        <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                          {dashboard.expensesByCategory.map((category, index) => (
                            <Cell
                              key={`${category.categoryName}-${index}`}
                              fill={category.color ?? fallbackColors[index % fallbackColors.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {dashboard.expensesByCategory.slice(0, 6).map((category, index) => (
                      <div
                        key={`${category.categoryName}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/35 px-3 py-3"
                      >
                        <span className="text-sm text-muted-foreground">
                          {category.categoryName}
                        </span>
                        <span className="text-sm font-semibold">
                          {formatCurrency(category.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyBlock
                  title="Sem despesas categorizadas"
                  description="As despesas do mês aparecerão aqui agrupadas por categoria."
                />
              )}
            </Panel>

            <Panel
              title="Maiores gastos"
              description="Despesas mais altas do mês selecionado."
            >
              {dashboard.biggestTransactions.length > 0 ? (
                <TransactionList
                  transactions={dashboard.biggestTransactions.map(mapApiTransaction)}
                  compact
                />
              ) : (
                <EmptyBlock
                  title="Sem gastos no período"
                  description="Nenhuma despesa encontrada para este mês."
                />
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <StatusPill tone="review">
                  {dashboard.needsReviewCount} a revisar
                </StatusPill>
                <StatusPill tone="neutral">
                  Conta {formatCurrency(dashboard.accountTotal)}
                </StatusPill>
                <StatusPill tone="neutral">
                  Débito {formatCurrency(dashboard.debitTotal)}
                </StatusPill>
              </div>
            </Panel>
          </div>

          <Panel title="Últimos lançamentos" className="mt-6">
            {dashboard.latestTransactions.length > 0 ? (
              <TransactionList
                transactions={dashboard.latestTransactions.map(mapApiTransaction)}
              />
            ) : (
              <EmptyBlock
                title="Sem lançamentos recentes"
                description="Os últimos movimentos salvos no mês aparecerão aqui."
              />
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function buildMetrics(dashboard: ApiDashboard): Metric[] {
  return [
    {
      label: "Saldo estimado",
      value: dashboard.balanceEstimated,
      tone: dashboard.balanceEstimated >= 0 ? "positive" : "negative",
      helper: "Receitas menos despesas",
      icon: Wallet,
    },
    {
      label: "Receitas",
      value: dashboard.totalIncome,
      tone: "positive",
      helper: "Entradas do mês",
      icon: Banknote,
    },
    {
      label: "Despesas",
      value: -dashboard.totalExpense,
      tone: "negative",
      helper: "Saídas do mês",
      icon: ShoppingBag,
    },
    {
      label: "Crédito",
      value: -dashboard.creditTotal,
      tone: "invoice",
      helper: "Lançamentos em crédito",
      icon: CreditCard,
    },
    {
      label: "Débito",
      value: -dashboard.debitTotal,
      tone: "neutral",
      helper: "Lançamentos em débito",
      icon: Landmark,
    },
    {
      label: "A revisar",
      value: dashboard.needsReviewCount,
      tone: "review",
      helper: "Lançamentos pendentes",
      icon: Scale,
      format: "number",
    },
  ];
}

function navigateToPage(page: "inicio" | "importar" | "lancamentos" | "fatura-caixa" | "configuracoes") {
  window.dispatchEvent(new CustomEvent("financas:navigate", { detail: { page } }));
}

function navigateToImport(mode: "ofx" | "pdf") {
  window.sessionStorage.setItem("financas:import-mode", mode);
  navigateToPage("importar");
}

function pickCurrentInvoice(invoices: ApiInvoice[], month: number, year: number) {
  return (
    invoices.find(
      (invoice) =>
        invoice.referenceMonth === month && invoice.referenceYear === year,
    ) ??
    invoices.find((invoice) => invoice.status !== "paid") ??
    invoices[0] ??
    null
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

const yearOptions = Array.from({ length: 5 }, (_item, index) => {
  const year = currentDate.getFullYear() - index;
  return { label: String(year), value: String(year) };
});

const fallbackColors = ["#86efac", "#67e8f9", "#facc15", "#fda4af", "#c4b5fd"];

const invoiceStatusLabels: Record<ApiInvoice["status"], string> = {
  open: "Fatura aberta",
  closed: "Fatura fechada",
  paid: "Fatura paga",
};
