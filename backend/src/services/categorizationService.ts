import type { Category, CategoryRule, PaymentMethod, TransactionSource } from "../generated/prisma/client.js";
import { findMatchingRule } from "./categoryRuleService.js";

export type CategorizationRule = CategoryRule & {
  category: Category;
};

export type CategorizationInput = {
  descriptionOriginal: string;
  descriptionClean?: string | null;
  amount: number;
  direction: "income" | "expense" | "neutral";
  paymentMethod: PaymentMethod;
  source: TransactionSource;
  isFee?: boolean;
};

export type CategorizationResult = {
  categoryId: string | null;
  categoryName: string;
  reviewStatus: "reviewed" | "needs_review";
  confidence: "high" | "medium" | "low";
  reason: string;
  source: "user_rule" | "heuristic" | "needs_review";
  descriptionClean: string;
};

type Heuristic = {
  categoryName: string;
  keywords: string[];
  reason: string;
  confidence?: CategorizationResult["confidence"];
};

const reviewCategoryName = "A revisar";

const genericDescriptions = new Set([
  "COMPRA",
  "ENVIO PIX",
  "CRED PIX",
  "CRED TEV",
  "TEV",
  "PIX",
  "PAGAMENTO",
]);

const transferHeuristics: Heuristic[] = [
  {
    categoryName: "Pagamento de fatura",
    keywords: ["PAGAMENTO FATURA", "PAGTO FATURA", "PAGAMENTO CARTAO", "PAGAMENTO CARTÃO"],
    reason: "pagamento de fatura identificado",
    confidence: "high",
  },
  {
    categoryName: "Transferência",
    keywords: ["TRANSFERENCIA ENTRE CONTAS", "TRANSFERÊNCIA ENTRE CONTAS", "RESGATE", "APLICACAO", "APLICAÇÃO"],
    reason: "movimento entre contas identificado",
    confidence: "high",
  },
];

const incomeHeuristics: Heuristic[] = [
  {
    categoryName: "Salário",
    keywords: ["SALARIO", "SALÁRIO", "FOLHA PAGAMENTO", "PAGAMENTO SALARIAL"],
    reason: "receita recorrente identificada",
    confidence: "high",
  },
  {
    categoryName: "Reembolso",
    keywords: ["REEMBOLSO", "ESTORNO", "DEVOLUCAO", "DEVOLUÇÃO"],
    reason: "reembolso ou devolução identificado",
    confidence: "high",
  },
  {
    categoryName: "Renda extra",
    keywords: ["TED RECEBIDA", "TRANSF RECEBIDA", "TRANSFERENCIA RECEBIDA", "TRANSFERÊNCIA RECEBIDA"],
    reason: "receita recebida identificada",
    confidence: "medium",
  },
];

const expenseHeuristics: Heuristic[] = [
  {
    categoryName: "Alimentação",
    keywords: [
      "IFOOD",
      "BOBS",
      "MCDONALD",
      "BURGER",
      "RESTAURANTE",
      "LANCHONETE",
      "PADARIA",
      "CAFE",
      "CAFÉ",
      "PIZZARIA",
    ],
    reason: "estabelecimento de alimentação identificado",
  },
  {
    categoryName: "Compras",
    keywords: ["AMAZON", "MERCADO LIVRE", "MERCADOLIVRE", "SHOPEE"],
    reason: "compra em marketplace identificada",
  },
  {
    categoryName: "Mercado",
    keywords: [
      "MERCADO",
      "SUPERMERCADO",
      "ATACADAO",
      "ATACADÃO",
      "ASSAI",
      "ASSAÍ",
      "CARREFOUR",
      "EXTRA",
      "PÃO DE AÇÚCAR",
      "PAO DE ACUCAR",
    ],
    reason: "mercado ou supermercado identificado",
  },
  {
    categoryName: "Transporte",
    keywords: [
      "UBER",
      " 99 ",
      "TAXI",
      "TÁXI",
      "METRO",
      "METRÔ",
      "BILHETE",
      "ESTACIONAMENTO",
      "PARKING",
      "POSTO",
      "COMBUSTIVEL",
      "COMBUSTÍVEL",
      "GASOLINA",
    ],
    reason: "transporte ou combustível identificado",
  },
  {
    categoryName: "Assinaturas",
    keywords: [
      "OPENAI",
      "CHATGPT",
      "MICROSOFT",
      "GOOGLE",
      "APPLE",
      "SPOTIFY",
      "NETFLIX",
      "AMAZON PRIME",
      "DISNEY",
      "HBO",
      " MAX ",
    ],
    reason: "assinatura ou software identificado",
  },
  {
    categoryName: "Vestuário",
    keywords: ["CEA", "C&A", "RENNER", "RIACHUELO", "ZARA", "INDITEX", "SHEIN", "CENTAURO"],
    reason: "loja de vestuário identificada",
  },
  {
    categoryName: "Saúde",
    keywords: [
      "FARMACIA",
      "FARMÁCIA",
      "DROGARIA",
      "DROGA",
      "PANVEL",
      "RAIA",
      "PAGUE MENOS",
      "LABORATORIO",
      "LABORATÓRIO",
      "CLINICA",
      "CLÍNICA",
    ],
    reason: "saúde ou farmácia identificada",
  },
  {
    categoryName: "Taxas",
    keywords: ["IOF", "TARIFA", "TAXA", "ENCARGO", "JUROS"],
    reason: "taxa ou encargo identificado",
  },
];

