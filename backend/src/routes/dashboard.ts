import { Router } from "express";
import { prisma } from "../lib/database.js";
import { asyncHandler, serializeForJson } from "../lib/http.js";

export const dashboardRouter = Router();

type DashboardScope = "month" | "year" | "all";

type DateRange = {
  gte?: Date;
  lt?: Date;
};

type DashboardTotals = {
  totalIncome: number;
  totalExpense: number;
  balanceEstimated: number;
  creditTotal: number;
  debitTotal: number;
  accountTotal: number;
  needsReviewCount: number;
  needsReviewTotal: number;
  expensesByCategory: Array<{
    categoryId: string | null;
    categoryName: string;
    color: string | null;
    total: number;
  }>;
  expensesByDay: Array<{
    date: string;
    total: number;
  }>;
};

dashboardRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const now = new Date();
    const scope = parseScope(request.query.scope);
    const month = toNumber(request.query.month) ?? now.getMonth() + 1;
    const year = toNumber(request.query.year) ?? now.getFullYear();

    if (month < 1 || month > 12) {
      response.status(400).json({
        error: "INVALID_MONTH",
        message: "month deve estar entre 1 e 12.",
      });
      return;
    }

    const dateRange = resolveDateRange(scope, month, year);
    const previousRange = resolvePreviousDateRange(scope, month, year);

    const [transactions, latestTransactions, biggestTransactions, previousTransactions] =
      await Promise.all([
        findTransactions(dateRange),
        prisma.transaction.findMany({
          where: buildDateWhere(dateRange),
          include: {
            category: true,
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 6,
        }),
        prisma.transaction.findMany({
          where: {
            ...buildDateWhere(dateRange),
            direction: "expense",
          },
          include: {
            category: true,
          },
          orderBy: {
            amount: "desc",
          },
          take: 8,
        }),
        previousRange ? findTransactions(previousRange) : Promise.resolve([]),
      ]);

    const totals = summarizeTransactions(transactions);
    const previousTotals = previousRange ? summarizeTransactions(previousTransactions) : null;

    response.json(
      serializeForJson({
        scope,
        month,
        year,
        ...totals,
        previous:
          previousTotals === null
            ? null
            : {
                totalIncome: previousTotals.totalIncome,
                totalExpense: previousTotals.totalExpense,
                balanceEstimated: previousTotals.balanceEstimated,
                creditTotal: previousTotals.creditTotal,
                debitTotal: previousTotals.debitTotal,
                accountTotal: previousTotals.accountTotal,
                expensesByCategory: previousTotals.expensesByCategory,
              },
        monthlyTrend: scope === "year" ? buildMonthlyTrend(transactions, year) : [],
        latestTransactions,
        biggestTransactions,
      }),
    );
  }),
);

function findTransactions(dateRange: DateRange | null) {
  return prisma.transaction.findMany({
    where: buildDateWhere(dateRange),
    include: {
      category: true,
    },
  });
}

function summarizeTransactions(
  transactions: Awaited<ReturnType<typeof findTransactions>>,
): DashboardTotals {
  const totals = transactions.reduce(
    (accumulator, transaction) => {
      const amount = toStoredPositiveAmount(transaction.amount);

      if (transaction.direction === "income") {
        accumulator.totalIncome += amount;
      }

      if (transaction.direction === "expense") {
        accumulator.totalExpense += amount;
      }

      if (transaction.paymentMethod === "credit") {
        accumulator.creditTotal += amount;
      }

      if (transaction.paymentMethod === "debit") {
        accumulator.debitTotal += amount;
      }

      if (transaction.paymentMethod === "account") {
        accumulator.accountTotal += amount;
      }

      if (transaction.reviewStatus === "needs_review") {
        accumulator.needsReviewCount += 1;
        accumulator.needsReviewTotal += amount;
      }

      if (transaction.direction === "expense") {
        const categoryId = transaction.categoryId ?? "uncategorized";
        const current = accumulator.expensesByCategory.get(categoryId) ?? {
          categoryId: transaction.categoryId,
          categoryName: transaction.category?.name ?? "Sem categoria",
          color: transaction.category?.color ?? null,
          total: 0,
        };
        const dateKey = transaction.date.toISOString().slice(0, 10);
        const currentDayTotal = accumulator.expensesByDay.get(dateKey) ?? 0;

        current.total += amount;
        accumulator.expensesByCategory.set(categoryId, current);
        accumulator.expensesByDay.set(dateKey, currentDayTotal + amount);
      }

      return accumulator;
    },
    {
      totalIncome: 0,
      totalExpense: 0,
      creditTotal: 0,
      debitTotal: 0,
      accountTotal: 0,
      needsReviewCount: 0,
      needsReviewTotal: 0,
      expensesByCategory: new Map<
        string,
        {
          categoryId: string | null;
          categoryName: string;
          color: string | null;
          total: number;
        }
      >(),
      expensesByDay: new Map<string, number>(),
    },
  );

  return {
    totalIncome: totals.totalIncome,
    totalExpense: totals.totalExpense,
    balanceEstimated: totals.totalIncome - totals.totalExpense,
    creditTotal: totals.creditTotal,
    debitTotal: totals.debitTotal,
    accountTotal: totals.accountTotal,
    needsReviewCount: totals.needsReviewCount,
    needsReviewTotal: totals.needsReviewTotal,
    expensesByCategory: Array.from(totals.expensesByCategory.values()).sort(
      (left, right) => right.total - left.total,
    ),
    expensesByDay: Array.from(totals.expensesByDay.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((left, right) => left.date.localeCompare(right.date)),
  };
}

function buildMonthlyTrend(
  transactions: Awaited<ReturnType<typeof findTransactions>>,
  year: number,
) {
  const months = Array.from({ length: 12 }, (_item, index) => ({
    month: index + 1,
    income: 0,
    expense: 0,
  }));

  transactions.forEach((transaction) => {
    if (transaction.date.getUTCFullYear() !== year) {
      return;
    }

    const monthIndex = transaction.date.getUTCMonth();
    const amount = toStoredPositiveAmount(transaction.amount);

    if (transaction.direction === "income") {
      months[monthIndex].income += amount;
    }

    if (transaction.direction === "expense") {
      months[monthIndex].expense += amount;
    }
  });

  return months;
}

function resolveDateRange(scope: DashboardScope, month: number, year: number) {
  if (scope === "all") {
    return null;
  }

  if (scope === "year") {
    return {
      gte: new Date(Date.UTC(year, 0, 1)),
      lt: new Date(Date.UTC(year + 1, 0, 1)),
    };
  }

  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1)),
  };
}

function resolvePreviousDateRange(scope: DashboardScope, month: number, year: number) {
  if (scope === "all") {
    return null;
  }

  if (scope === "year") {
    return {
      gte: new Date(Date.UTC(year - 1, 0, 1)),
      lt: new Date(Date.UTC(year, 0, 1)),
    };
  }

  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;

  return {
    gte: new Date(Date.UTC(previousYear, previousMonth - 1, 1)),
    lt: new Date(Date.UTC(year, month - 1, 1)),
  };
}

function buildDateWhere(dateRange: DateRange | null) {
  return dateRange ? { date: dateRange } : {};
}

function parseScope(value: unknown): DashboardScope {
  return value === "year" || value === "all" ? value : "month";
}

function toStoredPositiveAmount(value: unknown) {
  return Math.abs(Number(value));
}

function toNumber(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}
