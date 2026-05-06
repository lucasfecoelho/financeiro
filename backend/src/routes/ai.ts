import { Router } from "express";
import { prisma } from "../lib/database.js";
import { asyncHandler } from "../lib/http.js";
import type {
  PaymentMethod,
  TransactionDirection,
  TransactionSource,
} from "../generated/prisma/enums.js";
import {
  AiDisabledError,
  createStructuredAiResponse,
  getAiModel,
  isAiEnabled,
} from "../services/aiService.js";

export const aiRouter = Router();

const validDirections = ["income", "expense", "neutral"] as const;
const validPaymentMethods = ["credit", "debit", "account", "adjustment"] as const;
const validSources = ["manual", "ofx", "pdf_invoice"] as const;

type SuggestTransactionInput = {
  id?: string;
  descriptionOriginal: string;
  amount: number;
  direction: TransactionDirection;
  paymentMethod: PaymentMethod;
  source: TransactionSource;
};

aiRouter.get("/status", (_request, response) => {
  response.json({
    enabled: isAiEnabled(),
    model: isAiEnabled() ? getAiModel() : null,
    message: isAiEnabled()
      ? "IA assistiva disponivel."
      : "IA assistiva desativada. Configure OPENAI_API_KEY no backend.",
  });
});

aiRouter.post(
  "/suggest-transactions",
  asyncHandler(async (request, response) => {
    if (!isAiEnabled()) {
      response.status(503).json(disabledPayload());
      return;
    }

    const transactions = parseTransactions(request.body);
    if (!transactions.ok) {
      response.status(400).json(transactions.error);
      return;
    }

    const categories = await prisma.category.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    });

    const categoryNames = categories.map((category) => category.name);
    const result = await runAiRequest<{
      suggestions: Array<{
        transactionId: string | null;
        descriptionClean: string;
        category: string;
        confidence: number;
        explanation: string;
      }>;
    }>({
      system: buildTransactionSuggestionSystemPrompt(categoryNames),
      user: JSON.stringify({
        categories: categoryNames,
        transactions: transactions.data,
      }),
      format: buildTransactionSuggestionsSchema(categoryNames),
    });

    const categoriesByName = new Map(
      categories.map((category) => [category.name.toLowerCase(), category]),
    );
    const reviewCategory = categoriesByName.get("a revisar");

    const suggestions = result.suggestions.map((suggestion, index) => {
      const category =
        categoriesByName.get(suggestion.category.toLowerCase()) ?? reviewCategory ?? null;

      return {
        transactionId:
          suggestion.transactionId || transactions.data[index]?.id || null,
        descriptionClean: suggestion.descriptionClean,
        category: category?.name ?? "A revisar",
        categoryId: category?.id ?? null,
        confidence: clampConfidence(suggestion.confidence),
        explanation: suggestion.explanation,
      };
    });

    response.json({
      suggestions,
    });
  }),
);

aiRouter.post(
  "/monthly-summary",
  asyncHandler(async (request, response) => {
    if (!isAiEnabled()) {
      response.status(503).json(disabledPayload());
      return;
    }

    const body = request.body as {
      month?: unknown;
      year?: unknown;
      dashboard?: unknown;
    };
    const month = toNumber(body.month);
    const year = toNumber(body.year);

    if (!month || month < 1 || month > 12 || !year) {
      response.status(400).json({
        error: "INVALID_PERIOD",
        message: "month e year sao obrigatorios.",
      });
      return;
    }

    const dashboard = body.dashboard ?? (await buildDashboardPayload(month, year));
    const result = await runAiRequest<{
      summary: string;
      topExpenses: string[];
      alerts: string[];
    }>({
      system: buildMonthlySummarySystemPrompt(),
      user: JSON.stringify({
        month,
        year,
        dashboard,
      }),
      format: monthlySummarySchema,
    });

    response.json(result);
  }),
);

async function runAiRequest<T>(input: Parameters<typeof createStructuredAiResponse<T>>[0]) {
  try {
    return await createStructuredAiResponse<T>(input);
  } catch (error) {
    if (error instanceof AiDisabledError) {
      throw error;
    }

    throw error;
  }
}

