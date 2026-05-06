import { prisma } from "../lib/database.js";
import type { ParsedOfxStatement, ParsedOfxTransaction } from "./ofxParser.js";
import { findOfxDuplicate } from "./duplicateService.js";
import { findMatchingRule } from "./categoryRuleService.js";
import { logImportStep } from "./importDiagnostics.js";
import { normalizeTransactionAmount } from "./transactionAmount.js";

export type OfxPreviewTransaction = {
  previewId: string;
  import: boolean;
  date: string;
  trnType: string;
  amount: number;
  fitId: string | null;
  externalId: string;
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
      const normalizedAmount = normalizeTransactionAmount(transaction.amount);
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
        externalId: transaction.externalId,
        amount: normalizedAmount,
        date: transaction.date,
      });
      const descriptionClean =
        ruleMatch?.descriptionClean ?? cleanDescription(transaction.memo);

      return {
        previewId: `${transaction.externalId}-${index}`,
        import: !duplicate,
        date: transaction.dateText,
        trnType: transaction.trnType,
        amount: normalizedAmount,
        fitId: transaction.fitId,
        externalId: transaction.externalId,
        memo: transaction.memo,
        direction: classification.direction,
        paymentMethod: classification.paymentMethod,
        reviewStatus: ruleMatch ? ("reviewed" as const) : ("needs_review" as const),
        categoryId: ruleMatch?.categoryId ?? reviewCategory?.id ?? null,
        categoryName: ruleMatch?.category.name ?? reviewCategory?.name ?? "A revisar",
        descriptionClean,
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
  let reviewedRows = 0;
  let duplicatedRows = 0;
  let skippedRows = 0;

  for (const transaction of input.transactions) {
    if (!transaction.import) {
      if (transaction.possibleDuplicate) {
        duplicatedRows += 1;
      } else {
        skippedRows += 1;
      }
      continue;
    }

    const date = parseDateOnly(transaction.date);
    const amount = normalizeTransactionAmount(transaction.amount);
    const externalId = getConfirmedExternalId(transaction);
    const duplicate = await findOfxDuplicate({
      bankCode: input.bankCode,
      accountId: input.accountId,
      externalId,
      amount,
      date,
    });

    if (duplicate) {
      duplicatedRows += 1;
      continue;
    }
    const reviewStatus = normalizeReviewStatus(transaction.reviewStatus);

    await prisma.transaction.create({
      data: {
        date,
        descriptionOriginal: transaction.memo,
        descriptionClean:
          cleanNullableText(transaction.descriptionClean) ??
          cleanDescription(transaction.memo),
        amount,
        direction: normalizeDirection(transaction.direction),
        paymentMethod: normalizePaymentMethod(transaction.paymentMethod),
        source: "ofx",
        categoryId: transaction.categoryId,
        reviewStatus,
        externalId,
        bankCode: input.bankCode,
        accountId: input.accountId,
        importBatchId: importBatch.id,
      },
    });
    importedRows += 1;
    if (reviewStatus === "needs_review") {
      needsReviewRows += 1;
    } else {
      reviewedRows += 1;
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

  logImportStep("ofx.confirm.persisted", {
    importBatchId: updatedBatch.id,
    totalRows: input.transactions.length,
    importedRows,
    duplicatedRows,
    skippedRows,
    needsReviewRows,
    reviewedRows,
  });

  return {
    importBatchId: updatedBatch.id,
    importType: "ofx" as const,
    totalRows: input.transactions.length,
    importedRows,
    duplicatedRows,
    needsReviewRows,
    reviewedRows,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    ...resolveImportPeriod(input.periodStart, input.periodEnd, input.transactions),
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

  if (trnType === "CREDIT") {
    return { direction: "income" as const, paymentMethod: "account" as const };
  }

  if (trnType === "DEBIT") {
    return { direction: "expense" as const, paymentMethod: "account" as const };
  }

  if (transaction.amount > 0) {
    return { direction: "income" as const, paymentMethod: "account" as const };
  }

  if (transaction.amount < 0) {
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
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Data de importacao OFX invalida: ${value}`);
  }

  return date;
}

function cleanDescription(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getConfirmedExternalId(transaction: OfxPreviewTransaction) {
  const externalId = cleanNullableText(transaction.externalId);

  if (externalId) {
    return externalId;
  }

  const fitId = cleanNullableText(transaction.fitId);
  if (fitId) {
    return fitId;
  }

  throw new Error("Transacao OFX sem identificador externo.");
}

function cleanNullableText(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeDirection(value: OfxPreviewTransaction["direction"]) {
  if (value === "income" || value === "expense" || value === "neutral") {
    return value;
  }

  return "neutral";
}

function normalizePaymentMethod(value: OfxPreviewTransaction["paymentMethod"]) {
  if (
    value === "credit" ||
    value === "debit" ||
    value === "account" ||
    value === "adjustment"
  ) {
    return value;
  }

  return "account";
}

function normalizeReviewStatus(value: OfxPreviewTransaction["reviewStatus"]) {
  if (value === "reviewed" || value === "needs_review") {
    return value;
  }

  return "needs_review";
}

function resolveImportPeriod(
  periodStart: string | null,
  periodEnd: string | null,
  transactions: OfxPreviewTransaction[],
) {
  const dateText =
    periodEnd ??
    periodStart ??
    transactions.find((transaction) => transaction.date)?.date ??
    null;

  if (!dateText) {
    return {
      month: null,
      year: null,
    };
  }

  const [year, month] = dateText.split("-").map(Number);

  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : null,
    year: Number.isInteger(year) ? year : null,
  };
}
