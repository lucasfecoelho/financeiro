import { prisma } from "../lib/database.js";

type DuplicateInput = {
  bankCode: string | null;
  accountId: string | null;
  externalId: string | null;
  fitId?: string | null;
  amount: number;
  date: Date;
};

export async function findOfxDuplicate(input: DuplicateInput) {
  const externalId = input.externalId ?? input.fitId ?? null;

  if (!input.bankCode || !input.accountId || !externalId) {
    return null;
  }

  return prisma.transaction.findFirst({
    where: {
      source: "ofx",
      bankCode: input.bankCode,
      accountId: input.accountId,
      externalId,
    },
    select: {
      id: true,
    },
  });
}