export function categorizeTransaction({
  input,
  categories,
  rules,
}: {
  input: CategorizationInput;
  categories: Category[];
  rules: CategorizationRule[];
}): CategorizationResult {
  const descriptionClean = cleanDescription(input.descriptionClean ?? input.descriptionOriginal);
  const ruleMatch = findMatchingRule(
    {
      descriptionOriginal: input.descriptionOriginal,
      descriptionClean,
      paymentMethod: input.paymentMethod,
    },
    rules,
  );

  if (ruleMatch) {
    return {
      categoryId: ruleMatch.categoryId,
      categoryName: ruleMatch.category.name,
      reviewStatus: "reviewed",
      confidence: "high",
      reason: "regra criada por você",
      source: "user_rule",
      descriptionClean: ruleMatch.descriptionClean ?? descriptionClean,
    };
  }

  const normalizedDescription = normalizeText(descriptionClean);
  const paddedDescription = ` ${normalizedDescription} `;
  const reviewCategory = findCategory(reviewCategoryName, categories);

  if (isGenericDescription(normalizedDescription)) {
    return needsReview(reviewCategory, descriptionClean, "descrição genérica");
  }

  if (input.isFee) {
    const feeCategory = findCategory("Taxas", categories);
    return categoryResult(feeCategory, reviewCategory, descriptionClean, {
      reason: "taxa da fatura identificada",
      confidence: "high",
    });
  }

  const transferMatch = findHeuristic(paddedDescription, transferHeuristics);
  if (transferMatch) {
    const category = findCategory(transferMatch.categoryName, categories);
    return categoryResult(category, reviewCategory, descriptionClean, transferMatch);
  }

  if (input.direction === "income") {
    const incomeMatch = findHeuristic(paddedDescription, incomeHeuristics);

    if (incomeMatch) {
      const category = findCategory(incomeMatch.categoryName, categories);
      return categoryResult(category, reviewCategory, descriptionClean, incomeMatch);
    }

    return needsReview(reviewCategory, descriptionClean, "receita sem contexto suficiente");
  }

  const expenseMatch = findHeuristic(paddedDescription, expenseHeuristics);
  if (expenseMatch) {
    const category = findCategory(expenseMatch.categoryName, categories);
    return categoryResult(category, reviewCategory, descriptionClean, expenseMatch);
  }

  return needsReview(reviewCategory, descriptionClean, "sem regra segura");
}

function categoryResult(
  category: Category | null,
  reviewCategory: Category | null,
  descriptionClean: string,
  heuristic: Pick<Heuristic, "reason" | "confidence">,
): CategorizationResult {
  if (!category || category.name === reviewCategoryName) {
    return needsReview(reviewCategory, descriptionClean, "categoria não encontrada");
  }

  return {
    categoryId: category.id,
    categoryName: category.name,
    reviewStatus: "reviewed",
    confidence: heuristic.confidence ?? "medium",
    reason: heuristic.reason,
    source: "heuristic",
    descriptionClean,
  };
}

function needsReview(
  reviewCategory: Category | null,
  descriptionClean: string,
  reason: string,
): CategorizationResult {
  return {
    categoryId: reviewCategory?.id ?? null,
    categoryName: reviewCategory?.name ?? reviewCategoryName,
    reviewStatus: "needs_review",
    confidence: "low",
    reason,
    source: "needs_review",
    descriptionClean,
  };
}

function findCategory(name: string, categories: Category[]) {
  const normalizedName = normalizeText(name);
  return categories.find((category) => normalizeText(category.name) === normalizedName) ?? null;
}

function findHeuristic(description: string, heuristics: Heuristic[]) {
  return (
    heuristics.find((heuristic) =>
      heuristic.keywords.some((keyword) => description.includes(` ${normalizeText(keyword)} `)),
    ) ?? null
  );
}

function isGenericDescription(description: string) {
  const compactDescription = description.replace(/\s+/g, " ").trim();
  return (
    genericDescriptions.has(compactDescription) ||
    Array.from(genericDescriptions).some((generic) => compactDescription === `COMPRA ${generic}`)
  );
}

function cleanDescription(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
