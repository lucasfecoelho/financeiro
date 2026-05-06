import { Router } from "express";
import { prisma } from "../lib/database.js";
import { asyncHandler, serializeForJson } from "../lib/http.js";
import type { InvoiceStatus } from "../generated/prisma/enums.js";

export const invoicesRouter = Router();

const validStatuses = ["open", "closed", "paid"] as const;

invoicesRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    const invoices = await prisma.invoice.findMany({
      include: invoiceInclude,
      orderBy: [{ referenceYear: "desc" }, { referenceMonth: "desc" }],
    });

    response.json(serializeForJson(invoices.map(buildInvoiceView)));
  }),
);

invoicesRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: String(request.params.id) },
      include: invoiceInclude,
    });

    if (!invoice) {
      response.status(404).json({
        error: "INVOICE_NOT_FOUND",
        message: "Fatura não encontrada.",
      });
      return;
    }

    response.json(serializeForJson(buildInvoiceView(invoice)));
  }),
);

invoicesRouter.patch(
  "/:id",
  asyncHandler(async (request, response) => {
    const body = request.body as Partial<{
      status: unknown;
      closingDay: unknown;
      dueDay: unknown;
      totalFromFile: unknown;
    }>;
    const data: {
      status?: InvoiceStatus;
      closingDay?: number;
      dueDay?: number;
      totalFromFile?: number | null;
    } = {};

    if (body.status !== undefined) {
      if (!isOneOf(body.status, validStatuses)) {
        response.status(400).json({
          error: "INVALID_INVOICE_STATUS",
          message: "Status da fatura inválido.",
        });
        return;
      }
      data.status = body.status;
    }

    if (body.closingDay !== undefined) {
      const closingDay = Number(body.closingDay);
      if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31) {
        response.status(400).json({
          error: "INVALID_CLOSING_DAY",
          message: "closingDay deve estar entre 1 e 31.",
        });
        return;
      }
      data.closingDay = closingDay;
    }

    if (body.dueDay !== undefined) {
      const dueDay = Number(body.dueDay);
      if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
        response.status(400).json({
          error: "INVALID_DUE_DAY",
          message: "dueDay deve estar entre 1 e 31.",
        });
        return;
      }
      data.dueDay = dueDay;
    }

    if (body.totalFromFile !== undefined) {
      data.totalFromFile =
        body.totalFromFile === null ? null : Number(body.totalFromFile);
    }

    const invoice = await prisma.invoice.update({
      where: { id: String(request.params.id) },
      data,
      include: invoiceInclude,
    });

    response.json(serializeForJson(buildInvoiceView(invoice)));
  }),
);

invoicesRouter.get(
  "/:id/summary",
  asyncHandler(async (request, response) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: String(request.params.id) },
      include: invoiceInclude,
    });

    if (!invoice) {
      response.status(404).json({
        error: "INVOICE_NOT_FOUND",
        message: "Fatura não encontrada.",
      });
      return;
    }

    const view = buildInvoiceView(invoice);
    response.json(
      serializeForJson({
        id: view.id,
        totalFromFile: view.totalFromFile,
        totalCalculated: view.totalCalculated,
        difference: view.difference,
        summaryByCategory: view.summaryByCategory,
        nationalTotal: view.nationalTotal,
        internationalTotal: view.internationalTotal,
        feesTotal: view.feesTotal,
      }),
    );
  }),
);

const invoiceInclude = {
  transactions: {
    include: {
      category: true,
    },
    orderBy: {
      date: "asc",
    },
  },
  _count: {
    select: {
      transactions: true,
    },
  },
} as const;

function buildInvoiceView(invoice: Awaited<ReturnType<typeof fetchInvoiceShape>>) {
  const transactions = invoice.transactions;
  const nationalTransactions = transactions.filter(
    (transaction) => classifyInvoiceTransaction(transaction) === "national",
  );
  const internationalTransactions = transactions.filter(
    (transaction) => classifyInvoiceTransaction(transaction) === "international",
  );
  const feeTransactions = transactions.filter(
    (transaction) => classifyInvoiceTransaction(transaction) === "fee",
  );
  const totalCalculated = sumTransactions(transactions);
  const totalFromFile = invoice.totalFromFile === null ? null : Number(invoice.totalFromFile);

  return {
    ...invoice,
    totalFromFile,
    totalCalculated,
    difference: totalFromFile === null ? null : totalFromFile - totalCalculated,
    summaryByCategory: buildSummaryByCategory(transactions),
    nationalTotal: sumTransactions(nationalTransactions),
    internationalTotal: sumTransactions(internationalTransactions),
    feesTotal: sumTransactions(feeTransactions),
  };
}

async function fetchInvoiceShape() {
  return prisma.invoice.findFirstOrThrow({
    include: invoiceInclude,
  });
}

function buildSummaryByCategory(
  transactions: Awaited<ReturnType<typeof fetchInvoiceShape>>["transactions"],
) {
  const summary = new Map<
    string,
    {
      categoryId: string | null;
      categoryName: string;
      total: number;
      count: number;
    }
  >();

  for (const transaction of transactions) {
    const key = transaction.categoryId ?? "uncategorized";
    const current = summary.get(key) ?? {
      categoryId: transaction.categoryId,
      categoryName: transaction.category?.name ?? "Sem categoria",
      total: 0,
      count: 0,
    };

    current.total += Math.abs(Number(transaction.amount));
    current.count += 1;
    summary.set(key, current);
  }

  return Array.from(summary.values()).sort((left, right) => right.total - left.total);
}

function classifyInvoiceTransaction(
  transaction: Awaited<ReturnType<typeof fetchInvoiceShape>>["transactions"][number],
) {
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

function sumTransactions(
  transactions: Awaited<ReturnType<typeof fetchInvoiceShape>>["transactions"],
) {
  return transactions.reduce(
    (total, transaction) => total + Math.abs(Number(transaction.amount)),
    0,
  );
}

function isOneOf<T extends readonly string[]>(
  value: unknown,
  candidates: T,
): value is T[number] {
  return typeof value === "string" && candidates.includes(value);
}
