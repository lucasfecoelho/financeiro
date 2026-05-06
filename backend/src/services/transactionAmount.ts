export function normalizeTransactionAmount(amount: number) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    throw new Error("Valor de transacao invalido.");
  }

  return Math.abs(numericAmount);
}

export function amountForLegacyComparison(amount: number) {
  const normalizedAmount = normalizeTransactionAmount(amount);
  return [normalizedAmount, -normalizedAmount];
}
