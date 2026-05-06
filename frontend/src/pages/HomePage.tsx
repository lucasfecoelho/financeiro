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
  Sparkles,
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
import type { ApiAiMonthlySummary, ApiDashboard } from "@/lib/apiTypes";
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
  const { data: aiStatus } = useApiQuery(api.aiStatus);
  const [aiSummary, setAiSummary] = useState<ApiAiMonthlySummary | null>(null);
  const [aiSummaryState, setAiSummaryState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [aiSummaryMessage, setAiSummaryMessage] = useState<string | null>(null);
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

  async function generateAiSummary() {
    if (!dashboard) {
      return;
    }

    setAiSummaryState("loading");
    setAiSummaryMessage(null);

    try {
      const summary = await api.monthlySummaryWithAi({
        month,
        year,
        dashboard,
      });
      setAiSummary(summary);
      setAiSummaryState("ready");
    } catch (caughtError) {
      setAiSummary(null);
      setAiSummaryState("error");
      setAiSummaryMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível gerar o resumo inteligente.",
      );
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          eyebrow="visão geral"
          title="Resumo real do mês."
          description="Receitas, despesas, saldo estimado e revisão calculados a partir dos lançamentos salvos no SQLite."
        />

        <div className="grid grid-cols-2 gap-3 sm:w-80">
          <FilterField label="Mês" value={month} onChange={setMonth} options={monthOptions} />
          <FilterField label="Ano" value={year} onChange={setYear} options={yearOptions} />
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

          <Panel
            title="Resumo inteligente do mês"
            description={
              aiStatus?.enabled
                ? "Um resumo opcional gerado com base nos números agregados da tela."
                : (aiStatus?.message ?? "IA assistiva opcional.")
            }
            className="mt-6"
            action={
              <button
                type="button"
                onClick={() => void generateAiSummary()}
                disabled={!aiStatus?.enabled || aiSummaryState === "loading"}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                {aiSummaryState === "loading" ? "Gerando..." : "Gerar resumo"}
              </button>
            }
          >
            {aiSummary ? (
              <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                <div className="rounded-lg border border-border bg-secondary/35 p-4">
                  <p className="text-sm leading-6 text-foreground">{aiSummary.summary}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <SummaryList title="Principais gastos" items={aiSummary.topExpenses} />
                  <SummaryList title="Alertas simples" items={aiSummary.alerts} />
                </div>
              </div>
            ) : (
              <p
                className={
                  aiSummaryState === "error"
                    ? "text-sm text-rose-200"
                    : "text-sm text-muted-foreground"
                }
              >
                {aiSummaryMessage ??
                  "A IA não é necessária para usar o app. Gere um resumo quando quiser uma leitura rápida do mês."}
              </p>
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

function SummaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/25 p-4">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Sem pontos relevantes.</p>
      )}
    </div>
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
