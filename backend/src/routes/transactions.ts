import { Router } from "express";
import { prisma } from "../lib/database.js";
import { asyncHandler, serializeForJson } from "../lib/http.js";
import type {
  PaymentMethod,
  ReviewStatus,
  TransactionDirection,
  TransactionSource,
} from "../generated/prisma/enums.js";
import { normalizeTransactionAmount } from "../services/transactionAmount.js";

export const transactionsRouter = Router();

const validDirections = ["income", "expense", "neutral"] as const;
const validPaymentMethods = ["credit", "debit", "account", "adjustment"] as const;
const validSources = ["manual", "ofx", "pdf_invoice"] as const;
const validReviewStatuses = ["reviewed", "needs_review"] as const;

transactionsRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const where = buildTransactionWhere(request.query);

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
        importBatch: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            status: true,
          },
        },
        invoice: {
          select: {
            id: true,
            cardName: true,
            cardLastDigits: true,
            referenceMonth: true,
            referenceYear: true,
            status: true,
          },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 500,
    });

    response.json(serializeForJson(transactions));
  }),
);

transactionsRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const parsed = await parseManualTransactionInput(request.body);

    if (!parsed.ok) {
      response.status(400).json(parsed.error);
      return;
    }

    const transaction = await prisma.transaction.create({
      data: {
        date: parsed.data.date,
        descriptionOriginal: parsed.data.descriptionClean,
        descriptionClean: parsed.data.descriptionClean,
        amount: normalizeTransactionAmount(parsed.data.amount),
        direction: parsed.data.direction,
        paymentMethod: parsed.data.paymentMethod,
        source: "manual",
        categoryId: parsed.data.categoryId,
        reviewStatus: parsed.data.reviewStatus,
      },
      include: {
        category: true,
      },
    });

    response.status(201).json(serializeForJson(transaction));
  }),
);

transactionsRouter.patch(
  "/:id",
  asyncHandler(async (request, response) => {
    const id = String(request.params.id);
    const body = request.body as Partial<{
      date: unknown;
      descriptionClean: unknown;
      amount: unknown;
      categoryId: unknown;
      direction: unknown;
      paymentMethod: unknown;
      reviewStatus: unknown;
    }>;

    const data: {
      date?: Date;
      descriptionClean?: string;
      amount?: number;
      categoryId?: string | null;
      direction?: TransactionDirection;
      paymentMethod?: PaymentMethod;
      reviewStatus?: ReviewStatus;
    } = {};

    if (body.date !== undefined) {
      const parsedDate = parseDateOnly(body.date);
      if (!parsedDate) {
        response.status(400).json({
          error: "INVALID_DATE",
          message: "date deve ser uma data valida.",
        });
        return;
      }
      data.date = parsedDate;
    }

    if (body.descriptionClean !== undefined) {
      if (typeof body.descriptionClean !== "string") {
        response.status(400).json({
          error: "INVALID_DESCRIPTION",
          message: "descriptionClean deve ser uma string.",
        });
        return;
      }
      data.descriptionClean = body.descriptionClean.trim();
    }

    if (body.amount !== undefined) {
      const parsedAmount = Number(body.amount);
      if (!Number.isFinite(parsedAmount)) {
        response.status(400).json({
          error: "INVALID_AMOUNT",
          message: "amount deve ser um numero valido.",
        });
        return;
      }
      data.amount = normalizeTransactionAmount(parsedAmount);
    }

    if (body.categoryId !== undefined) {
      if (body.categoryId !== null && typeof body.categoryId !== "string") {
        response.status(400).json({
          error: "INVALID_CATEGORY",
          message: "categoryId deve ser string ou null.",
        });
        return;
      }
      data.categoryId = body.categoryId;
    }

    if (body.direction !== undefined) {
      if (!isOneOf(body.direction, validDirections)) {
        response.status(400).json({
          error: "INVALID_DIRECTION",
          message: "direction invalido.",
        });
        return;
      }
      data.direction = body.direction;
    }

    if (body.paymentMethod !== undefined) {
      if (!isOneOf(body.paymentMethod, validPaymentMethods)) {
        response.status(400).json({
          error: "INVALID_PAYMENT_METHOD",
          message: "paymentMethod invalido.",
        });
        return;
      }
      data.paymentMethod = body.paymentMethod;
    }

    if (body.reviewStatus !== undefined) {
      if (!isOneOf(body.reviewStatus, validReviewStatuses)) {
        response.status(400).json({
          error: "INVALID_REVIEW_STATUS",
          message: "reviewStatus invalido.",
        });
        return;
      }
      data.reviewStatus = body.reviewStatus;
    }

    if (data.amount !== undefined) {
      const currentTransaction = await prisma.transaction.findUnique({
        where: { id },
        select: {
          amount: true,
        },
      });

      if (!currentTransaction) {
        response.status(404).json({
          error: "TRANSACTION_NOT_FOUND",
          message: "Lancamento nao encontrado.",
        });
        return;
      }

      data.amount = normalizeTransactionAmount(
        data.amount ?? currentTransaction.amount.toNumber(),
      );
    }

    const transaction = await prisma.transaction.update({
      where: { id },
      data,
      include: {
        category: true,
      },
    });

    response.json(serializeForJson(transaction));
  }),
);

