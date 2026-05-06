import { Router } from "express";
import { prisma } from "../lib/database.js";
import { asyncHandler, serializeForJson } from "../lib/http.js";
import {
  applyCategoryRulesToTransactions,
  matchesCategoryRule,
} from "../services/categoryRuleService.js";
import type { MatchType, PaymentMethod } from "../generated/prisma/enums.js";

export const categoryRulesRouter = Router();

const matchTypes = ["contains", "starts_with", "equals", "regex"] as const;
const paymentMethods = ["credit", "debit", "account", "adjustment"] as const;

categoryRulesRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    const rules = await prisma.categoryRule.findMany({
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });

    response.json(serializeForJson(rules));
  }),
);

categoryRulesRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const data = parseRulePayload(request.body);

    if ("error" in data) {
      response.status(400).json(data.error);
      return;
    }

    const rule = await prisma.categoryRule.create({
      data: data.value as {
        pattern: string;
        matchType: MatchType;
        categoryId: string;
        descriptionClean?: string | null;
        paymentMethod?: PaymentMethod | null;
      },
      include: { category: true },
    });

    response.status(201).json(serializeForJson(rule));
  }),
);

categoryRulesRouter.patch(
  "/:id",
  asyncHandler(async (request, response) => {
    const data = parseRulePayload(request.body, true);

    if ("error" in data) {
      response.status(400).json(data.error);
      return;
    }

    const rule = await prisma.categoryRule.update({
      where: { id: String(request.params.id) },
      data: data.value,
      include: { category: true },
    });

    response.json(serializeForJson(rule));
  }),
);

categoryRulesRouter.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    await prisma.categoryRule.delete({
      where: { id: String(request.params.id) },
    });

    response.status(204).send();
  }),
);

categoryRulesRouter.post(
  "/apply-preview",
  asyncHandler(async (request, response) => {
    const transactionIds = parseTransactionIds(request.body);
    const matches = await applyCategoryRulesToTransactions(transactionIds);

    response.json(
      serializeForJson({
        totalMatches: matches.length,
        matches: matches.map(({ transaction, rule }) => ({
          transactionId: transaction.id,
          descriptionOriginal: transaction.descriptionOriginal,
          descriptionClean: transaction.descriptionClean,
          currentCategoryId: transaction.categoryId,
          suggestedCategoryId: rule.categoryId,
          suggestedCategoryName: rule.category.name,
          ruleId: rule.id,
          pattern: rule.pattern,
          matchType: rule.matchType,
        })),
      }),
    );
  }),
);

categoryRulesRouter.post(
  "/apply",
  asyncHandler(async (request, response) => {
    const transactionIds = parseTransactionIds(request.body);
    const matches = await applyCategoryRulesToTransactions(transactionIds);

    for (const { transaction, rule } of matches) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          categoryId: rule.categoryId,
          descriptionClean: rule.descriptionClean ?? transaction.descriptionClean,
          paymentMethod: rule.paymentMethod ?? transaction.paymentMethod,
          reviewStatus: "reviewed",
        },
      });
    }

    response.json({
      appliedCount: matches.length,
    });
  }),
);

function parseRulePayload(body: unknown, partial = false) {
  const input = body as Partial<{
    pattern: unknown;
    matchType: unknown;
    categoryId: unknown;
    descriptionClean: unknown;
    paymentMethod: unknown;
  }>;
  const value: {
    pattern?: string;
    matchType?: "contains" | "starts_with" | "equals" | "regex";
    categoryId?: string;
    descriptionClean?: string | null;
    paymentMethod?: "credit" | "debit" | "account" | "adjustment" | null;
  } = {};

  if (!partial || input.pattern !== undefined) {
    if (typeof input.pattern !== "string" || !input.pattern.trim()) {
      return { error: { error: "INVALID_PATTERN", message: "pattern é obrigatório." } };
    }

    value.pattern = input.pattern.trim();
  }

  if (!partial || input.matchType !== undefined) {
    if (!isOneOf(input.matchType, matchTypes)) {
      return { error: { error: "INVALID_MATCH_TYPE", message: "matchType inválido." } };
    }

    if (input.matchType === "regex" && typeof input.pattern === "string") {
      try {
        new RegExp(input.pattern);
      } catch {
        return { error: { error: "INVALID_REGEX", message: "Regex inválida." } };
      }
    }

    value.matchType = input.matchType;
  }

  if (!partial || input.categoryId !== undefined) {
    if (typeof input.categoryId !== "string" || !input.categoryId) {
      return { error: { error: "INVALID_CATEGORY", message: "categoryId é obrigatório." } };
    }

    value.categoryId = input.categoryId;
  }

  if (input.descriptionClean !== undefined) {
    value.descriptionClean =
      typeof input.descriptionClean === "string" && input.descriptionClean.trim()
        ? input.descriptionClean.trim()
        : null;
  }

  if (input.paymentMethod !== undefined) {
    if (input.paymentMethod === null || input.paymentMethod === "") {
      value.paymentMethod = null;
    } else if (isOneOf(input.paymentMethod, paymentMethods)) {
      value.paymentMethod = input.paymentMethod;
    } else {
      return {
        error: { error: "INVALID_PAYMENT_METHOD", message: "paymentMethod inválido." },
      };
    }
  }

  if (value.pattern && value.matchType) {
    matchesCategoryRule(
      { descriptionOriginal: "teste", descriptionClean: "teste" },
      { pattern: value.pattern, matchType: value.matchType, paymentMethod: null },
    );
  }

  return { value };
}

function parseTransactionIds(body: unknown) {
  const input = body as { transactionIds?: unknown };

  if (!Array.isArray(input.transactionIds)) {
    return undefined;
  }

  return input.transactionIds.filter((id): id is string => typeof id === "string");
}

function isOneOf<T extends readonly string[]>(
  value: unknown,
  candidates: T,
): value is T[number] {
  return typeof value === "string" && candidates.includes(value);
}
