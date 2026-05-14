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
  AlertTriangle,
  Banknote,
  CalendarDays,
  CreditCard,
  FileUp,
  ListChecks,
  ReceiptText,
  Scale,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { Panel } from "@/components/Panel";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateBlocks";
import { StatusPill } from "@/components/StatusPill";
import { useApiQuery } from "@/hooks/useApiQuery";
import { api } from "@/lib/api";
import type { ApiDashboard, ApiDashboardCategoryExpense, ApiInvoice, ApiTransaction } from "@/lib/apiTypes";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCurrentPeriod, getSelectedPeriod, setSelectedPeriod } from "@/lib/period";
import { cn } from "@/lib/utils";
import type { Metric } from "@/types";

type DashboardImportContext = {
  month: string;
  year: string;
  source?: "import";
};

type PeriodScope = ApiDashboard["scope"];

export function HomePage() {
  const [dashboardContext, setDashboardContext] = useState<DashboardImportContext | null>(
    readDashboardImportContext,
  );
  const [scope, setScope] = useState<PeriodScope>("month");
  const [month, setMonth] = useState(() => dashboardContext?.month ?? getSelectedPeriod().month);
  const [year, setYear] = useState(() => dashboardContext?.year ?? getSelectedPeriod().year);
  const dashboardKey = `${scope}-${month}-${year}`;
  const {
    data: dashboard,
    error,
    isLoading,
    refetch,
  } = useApiQuery(() => api.dashboard({ month, year, scope }), [dashboardKey]);
  const { data: invoices } = useApiQuery(api.invoices);

  const currentInvoice = useMemo(
    () =>
      scope === "month"
        ? pickInvoiceForPeriod(invoices ?? [], Number(month), Number(year))
        : null,
    [invoices, month, scope, year],
  );

  const periodLabel = buildPeriodLabel(scope, month, year);
  const hasData = Boolean(
    dashboard &&
      (dashboard.totalIncome > 0 ||
        dashboard.totalExpense > 0 ||
        dashboard.needsReviewCount > 0 ||
        currentInvoice),
  );

  const metrics = useMemo(
    () => (dashboard ? buildMetrics(dashboard, currentInvoice, scope) : []),
    [dashboard, currentInvoice, scope],
  );

  const categorizedExpenses = useMemo(
    () =>
      (dashboard?.expensesByCategory ?? []).filter(
        (category) => !isReviewCategory(category.categoryName),
      ),
    [dashboard],
  );
  const reviewExpense = useMemo(
    () =>
      (dashboard?.expensesByCategory ?? []).find((category) =>
        isReviewCategory(category.categoryName),
      ) ?? null,
    [dashboard],
  );
  const topCategory = categorizedExpenses[0] ?? null;
  const biggestExpense = dashboard?.biggestTransactions[0] ?? null;
  const biggestDay = dashboard ? findBiggestExpenseDay(dashboard) : null;
  const comparison = dashboard ? buildComparison(dashboard) : null;
  const categoryGrowth = dashboard ? findLargestCategoryGrowth(dashboard) : null;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-soft">
        <div className="relative grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.14),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--accent)/0.55),transparent_34%)]" />
          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Início
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Seu dinheiro em {periodLabel}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              Entradas, saídas, fatura, pendências e o que mudou no período.
            </p>
          </div>

          <div className="relative w-full max-w-xl space-y-3">
            <div className="grid grid-cols-3 rounded-2xl border border-border bg-card/80 p-1">
              {periodScopes.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setScope(option.value)}
                  className={cn(
                    "h-10 rounded-xl text-sm font-bold text-muted-foreground transition hover:text-foreground",
                    scope === option.value && "bg-primary/10 text-foreground ring-1 ring-primary/20",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {scope !== "all" && (
              <div className={cn("grid gap-3", scope === "month" ? "sm:grid-cols-2" : "sm:grid-cols-1")}>
                {scope === "month" && (
                  <FilterField
                    label="Mês"
                    value={month}
                    onChange={(value) => {
                      setDashboardContext(null);
                      setMonth(value);
                      setSelectedPeriod({ month: value, year });
                    }}
                    options={monthOptions}
                  />
                )}
                <FilterField
                  label="Ano"
                  value={year}
                  onChange={(value) => {
                    setDashboardContext(null);
                    setYear(value);
                    setSelectedPeriod({ month, year: value });
                  }}
                  options={yearOptions}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {dashboardContext?.source === "import" && (
        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-foreground">
                Resumo do mês importado: {monthLabel(Number(month))} de {year}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                O período selecionado foi ajustado para o arquivo que acabou de entrar.
              </p>
            </div>
            <StatusPill tone="invoicePaid">importação concluída</StatusPill>
          </div>
        </Panel>
      )}

      {isLoading && (
        <Panel>
          <LoadingBlock label="Preparando seu resumo..." />
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
            title={`Nada em ${periodLabel}`}
            description="Não encontrei movimentos neste período. Importe um arquivo ou escolha outro período."
            action={
              <button
                type="button"
                onClick={() => navigateToImport("ofx")}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 text-sm font-bold text-primary transition hover:bg-primary/20"
              >
                <FileUp className="size-4" aria-hidden="true" />
                Importar arquivo
              </button>
            }
          />
        </Panel>
      )}

      {!isLoading && !error && dashboard && hasData && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {metrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </div>

          <Panel title="Resumo do período">
            <p className="text-lg font-semibold leading-8 text-foreground">
              {buildSummaryText({
                dashboard,
                scope,
                periodLabel,
                topCategory,
                biggestExpense,
              })}
            </p>
            {comparison && (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <ComparisonCard
                  label={scope === "year" ? "Despesas vs. ano anterior" : "Despesas vs. mês anterior"}
                  value={comparison.expenseDelta}
                  previousValue={dashboard.previous?.totalExpense ?? 0}
                />
                {categoryGrowth && (
                  <ComparisonCard
                    label="Categoria que mais cresceu"
                    value={categoryGrowth.delta}
                    previousValue={categoryGrowth.previous}
                    description={categoryGrowth.categoryName}
                  />
                )}
              </div>
            )}
          </Panel>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Panel
              title={scope === "year" ? "Receitas x despesas" : "Onde o dinheiro foi"}
              description={
                scope === "year"
                  ? "Evolução mensal do ano selecionado."
                  : "Categorias principais, separando pendências da análise."
              }
            >
              {scope === "year" ? (
                <YearTrendChart dashboard={dashboard} />
              ) : (
                <CategoryChart
                  categories={categorizedExpenses}
                  reviewExpense={reviewExpense}
                  totalExpense={dashboard.totalExpense}
                  onReview={() => navigateToReview(scope, month, year)}
                />
              )}
            </Panel>

            <Panel title="Destaques do período">
              <div className="space-y-3">
                <InsightRow
                  icon={ReceiptText}
                  label="Maior gasto"
                  value={
                    biggestExpense
                      ? `${biggestExpense.descriptionClean} · ${formatCurrency(Number(biggestExpense.amount))}`
                      : "Nenhuma saída relevante"
                  }
                  helper={biggestExpense ? formatDate(biggestExpense.date) : "Sem despesas no período"}
                  tone="negative"
                />
                <InsightRow
                  icon={ShoppingBag}
                  label="Maior categoria"
                  value={
                    topCategory
                      ? `${topCategory.categoryName} · ${formatCurrency(topCategory.total)}`
                      : "Sem categoria dominante"
                  }
                  helper="Ignorando itens ainda em A revisar"
                  tone="neutral"
                />
                <InsightRow
                  icon={CalendarDays}
                  label="Dia com maior gasto"
                  value={
                    biggestDay
                      ? `${formatDate(biggestDay.date)} · ${formatCurrency(biggestDay.total)}`
                      : "Sem concentração em um dia"
                  }
                  helper="Somente saídas do período"
                  tone="neutral"
                />
                <InsightRow
                  icon={CreditCard}
                  label="Cartão"
                  value={formatCurrency(dashboard.creditTotal)}
                  helper={currentInvoice ? "Fatura do mês selecionado encontrada" : "Total em crédito no período"}
                  tone="invoice"
                />
                <InsightRow
                  icon={Wallet}
                  label="Conta"
                  value={formatCurrency(dashboard.accountTotal + dashboard.debitTotal)}
                  helper="Movimentos fora do cartão, como apoio ao mês"
                  tone="neutral"
                />
              </div>
            </Panel>
          </div>

          <Panel
            title="Pendências"
            description="Esses lançamentos ainda não entram corretamente nas análises por categoria."
            action={
              dashboard.needsReviewCount > 0 ? (
                <button
                  type="button"
                  onClick={() => navigateToReview(scope, month, year)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-400/10 px-4 text-sm font-bold text-amber-700 transition hover:bg-amber-400/20 dark:text-amber-100"
                >
                  <ListChecks className="size-4" aria-hidden="true" />
                  Revisar agora
                </button>
              ) : null
            }
          >
            {dashboard.needsReviewCount > 0 ? (
              <div className="grid gap-4 md:grid-cols-3">
                <PendingCard label="Lançamentos" value={`${dashboard.needsReviewCount}`} />
                <PendingCard label="Valor envolvido" value={formatCurrency(dashboard.needsReviewTotal)} />
                <PendingCard
                  label="Peso nas despesas"
                  value={`${Math.round((dashboard.needsReviewTotal / Math.max(dashboard.totalExpense, 1)) * 100)}%`}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Tudo revisado neste período. As categorias já estão prontas para análise.
              </p>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function buildMetrics(
  dashboard: ApiDashboard,
  invoice: ApiInvoice | null,
  scope: PeriodScope,
): Metric[] {
  return [
    {
      label: "Receitas",
      value: dashboard.totalIncome,
      tone: "positive",
      helper: "Entradas do período",
      icon: Banknote,
    },
    {
      label: "Despesas",
      value: -dashboard.totalExpense,
      tone: "negative",
      helper: "Saídas do período",
      icon: ShoppingBag,
    },
    {
      label: "Saldo estimado",
      value: dashboard.balanceEstimated,
      tone: dashboard.balanceEstimated >= 0 ? "positive" : "negative",
      helper: "Entradas menos saídas",
      icon: Wallet,
    },
    {
      label: scope === "month" ? "Fatura do mês" : "Cartão",
      value: scope === "month" ? invoice?.totalCalculated ?? dashboard.creditTotal : dashboard.creditTotal,
      tone: "invoice",
      helper: invoice ? invoiceStatusLabels[invoice.status] : "Total em crédito",
      icon: CreditCard,
    },
    {
      label: "A revisar",
      value: dashboard.needsReviewCount,
      tone: "review",
      helper: formatCurrency(dashboard.needsReviewTotal),
      icon: Scale,
      format: "number",
    },
  ];
}

function buildSummaryText({
  dashboard,
  scope,
  periodLabel,
  topCategory,
  biggestExpense,
}: {
  dashboard: ApiDashboard;
  scope: PeriodScope;
  periodLabel: string;
  topCategory: ApiDashboardCategoryExpense | null;
  biggestExpense: ApiTransaction | null;
}) {
  const opening =
    scope === "month"
      ? `Em ${periodLabel}, você recebeu ${formatCurrency(dashboard.totalIncome)} e gastou ${formatCurrency(dashboard.totalExpense)}.`
      : `${periodLabel}: você recebeu ${formatCurrency(dashboard.totalIncome)} e gastou ${formatCurrency(dashboard.totalExpense)}.`;
  const categoryText = topCategory
    ? `A maior categoria foi ${topCategory.categoryName}, com ${formatCurrency(topCategory.total)}.`
    : "Ainda não há uma categoria dominante.";
  const biggestText = biggestExpense
    ? `O maior gasto foi ${biggestExpense.descriptionClean}, de ${formatCurrency(Number(biggestExpense.amount))}.`
    : "Nenhum gasto grande apareceu no período.";
  const reviewText =
    dashboard.needsReviewCount > 0
      ? `Existem ${dashboard.needsReviewCount} lançamentos a revisar.`
      : "Não há pendências de revisão.";

  return `${opening} O saldo estimado ficou em ${formatCurrency(dashboard.balanceEstimated)}. ${categoryText} ${biggestText} ${reviewText}`;
}

function CategoryChart({
  categories,
  reviewExpense,
  totalExpense,
  onReview,
}: {
  categories: ApiDashboardCategoryExpense[];
  reviewExpense: ApiDashboardCategoryExpense | null;
  totalExpense: number;
  onReview: () => void;
}) {
  const hasReviewDominance =
    reviewExpense && reviewExpense.total >= Math.max(300, totalExpense * 0.25);

  if (categories.length === 0) {
    return (
      <EmptyBlock
        title="Sem categorias confiáveis"
        description="Revise os lançamentos pendentes para liberar uma leitura melhor."
        action={
          reviewExpense ? (
            <button
              type="button"
              onClick={onReview}
              className="h-10 rounded-lg border border-amber-500/20 bg-amber-400/10 px-4 text-sm font-bold text-amber-700 transition hover:bg-amber-400/20 dark:text-amber-100"
            >
              Revisar pendências
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      {hasReviewDominance && (
        <div className="mb-5 flex gap-3 rounded-2xl border border-amber-500/20 bg-amber-400/10 p-4 text-sm text-amber-800 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            Muitos gastos ainda estão sem categoria. Revise para melhorar a análise.
          </p>
        </div>
      )}

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={categories.slice(0, 8)} margin={{ left: 0, right: 12 }}>
            <CartesianGrid
              stroke="hsl(var(--border))"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="categoryName"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickFormatter={(value) => compactCurrency(Number(value))}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--accent))" }}
              contentStyle={tooltipStyle}
              formatter={(value) => formatCurrency(Number(value))}
            />
            <Bar dataKey="total" radius={[10, 10, 0, 0]}>
              {categories.slice(0, 8).map((category, index) => (
                <Cell
                  key={`${category.categoryName}-${index}`}
                  fill={category.color ?? fallbackColors[index % fallbackColors.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {categories.slice(0, 6).map((category, index) => (
          <div
            key={`${category.categoryName}-${index}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/35 px-4 py-3"
          >
            <span className="text-sm font-medium text-muted-foreground">
              {category.categoryName}
            </span>
            <span className="text-sm font-bold text-foreground">
              {formatCurrency(category.total)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function YearTrendChart({ dashboard }: { dashboard: ApiDashboard }) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dashboard.monthlyTrend} margin={{ left: 0, right: 12 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickFormatter={(value) => shortMonthNames[Number(value) - 1] ?? String(value)}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickFormatter={(value) => compactCurrency(Number(value))}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--accent))" }}
            contentStyle={tooltipStyle}
            labelFormatter={(value) => monthLabel(Number(value))}
            formatter={(value, name) => [
              formatCurrency(Number(value)),
              name === "income" ? "Receitas" : "Despesas",
            ]}
          />
          <Bar dataKey="income" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
          <Bar dataKey="expense" fill="#fb7185" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ComparisonCard({
  label,
  value,
  previousValue,
  description,
}: {
  label: string;
  value: number;
  previousValue: number;
  description?: string;
}) {
  const rose = value > 0;
  const percent = previousValue > 0 ? Math.round((value / previousValue) * 100) : null;

  return (
    <div className="rounded-2xl border border-border bg-secondary/35 p-4">
      <div className="flex items-center gap-2">
        {rose ? (
          <TrendingUp className="size-4 text-rose-600 dark:text-rose-200" aria-hidden="true" />
        ) : (
          <TrendingDown className="size-4 text-emerald-700 dark:text-emerald-200" aria-hidden="true" />
        )}
        <p className="text-sm font-semibold text-foreground">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">
        {value === 0 ? "sem mudança" : `${value > 0 ? "+" : ""}${formatCurrency(value)}`}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {description ??
          (percent === null
            ? "Sem base anterior para percentual."
            : `${percent > 0 ? "+" : ""}${percent}% em relação ao período anterior.`)}
      </p>
    </div>
  );
}

function InsightRow({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: typeof ReceiptText;
  label: string;
  value: string;
  helper: string;
  tone: "negative" | "neutral" | "review" | "invoice";
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-secondary/35 p-4">
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl border",
          tone === "negative" && "border-rose-500/20 bg-rose-400/10 text-rose-700 dark:text-rose-100",
          tone === "neutral" && "border-primary/20 bg-primary/10 text-primary",
          tone === "review" && "border-amber-500/20 bg-amber-400/10 text-amber-700 dark:text-amber-100",
          tone === "invoice" && "border-cyan-500/20 bg-cyan-400/10 text-cyan-700 dark:text-cyan-100",
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 truncate font-semibold text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
      </div>
    </div>
  );
}

function PendingCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/35 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function buildComparison(dashboard: ApiDashboard) {
  if (!dashboard.previous || dashboard.previous.totalExpense <= 0) {
    return null;
  }

  return {
    expenseDelta: dashboard.totalExpense - dashboard.previous.totalExpense,
  };
}

function findLargestCategoryGrowth(dashboard: ApiDashboard) {
  if (!dashboard.previous) {
    return null;
  }

  const previousByName = new Map(
    dashboard.previous.expensesByCategory
      .filter((category) => !isReviewCategory(category.categoryName))
      .map((category) => [category.categoryName, category.total]),
  );

  return (
    dashboard.expensesByCategory
      .filter((category) => !isReviewCategory(category.categoryName))
      .map((category) => {
        const previous = previousByName.get(category.categoryName) ?? 0;
        return {
          categoryName: category.categoryName,
          current: category.total,
          previous,
          delta: category.total - previous,
        };
      })
      .filter((category) => category.delta > 0)
      .sort((left, right) => right.delta - left.delta)[0] ?? null
  );
}

function findBiggestExpenseDay(dashboard: ApiDashboard) {
  return dashboard.expensesByDay.slice().sort((left, right) => right.total - left.total)[0] ?? null;
}

function navigateToPage(page: "inicio" | "importar" | "lancamentos" | "fatura-caixa" | "configuracoes") {
  window.dispatchEvent(new CustomEvent("financas:navigate", { detail: { page } }));
}

function navigateToReview(scope: PeriodScope, month: string, year: string) {
  window.sessionStorage.setItem(
    "financas:transactions-filter",
    JSON.stringify({
      mode: "review",
      month: scope === "month" ? month : "",
      year: scope === "all" ? "" : year,
      label: "pendências",
    }),
  );
  navigateToPage("lancamentos");
}

function navigateToImport(mode: "ofx" | "pdf") {
  window.dispatchEvent(new CustomEvent("financas:open-import", { detail: { mode } }));
}

function readDashboardImportContext(): DashboardImportContext | null {
  const rawContext = window.sessionStorage.getItem("financas:dashboard-filter");
  window.sessionStorage.removeItem("financas:dashboard-filter");

  if (!rawContext) {
    return null;
  }

  try {
    const context = JSON.parse(rawContext) as Partial<DashboardImportContext>;
    const month = Number(context.month);
    const year = Number(context.year);

    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
      return null;
    }

    const selectedPeriod = {
      month: String(month),
      year: String(year),
    };

    setSelectedPeriod(selectedPeriod);

    return {
      ...selectedPeriod,
      source: context.source === "import" ? "import" : undefined,
    };
  } catch {
    return null;
  }
}

function pickInvoiceForPeriod(invoices: ApiInvoice[], month: number, year: number) {
  return (
    invoices.find(
      (invoice) =>
        invoice.referenceMonth === month && invoice.referenceYear === year,
    ) ?? null
  );
}

function compactCurrency(value: number) {
  if (Math.abs(value) >= 1000) {
    return `R$ ${Math.round(value / 100) / 10}k`;
  }

  return `R$ ${Math.round(value)}`;
}

function buildPeriodLabel(scope: PeriodScope, month: string, year: string) {
  if (scope === "all") {
    return "desde o início";
  }

  if (scope === "year") {
    return year;
  }

  return `${monthLabel(Number(month)).toLowerCase()} de ${year}`;
}

function monthLabel(month: number) {
  return monthOptions.find((option) => option.value === String(month))?.label ?? "mês";
}

function isReviewCategory(categoryName: string) {
  return categoryName.toLowerCase().includes("revisar");
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
      <span className="mb-2 block text-sm font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-card/80 px-3 text-sm font-semibold text-foreground outline-none transition focus:border-primary/50"
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

const periodScopes: Array<{ label: string; value: PeriodScope }> = [
  { label: "Mês", value: "month" },
  { label: "Ano", value: "year" },
  { label: "Desde o início", value: "all" },
];

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
  const year = Number(getCurrentPeriod().year) - index;
  return { label: String(year), value: String(year) };
});

const shortMonthNames = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const fallbackColors = [
  "hsl(var(--primary))",
  "#38bdf8",
  "#f59e0b",
  "#fb7185",
  "#8b5cf6",
];

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 14,
  color: "hsl(var(--popover-foreground))",
  boxShadow: "0 16px 48px rgba(0,0,0,0.16)",
};

const invoiceStatusLabels: Record<ApiInvoice["status"], string> = {
  open: "Fatura aberta",
  closed: "Fatura fechada",
  paid: "Fatura paga",
};
