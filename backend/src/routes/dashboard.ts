import { Router } from "express";
import { prisma } from "../lib/database.js";
import { asyncHandler, serializeForJson } from "../lib/http.js";

export const dashboardRouter = Router();

dashboardRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const now = new Date();
    const month = toNumber(request.query.month) ?? now.getMonth() + 1;
    const year = toNumber(request.query.year) ?? now.getFullYear();

    if (month < 1 || month > 12) {
      response.status(400).json({
        error: "INVALID_MONTH",
        message: "month deve estar entre 1 e 12.",
      });
      return;
    }

    const dateRange = {
      gte: new Date(Date.UTC(year, month - 1, 1)),
      lt: new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1)),
    };

    const [transactions, latestTransactions, biggestTransactions, needsReviewCount] =
      await Promise.all([
        prisma.transaction.findMany({
          where: {
            date: dateRange,
          },
          include: {
            category: true,
          },
        }),
        prisma.transaction.findMany({
          where: {
            date: dateRange,
          },
          include: {
            category: true,
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 6,
        }),
        prisma.transaction.findMany({
          where: {
            date: dateRange,
            direction: "expense",
          },
          include: {
            category: true,
          },
          orderBy: {
            amount: "desc",
          },
          take: 6,
        }),
        prisma.transaction.count({
          where: {
            date: dateRange,
            reviewStatus: "needs_review",
          },
        }),
      ]);

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

        if (transaction.direction === "expense") {
          const categoryId = transaction.categoryId ?? "uncategorized";
          const current = accumulator.expensesByCategory.get(categoryId) ?? {
            categoryId: transaction.categoryId,
            categoryName: transaction.category?.name ?? "Sem categoria",
            color: transaction.category?.color ?? null,
            total: 0,
          };

          current.total += amount;
          accumulator.expensesByCategory.set(categoryId, current);
        }

        return accumulator;
      },
      {
        totalIncome: 0,
        totalExpense: 0,
        creditTotal: 0,
        debitTotal: 0,
        accountTotal: 0,
        expensesByCategory: new Map<
          string,
          {
            categoryId: string | null;
            categoryName: string;
            color: string | null;
            total: number;
          }
        >(),
      },
    );

    response.json(
      serializeForJson({
        month,
        year,
        totalIncome: totals.totalIncome,
        totalExpense: totals.totalExpense,
        balanceEstimated: totals.totalIncome - totals.totalExpense,
        creditTotal: totals.creditTotal,
        debitTotal: totals.debitTotal,
        accountTotal: totals.accountTotal,
        needsReviewCount,
        expensesByCategory: Array.from(totals.expensesByCategory.values()).sort(
          (left, right) => right.total - left.total,
        ),
        latestTransactions,
        biggestTransactions,
      }),
    );
  }),
);

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
