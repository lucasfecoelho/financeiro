import { prisma } from "../lib/database.js";
import type { ParsedPdfInvoice, ParsedPdfInvoiceTransaction } from "./pdfInvoiceParser.js";
import { findMatchingRule } from "./categoryRuleService.js";
import { logImportStep } from "./importDiagnostics.js";
import {
  amountForLegacyComparison,
  normalizeTransactionAmount,
} from "./transactionAmount.js";

export type PdfInvoicePreviewTransaction = {
  previewId: string;
  import: boolean;
  date: string;
  descriptionOriginal: string;
  amount: number;
  section: "national" | "international";
  isFee: boolean;
  categoryId: string | null;
  categoryName: string;
  descriptionClean: string | null;
  reviewStatus: "reviewed" | "needs_review";
  suggestedCategory: string;
  possibleDuplicate: boolean;
};

export type PdfInvoicePreview = {
  fileName: string;
  invoiceType: "proxima_fatura" | "fatura_anterior" | "unknown";
  totalFromFile: number | null;
  totalCalculated: number;
  difference: number | null;
  cardLastDigits: string | null;
  referenceMonth: number;
  referenceYear: number;
  nationalTransactions: PdfInvoicePreviewTransaction[];
  internationalTransactions: PdfInvoicePreviewTransaction[];
  fees: PdfInvoicePreviewTransaction[];
};

export type ConfirmPdfInvoiceInput = PdfInvoicePreview & {
  transactions?: never;
};

export async function buildPdfInvoicePreview(
  fileName: string,
  parsedInvoice: ParsedPdfInvoice,
): Promise<PdfInvoicePreview> {
  const categories = await prisma.category.findMany();
  const rules = await prisma.categoryRule.findMany({
    include: { category: true },
    orderBy: { createdAt: "asc" },
  });
  const transactions = [
    ...parsedInvoice.nationalTransactions,
    ...parsedInvoice.internationalTransactions,
    ...parsedInvoice.fees,
  ];
  const previewRows = await Promise.all(
    transactions.map(async (transaction, index) =>
      buildPreviewTransaction(
        transaction,
        index,
        parsedInvoice.cardLastDigits,
        categories,
        rules,
      ),
    ),
  );
  const totalCalculated = sumAmounts(previewRows);

  return {
    fileName,
    invoiceType: parsedInvoice.invoiceType,
    totalFromFile: parsedInvoice.totalFromFile,
    totalCalculated,
    difference:
      parsedInvoice.totalFromFile === null ? null : parsedInvoice.totalFromFile - totalCalculated,
    cardLastDigits: parsedInvoice.cardLastDigits,
    referenceMonth: parsedInvoice.referenceMonth,
    referenceYear: parsedInvoice.referenceYear,
    nationalTransactions: previewRows.filter(
      (transaction) => transaction.section === "national" && !transaction.isFee,
    ),
    internationalTransactions: previewRows.filter(
      (transaction) => transaction.section === "international" && !transaction.isFee,
    ),
    fees: previewRows.filter((transaction) => transaction.isFee),
  };
}

export async function confirmPdfInvoiceImport(input: PdfInvoicePreview) {
  const allRows = [
    ...input.nationalTransactions,
    ...input.internationalTransactions,
    ...input.fees,
  ];
  const settings = await prisma.setting.findMany();
  const settingsMap = new Map(settings.map((setting) => [setting.key, setting.value]));
  const cardName = settingsMap.get("cardName") ?? "Caixa";
  const closingDay = Number(settingsMap.get("cardClosingDay") ?? 25);
  const dueDay = Number(settingsMap.get("cardDueDay") ?? 10);
  const existingInvoice = await prisma.invoice.findFirst({
    where: {
      cardName,
      cardLastDigits: input.cardLastDigits ?? "",
      referenceMonth: input.referenceMonth,
      referenceYear: input.referenceYear,
    },
  });
  const invoice =
    existingInvoice ??
    (await prisma.invoice.create({
      data: {
        cardName,
        cardLastDigits: input.cardLastDigits ?? "",
        referenceMonth: input.referenceMonth,
        referenceYear: input.referenceYear,
        closingDay,
        dueDay,
        status: "open",
        totalFromFile: input.totalFromFile,
        totalCalculated: 0,
      },
    }));
  const importBatch = await prisma.importBatch.create({
    data: {
      fileName: input.fileName,
      fileType: "pdf_invoice",
      detectedSource: "caixa_credit_card",
      status: "imported",
      totalRows: allRows.length,
      importedRows: 0,
      duplicatedRows: 0,
    },
  });

  let importedRows = 0;
  let duplicatedRows = 0;
  let needsReviewRows = 0;
  let reviewedRows = 0;
  let skippedRows = 0;

  for (const row of allRows) {
    if (!row.import) {
      if (row.possibleDuplicate) {
        duplicatedRows += 1;
      } else {
        skippedRows += 1;
      }
      continue;
    }

    if (row.possibleDuplicate) {
      duplicatedRows += 1;
      continue;
    }

    const duplicate = await findPdfInvoiceDuplicate({
      row,
      cardLastDigits: input.cardLastDigits,
      invoiceId: invoice.id,
    });

    if (duplicate) {
      duplicatedRows += 1;
      continue;
    }

    await prisma.transaction.create({
      data: {
        date: parseDateOnly(row.date),
        descriptionOriginal: row.descriptionOriginal,
        descriptionClean: row.descriptionClean ?? row.descriptionOriginal,
        amount: normalizeTransactionAmount(row.amount),
        direction: "expense",
        paymentMethod: "credit",
        source: "pdf_invoice",
        categoryId: row.categoryId,
        reviewStatus: row.reviewStatus,
        cardLastDigits: input.cardLastDigits,
        invoiceId: invoice.id,
        importBatchId: importBatch.id,
      },
    });
    importedRows += 1;
    if (row.reviewStatus === "needs_review") {
      needsReviewRows += 1;
    } else {
      reviewedRows += 1;
    }
  }

  const totalCalculated = await calculateInvoiceTotal(invoice.id);

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      totalFromFile: input.totalFromFile,
      totalCalculated,
    },
  });

  await prisma.importBatch.update({
    where: { id: importBatch.id },
    data: {
      importedRows,
      duplicatedRows,
    },
  });

  logImportStep("pdf.confirm.persisted", {
    importBatchId: importBatch.id,
    invoiceId: invoice.id,
    totalRows: allRows.length,
    importedRows,
    duplicatedRows,
    skippedRows,
    needsReviewRows,
    reviewedRows,
  });

  return {
    importBatchId: importBatch.id,
    importType: "pdf_invoice" as const,
    invoiceId: invoice.id,
    totalRows: allRows.length,
    importedRows,
    duplicatedRows,
    needsReviewRows,
    reviewedRows,
    periodStart: null,
    periodEnd: null,
    month: input.referenceMonth,
    year: input.referenceYear,
    totalFromFile: input.totalFromFile,
    totalCalculated,
    difference: input.totalFromFile === null ? null : input.totalFromFile - totalCalculated,
  };
}

