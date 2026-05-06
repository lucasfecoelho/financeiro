import { prisma } from "../lib/database.js";
import type { ParsedOfxStatement, ParsedOfxTransaction } from "./ofxParser.js";
import { findOfxDuplicate } from "./duplicateService.js";
import { findMatchingRule } from "./categoryRuleService.js";
import { normalizeTransactionAmount } from "./transactionAmount.js";

export type OfxPreviewTransaction = {
  previewId: string;
  import: boolean;
  date: string;
  trnType: string;
  amount: number;
  fitId: string;
  memo: string;
  direction: "income" | "expense" | "neutral";
  paymentMethod: "credit" | "debit" | "account" | "adjustment";
  reviewStatus: "reviewed" | "needs_review";
  categoryId: string | null;
  categoryName: string;
  descriptionClean: string | null;
  possibleDuplicate: boolean;
};

export type OfxPreview = {
  fileName: string;
  bankCode: string | null;
  accountId: string | null;
  accountType: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  totalRows: number;
  transactions: OfxPreviewTransaction[];
};

export type ConfirmOfxImportInput = {
  fileName: string;
  bankCode: string | null;
  accountId: string | null;
  accountType: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  transactions: OfxPreviewTransaction[];
};

export async function buildOfxPreview(
  fileName: string,
  statement: ParsedOfxStatement,
): Promise<OfxPreview> {
  const rules = await prisma.categoryRule.findMany({
    include: {
      category: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  const reviewCategory = await getReviewCategory();

  const transactions = await Promise.all(
    statement.transactions.map(async (transaction, index) => {
      const classification = classifyOfxTransaction(transaction);
      const ruleMatch = findMatchingRule(
        {
          descriptionOriginal: transaction.memo,
          descriptionClean: transaction.memo,
          paymentMethod: classification.paymentMethod,
        },
        rules,
      );
      const duplicate = await findOfxDuplicate({
        bankCode: statement.bankCode,
        accountId: statement.accountId,
        fitId: transaction.fitId,
        amount: normalizeTransactionAmount(transaction.amount),
        date: transaction.date,
      });

      return {
        previewId: `${transaction.fitId}-${index}`,
        import: !duplicate,
        date: transaction.dateText,
        trnType: transaction.trnType,
        amount: normalizeTransactionAmount(transaction.amount),
        fitId: transaction.fitId,
        memo: transaction.memo,
        direction: classification.direction,
        paymentMethod: classification.paymentMethod,
        reviewStatus: ruleMatch ? ("reviewed" as const) : ("needs_review" as const),
        categoryId: ruleMatch?.categoryId ?? reviewCategory?.id ?? null,
        categoryName: ruleMatch?.category.name ?? reviewCategory?.name ?? "A revisar",
        descriptionClean: ruleMatch?.descriptionClean ?? null,
        possibleDuplicate: Boolean(duplicate),
      };
    }),
  );

  return {
    fileName,
    bankCode: statement.bankCode,
    accountId: statement.accountId,
    accountType: statement.accountType,
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
    totalRows: transactions.length,
    transactions,
  };
}

export async function confirmOfxImport(input: ConfirmOfxImportInput) {
  const approvedTransactions = input.transactions.filter((transaction) => {
    return transaction.import && !transaction.possibleDuplicate;
  });
  const importBatch = await prisma.importBatch.create({
    data: {
      fileName: input.fileName,
      fileType: "ofx",
      detectedSource: input.bankCode === "104" ? "caixa_account" : "unknown",
      status: "imported",
      totalRows: input.transactions.length,
      importedRows: 0,
      duplicatedRows: 0,
    },
  });

  let importedRows = 0;
  let needsReviewRows = 0;
  let duplicatedRows = input.transactions.filter(
    (transaction) => transaction.possibleDuplicate,
  ).length;

  for (const transaction of approvedTransactions) {
    const date = parseDateOnly(transaction.date);
    const duplicate = await findOfxDuplicate({
      bankCode: input.bankCode,
      accountId: input.accountId,
      fitId: transaction.fitId,
      amount: normalizeTransactionAmount(transaction.amount),
      date,
    });

    if (duplicate) {
      duplicatedRows += 1;
      continue;
    }

    await prisma.transaction.create({
      data: {
        date,
        descriptionOriginal: transaction.memo,
        descriptionClean: transaction.descriptionClean ?? cleanDescription(transaction.memo),
        amount: normalizeTransactionAmount(transaction.amount),
        direction: transaction.direction,
        paymentMethod: transaction.paymentMethod,
        source: "ofx",
        categoryId: transaction.categoryId,
        reviewStatus: transaction.reviewStatus,
        externalId: transaction.fitId,
        bankCode: input.bankCode,
        accountId: input.accountId,
        importBatchId: importBatch.id,
      },
    });
    importedRows += 1;
    if (transaction.reviewStatus === "needs_review") {
      needsReviewRows += 1;
    }
  }

  const updatedBatch = await prisma.importBatch.update({
    where: {
      id: importBatch.id,
    },
    data: {
      importedRows,
      duplicatedRows,
    },
  });

  return {
    importBatchId: updatedBatch.id,
    totalRows: input.transactions.length,
    importedRows,
    duplicatedRows,
    needsReviewRows,
  };
}

function classifyOfxTransaction(transaction: ParsedOfxTransaction) {
  const memo = transaction.memo.toUpperCase();
  const trnType = transaction.trnType.toUpperCase();

  if (memo.includes("ENVIO PIX")) {
    return { direction: "expense" as const, paymentMethod: "account" as const };
  }

  if (memo.includes("CRED PIX") || memo.includes("CRED TEV")) {
    return { direction: "income" as const, paymentMethod: "account" as const };
  }

  if (memo.includes("COMPRA")) {
    return { direction: "expense" as const, paymentMethod: "debit" as const };
  }

  if (trnType === "CREDIT" || transaction.amount > 0) {
    return { direction: "income" as const, paymentMethod: "account" as const };
  }

  if (trnType === "DEBIT" || transaction.amount < 0) {
    return { direction: "expense" as const, paymentMethod: "account" as const };
  }

  return { direction: "neutral" as const, paymentMethod: "account" as const };
}

async function getReviewCategory() {
  return prisma.category.findUnique({
    where: {
      name: "A revisar",
    },
  });
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function cleanDescription(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
