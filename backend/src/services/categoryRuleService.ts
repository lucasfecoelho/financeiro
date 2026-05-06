import { prisma } from "../lib/database.js";
import type { CategoryRule, Category, PaymentMethod } from "../generated/prisma/client.js";

export type CategoryRuleWithCategory = CategoryRule & {
  category: Category;
};

export type RuleTarget = {
  descriptionOriginal: string;
  descriptionClean?: string | null;
  paymentMethod?: PaymentMethod | null;
};

export function findMatchingRule(
  target: RuleTarget,
  rules: CategoryRuleWithCategory[],
) {
  return rules.find((rule) => matchesCategoryRule(target, rule)) ?? null;
}

export function matchesCategoryRule(
  target: RuleTarget,
  rule: Pick<CategoryRule, "pattern" | "matchType" | "paymentMethod">,
) {
  if (rule.paymentMethod && target.paymentMethod && rule.paymentMethod !== target.paymentMethod) {
    return false;
  }

  const values = [target.descriptionOriginal, target.descriptionClean]
    .filter(Boolean)
    .map((value) => String(value));

  return values.some((value) => matchesText(value, rule.pattern, rule.matchType));
}

export async function applyCategoryRulesToTransactions(transactionIds?: string[]) {
  const rules = await prisma.categoryRule.findMany({
    include: { category: true },
    orderBy: { createdAt: "asc" },
  });
  const transactions = await prisma.transaction.findMany({
    where: transactionIds ? { id: { in: transactionIds } } : { reviewStatus: "needs_review" },
  });
  const matches = transactions
    .map((transaction) => {
      const rule = findMatchingRule(
        {
          descriptionOriginal: transaction.descriptionOriginal,
          descriptionClean: transaction.descriptionClean,
          paymentMethod: transaction.paymentMethod,
        },
        rules,
      );

      return rule ? { transaction, rule } : null;
    })
    .filter(Boolean);

  return matches as Array<{
    transaction: (typeof transactions)[number];
    rule: CategoryRuleWithCategory;
  }>;
}

function matchesText(value: string, pattern: string, matchType: CategoryRule["matchType"]) {
  const normalizedValue = value.toUpperCase();
  const normalizedPattern = pattern.toUpperCase();

  if (matchType === "contains") {
    return normalizedValue.includes(normalizedPattern);
  }

  if (matchType === "starts_with") {
    return normalizedValue.startsWith(normalizedPattern);
  }

  if (matchType === "equals") {
    return normalizedValue === normalizedPattern;
  }

  try {
    return new RegExp(pattern, "i").test(value);
  } catch {
    return false;
  }
}