async function buildPreviewTransaction(
  transaction: ParsedPdfInvoiceTransaction,
  index: number,
  cardLastDigits: string | null,
  categories: Awaited<ReturnType<typeof prisma.category.findMany>>,
  rules: Awaited<ReturnType<typeof prisma.categoryRule.findMany<{ include: { category: true } }>>>,
): Promise<PdfInvoicePreviewTransaction> {
  const ruleMatch = findMatchingRule(
    {
      descriptionOriginal: transaction.descriptionOriginal,
      descriptionClean: transaction.descriptionOriginal,
      paymentMethod: "credit",
    },
    rules,
  );
  const category =
    ruleMatch?.category ?? pickCategory(transaction.suggestedCategory, categories);
  const duplicate = await findPdfInvoiceDuplicate({
    row: {
      date: transaction.date,
      descriptionOriginal: transaction.descriptionOriginal,
      amount: transaction.amount,
    },
    cardLastDigits,
  });

  return {
    previewId: `${transaction.date}-${index}-${transaction.descriptionOriginal}`,
    import: !duplicate,
    date: transaction.date,
    descriptionOriginal: transaction.descriptionOriginal,
    amount: transaction.amount,
    section: transaction.section,
    isFee: transaction.isFee,
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? "A revisar",
    descriptionClean: ruleMatch?.descriptionClean ?? null,
    reviewStatus: ruleMatch ? "reviewed" : category?.name === "A revisar" ? "needs_review" : "reviewed",
    suggestedCategory: transaction.suggestedCategory,
    possibleDuplicate: Boolean(duplicate),
  };
}

async function findPdfInvoiceDuplicate({
  row,
  cardLastDigits,
  invoiceId,
}: {
  row: Pick<PdfInvoicePreviewTransaction, "date" | "descriptionOriginal" | "amount">;
  cardLastDigits: string | null;
  invoiceId?: string;
}) {
  if (!cardLastDigits) {
    return null;
  }

  const normalizedDescription = normalizeDescription(row.descriptionOriginal);
  const candidates = await prisma.transaction.findMany({
    where: {
      source: "pdf_invoice",
      cardLastDigits,
      date: parseDateOnly(row.date),
      amount: { in: amountForLegacyComparison(row.amount) },
      ...(invoiceId ? { invoiceId } : {}),
    },
    select: {
      id: true,
      descriptionOriginal: true,
    },
  });

  return (
    candidates.find((candidate) => {
      const candidateDescription = normalizeDescription(candidate.descriptionOriginal);
      return (
        candidateDescription === normalizedDescription ||
        candidateDescription.includes(normalizedDescription) ||
        normalizedDescription.includes(candidateDescription)
      );
    }) ?? null
  );
}

function pickCategory(
  categoryName: string,
  categories: Awaited<ReturnType<typeof prisma.category.findMany>>,
) {
  return (
    categories.find(
      (category) => category.name.toUpperCase() === categoryName.toUpperCase(),
    ) ??
    categories.find((category) => category.name === "A revisar") ??
    null
  );
}

async function calculateInvoiceTotal(invoiceId: string) {
  const transactions = await prisma.transaction.findMany({
    where: {
      invoiceId,
      source: "pdf_invoice",
    },
    select: {
      amount: true,
    },
  });

  return sumAmounts(transactions.map((transaction) => ({ amount: Number(transaction.amount) })));
}

function sumAmounts(rows: Array<{ amount: number }>) {
  return rows.reduce((total, row) => total + Math.abs(Number(row.amount)), 0);
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function normalizeDescription(value: string) {
  return value.toUpperCase().replace(/\s+/g, " ").trim();
}