transactionsRouter.patch(
  "/:id/review",
  asyncHandler(async (request, response) => {
    const id = String(request.params.id);
    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        reviewStatus: "reviewed",
      },
      include: {
        category: true,
      },
    });

    response.json(serializeForJson(transaction));
  }),
);

transactionsRouter.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    const id = String(request.params.id);
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      select: {
        id: true,
        source: true,
      },
    });

    if (!transaction) {
      response.status(404).json({
        error: "TRANSACTION_NOT_FOUND",
        message: "Lancamento nao encontrado.",
      });
      return;
    }

    if (transaction.source !== "manual") {
      response.status(400).json({
        error: "ONLY_MANUAL_TRANSACTION_CAN_BE_DELETED",
        message: "Somente lancamentos manuais podem ser excluidos por esta rota.",
      });
      return;
    }

    await prisma.transaction.delete({
      where: { id },
    });

    response.status(204).send();
  }),
);

function buildTransactionWhere(query: Record<string, unknown>) {
  const where: {
    date?: { gte: Date; lt: Date };
    categoryId?: string;
    direction?: TransactionDirection;
    paymentMethod?: PaymentMethod;
    source?: TransactionSource;
    reviewStatus?: ReviewStatus;
  } = {};

  const month = toNumber(query.month);
  const year = toNumber(query.year);

  if (month && year && month >= 1 && month <= 12) {
    where.date = {
      gte: new Date(Date.UTC(year, month - 1, 1)),
      lt: new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1)),
    };
  }

  if (typeof query.categoryId === "string" && query.categoryId) {
    where.categoryId = query.categoryId;
  }

  if (isOneOf(query.direction, validDirections)) {
    where.direction = query.direction;
  }

  if (isOneOf(query.paymentMethod, validPaymentMethods)) {
    where.paymentMethod = query.paymentMethod;
  }

  if (isOneOf(query.source, validSources)) {
    where.source = query.source;
  }

  if (isOneOf(query.reviewStatus, validReviewStatuses)) {
    where.reviewStatus = query.reviewStatus;
  }

  return where;
}

async function parseManualTransactionInput(body: unknown): Promise<
  | {
      ok: true;
      data: {
        date: Date;
        descriptionClean: string;
        amount: number;
        direction: TransactionDirection;
        paymentMethod: PaymentMethod;
        categoryId: string | null;
        reviewStatus: ReviewStatus;
      };
    }
  | { ok: false; error: { error: string; message: string } }
> {
  const input = body as Partial<{
    date: unknown;
    descriptionClean: unknown;
    amount: unknown;
    direction: unknown;
    paymentMethod: unknown;
    categoryId: unknown;
    reviewStatus: unknown;
  }>;

  const date = parseDateOnly(input.date);
  if (!date) {
    return {
      ok: false,
      error: {
        error: "INVALID_DATE",
        message: "date deve ser uma data valida.",
      },
    };
  }

  if (typeof input.descriptionClean !== "string" || !input.descriptionClean.trim()) {
    return {
      ok: false,
      error: {
        error: "INVALID_DESCRIPTION",
        message: "descriptionClean e obrigatorio.",
      },
    };
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount)) {
    return {
      ok: false,
      error: {
        error: "INVALID_AMOUNT",
        message: "amount deve ser um numero valido.",
      },
    };
  }

  if (!isOneOf(input.direction, validDirections)) {
    return {
      ok: false,
      error: {
        error: "INVALID_DIRECTION",
        message: "direction invalido.",
      },
    };
  }

  if (!isOneOf(input.paymentMethod, validPaymentMethods)) {
    return {
      ok: false,
      error: {
        error: "INVALID_PAYMENT_METHOD",
        message: "paymentMethod invalido.",
      },
    };
  }

  if (input.categoryId !== null && input.categoryId !== undefined && typeof input.categoryId !== "string") {
    return {
      ok: false,
      error: {
        error: "INVALID_CATEGORY",
        message: "categoryId deve ser string ou null.",
      },
    };
  }

  let reviewStatus: ReviewStatus = "reviewed";
  if (input.reviewStatus !== undefined) {
    if (!isOneOf(input.reviewStatus, validReviewStatuses)) {
      return {
        ok: false,
        error: {
          error: "INVALID_REVIEW_STATUS",
          message: "reviewStatus invalido.",
        },
      };
    }
    reviewStatus = input.reviewStatus;
  }

  const categoryId = input.categoryId ?? null;
  if (categoryId) {
    const category = await prisma.category.findUnique({
      where: {
        id: categoryId,
      },
      select: {
        name: true,
      },
    });

    if (!category) {
      return {
        ok: false,
        error: {
          error: "CATEGORY_NOT_FOUND",
          message: "Categoria nao encontrada.",
        },
      };
    }

    if (category.name.toLowerCase() === "a revisar") {
      reviewStatus = "needs_review";
    }
  }

  return {
    ok: true,
    data: {
      date,
      descriptionClean: input.descriptionClean.trim(),
      amount: normalizeTransactionAmount(amount),
      direction: input.direction,
      paymentMethod: input.paymentMethod,
      categoryId,
      reviewStatus,
    },
  };
}

function parseDateOnly(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function toNumber(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function isOneOf<T extends readonly string[]>(
  value: unknown,
  candidates: T,
): value is T[number] {
  return typeof value === "string" && candidates.includes(value);
}
