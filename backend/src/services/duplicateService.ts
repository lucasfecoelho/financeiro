import { prisma } from "../lib/database.js";
import { amountForLegacyComparison } from "./transactionAmount.js";

type DuplicateInput = {
  bankCode: string | null;
  accountId: string | null;
  fitId: string;
  amount: number;
  date: Date;
};

export async function findOfxDuplicate(input: DuplicateInput) {
  if (!input.bankCode || !input.accountId || !input.fitId) {
    return null;
  }

  return prisma.transaction.findFirst({
    where: {
      source: "ofx",
      bankCode: input.bankCode,
      accountId: input.accountId,
      externalId: input.fitId,
      amount: { in: amountForLegacyComparison(input.amount) },
      date: input.date,
    },
    select: {
      id: true,
    },
  });
}