function parseTransactions(body: unknown):
  | { ok: true; data: SuggestTransactionInput[] }
  | { ok: false; error: { error: string; message: string } } {
  const input = body as {
    transactions?: unknown;
  };

  if (!Array.isArray(input.transactions) || input.transactions.length === 0) {
    return {
      ok: false,
      error: {
        error: "INVALID_TRANSACTIONS",
        message: "Envie uma lista de lancamentos.",
      },
    };
  }

  const transactions: SuggestTransactionInput[] = [];

  for (const item of input.transactions.slice(0, 50)) {
    const transaction = item as Partial<Record<keyof SuggestTransactionInput, unknown>>;
    const amount = Number(transaction.amount);

    if (
      typeof transaction.descriptionOriginal !== "string" ||
      !Number.isFinite(amount) ||
      !isOneOf(transaction.direction, validDirections) ||
      !isOneOf(transaction.paymentMethod, validPaymentMethods) ||
      !isOneOf(transaction.source, validSources)
    ) {
      return {
        ok: false,
        error: {
          error: "INVALID_TRANSACTION",
          message: "Lancamento invalido para sugestao.",
        },
      };
    }

    transactions.push({
      id: typeof transaction.id === "string" ? transaction.id : undefined,
      descriptionOriginal: transaction.descriptionOriginal,
      amount,
      direction: transaction.direction,
      paymentMethod: transaction.paymentMethod,
      source: transaction.source,
    });
  }

  return {
    ok: true,
    data: transactions,
  };
}

async function buildDashboardPayload(month: number, year: number) {
  const dateRange = {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1)),
  };

  const transactions = await prisma.transaction.findMany({
    where: {
      date: dateRange,
    },
    include: {
      category: true,
    },
  });

  const totals = transactions.reduce(
    (accumulator, transaction) => {
      const amount = Math.abs(Number(transaction.amount));

      if (transaction.direction === "income") {
        accumulator.totalIncome += amount;
      }

      if (transaction.direction === "expense") {
        accumulator.totalExpense += amount;
        const categoryName = transaction.category?.name ?? "Sem categoria";
        accumulator.expensesByCategory.set(
          categoryName,
          (accumulator.expensesByCategory.get(categoryName) ?? 0) + amount,
        );
      }

      if (transaction.reviewStatus === "needs_review") {
        accumulator.needsReviewCount += 1;
      }

      return accumulator;
    },
    {
      totalIncome: 0,
      totalExpense: 0,
      needsReviewCount: 0,
      expensesByCategory: new Map<string, number>(),
    },
  );

  return {
    month,
    year,
    totalIncome: totals.totalIncome,
    totalExpense: totals.totalExpense,
    balanceEstimated: totals.totalIncome - totals.totalExpense,
    needsReviewCount: totals.needsReviewCount,
    expensesByCategory: Array.from(totals.expensesByCategory.entries())
      .map(([categoryName, total]) => ({ categoryName, total }))
      .sort((left, right) => right.total - left.total),
  };
}

function buildTransactionSuggestionSystemPrompt(categories: string[]) {
  return [
    "Voce e uma IA assistiva opcional para um app local de financas pessoais.",
    "Responda somente JSON valido no schema solicitado.",
    "Nao invente dados e nao use categorias fora da lista recebida.",
    `Categorias permitidas: ${categories.join(", ")}.`,
    'Se nao houver confianca, use categoria "A revisar".',
    "Seja conservadora. Nao trate transferencia como receita ou despesa sem confianca.",
    "Sugira descriptionClean curta, clara e em portugues quando fizer sentido.",
    "confidence deve ficar entre 0 e 1.",
    "explanation deve ser curta.",
  ].join("\n");
}

function buildMonthlySummarySystemPrompt() {
  return [
    "Voce cria um resumo mensal simples em portugues para um app local de financas pessoais.",
    "Use apenas os dados agregados enviados. Nao invente numeros.",
    "Nao faca aconselhamento financeiro complexo, investimentos ou previsoes.",
    "Aponte principais gastos e alertas simples de revisao, diferenca ou concentracao de despesas.",
    "Responda somente JSON valido no schema solicitado.",
  ].join("\n");
}

function buildTransactionSuggestionsSchema(categories: string[]) {
  return {
    type: "json_schema",
    name: "transaction_suggestions",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        suggestions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              transactionId: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
              descriptionClean: {
                type: "string",
              },
              category: {
                type: "string",
                enum: categories,
              },
              confidence: {
                type: "number",
              },
              explanation: {
                type: "string",
              },
            },
            required: [
              "transactionId",
              "descriptionClean",
              "category",
              "confidence",
              "explanation",
            ],
          },
        },
      },
      required: ["suggestions"],
    },
  } as const;
}

const monthlySummarySchema = {
  type: "json_schema",
  name: "monthly_summary",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: {
        type: "string",
      },
      topExpenses: {
        type: "array",
        items: {
          type: "string",
        },
      },
      alerts: {
        type: "array",
        items: {
          type: "string",
        },
      },
    },
    required: ["summary", "topExpenses", "alerts"],
  },
} as const;

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function disabledPayload() {
  return {
    error: "AI_DISABLED",
    message: "IA assistiva desativada. Configure OPENAI_API_KEY no backend para usar este recurso.",
  };
}

function toNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function isOneOf<T extends readonly string[]>(
  value: unknown,
  candidates: T,
): value is T[number] {
  return typeof value === "string" && candidates.includes(value);
}
