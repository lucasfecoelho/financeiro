const selectedPeriodKey = "financas:selected-period";

export type SelectedPeriod = {
  month: string;
  year: string;
};

export function getCurrentPeriod(): SelectedPeriod {
  const currentDate = new Date();
  return {
    month: String(currentDate.getMonth() + 1),
    year: String(currentDate.getFullYear()),
  };
}

export function getSelectedPeriod(): SelectedPeriod {
  const fallback = getCurrentPeriod();
  const rawPeriod = window.localStorage.getItem(selectedPeriodKey);

  if (!rawPeriod) {
    return fallback;
  }

  try {
    const period = JSON.parse(rawPeriod) as Partial<SelectedPeriod>;
    return normalizePeriod(period.month, period.year) ?? fallback;
  } catch {
    return fallback;
  }
}

export function setSelectedPeriod(period: SelectedPeriod) {
  const normalizedPeriod = normalizePeriod(period.month, period.year);

  if (!normalizedPeriod) {
    return;
  }

  window.localStorage.setItem(selectedPeriodKey, JSON.stringify(normalizedPeriod));
}

export function updateSelectedPeriod(partialPeriod: Partial<SelectedPeriod>) {
  const currentPeriod = getSelectedPeriod();
  setSelectedPeriod({
    month: partialPeriod.month ?? currentPeriod.month,
    year: partialPeriod.year ?? currentPeriod.year,
  });
}

function normalizePeriod(month: unknown, year: unknown): SelectedPeriod | null {
  const monthNumber = Number(month);
  const yearNumber = Number(year);

  if (
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12 ||
    !Number.isInteger(yearNumber) ||
    yearNumber < 2000 ||
    yearNumber > 2100
  ) {
    return null;
  }

  return {
    month: String(monthNumber),
    year: String(yearNumber),
  };
}
