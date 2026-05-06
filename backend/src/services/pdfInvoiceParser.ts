import { PDFParse } from "pdf-parse";

export type ParsedPdfInvoiceTransaction = {
  date: string;
  descriptionOriginal: string;
  amount: number;
  section: "national" | "international";
  isFee: boolean;
  suggestedCategory: string;
};

export type ParsedPdfInvoice = {
  invoiceType: "proxima_fatura" | "fatura_anterior" | "unknown";
  totalFromFile: number | null;
  cardLastDigits: string | null;
  referenceMonth: number;
  referenceYear: number;
  nationalTransactions: ParsedPdfInvoiceTransaction[];
  internationalTransactions: ParsedPdfInvoiceTransaction[];
  fees: ParsedPdfInvoiceTransaction[];
};

const ignoredLinePatterns = [
  /^voltar$/i,
  /^data\s+descritivo\s+cr[eé]dito\s+d[eé]bito$/i,
  /^movimenta[cç][oõ]es/i,
  /^compras/i,
  /^total/i,
  /^p[aá]gina/i,
];

export async function parsePdfInvoice(buffer: Buffer): Promise<ParsedPdfInvoice> {
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  await parser.destroy();
  const text = normalizeText(parsed.text);

  if (!looksLikeCaixaInvoice(text)) {
    throw new Error(
      "Não consegui identificar este arquivo como fatura de cartão Caixa com texto selecionável.",
    );
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !ignoredLinePatterns.some((pattern) => pattern.test(line)));

  const invoiceType = detectInvoiceType(text);
  const cardLastDigits = detectCardLastDigits(text);
  const totalFromFile = detectTotal(text);
  const reference = detectReference(lines);
  const transactions = parseTransactionLines(lines, reference.year);

  if (transactions.length === 0) {
    throw new Error(
      "Não encontrei movimentações com data, descrição e valor. Se o PDF for imagem, será preciso revisão manual ou OCR em etapa futura.",
    );
  }

  return {
    invoiceType,
    totalFromFile,
    cardLastDigits,
    referenceMonth: reference.month,
    referenceYear: reference.year,
    nationalTransactions: transactions.filter(
      (transaction) => transaction.section === "national" && !transaction.isFee,
    ),
    internationalTransactions: transactions.filter(
      (transaction) => transaction.section === "international" && !transaction.isFee,
    ),
    fees: transactions.filter((transaction) => transaction.isFee),
  };
}

function parseTransactionLines(lines: string[], referenceYear: number) {
  let section: "national" | "international" = "national";
  const transactions: ParsedPdfInvoiceTransaction[] = [];

  for (const line of lines) {
    const upperLine = line.toUpperCase();

    if (upperLine.includes("INTERNACION")) {
      section = "international";
      continue;
    }

    if (upperLine.includes("NACIONAIS") || upperLine.includes("REAIS")) {
      section = "national";
    }

    const transaction = parseTransactionLine(line, section, referenceYear);

    if (transaction) {
      transactions.push(transaction);
    }
  }

  return transactions;
}

function parseTransactionLine(
  line: string,
  section: "national" | "international",
  referenceYear: number,
) {
  const match = line.match(
    /^(\d{2}\/\d{2})(?:\/(\d{2,4}))?\s+(.+?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})$/,
  );

  if (!match) {
    return null;
  }

  const [, dayMonth, explicitYear, description, amountText] = match;
  const amount = parseBrazilianAmount(amountText);
  const fullYear = explicitYear
    ? explicitYear.length === 2
      ? 2000 + Number(explicitYear)
      : Number(explicitYear)
    : referenceYear;
  const [day, month] = dayMonth.split("/").map(Number);
  const isFee = /IOF|TAXA|ENCARGO/i.test(description);

  return {
    date: `${fullYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    descriptionOriginal: description.trim(),
    amount: Math.abs(amount),
    section,
    isFee,
    suggestedCategory: suggestCategory(description),
  };
}

function looksLikeCaixaInvoice(text: string) {
  const upperText = text.toUpperCase();
  return (
    upperText.includes("CAIXA") &&
    (upperText.includes("FATURA") || upperText.includes("CARTAO") || upperText.includes("CARTÃO"))
  );
}

function detectInvoiceType(text: string): ParsedPdfInvoice["invoiceType"] {
  const upperText = text.toUpperCase();

  if (upperText.includes("PRÓXIMA FATURA") || upperText.includes("PROXIMA FATURA")) {
    return "proxima_fatura";
  }

  if (upperText.includes("FATURA ANTERIOR")) {
    return "fatura_anterior";
  }

  return "unknown";
}

function detectCardLastDigits(text: string) {
  const compactText = text.replace(/\s+/g, " ");
  const maskedMatch = compactText.match(/(\d{4,6}X{4,10}(\d{4}))/i);
  const endingMatch = compactText.match(/(?:final|cart[aã]o)\D{0,20}(\d{4})/i);
  return maskedMatch?.[2] ?? endingMatch?.[1] ?? null;
}

function detectTotal(text: string) {
  const match =
    text.match(/total\s+parcial[^\d-]*(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})/i) ??
    text.match(/total\s+da\s+fatura[^\d-]*(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})/i);

  return match ? parseBrazilianAmount(match[1]) : null;
}

function detectReference(lines: string[]) {
  const now = new Date();
  const transactionLine = lines.find((line) => /^\d{2}\/\d{2}/.test(line));
  const month = transactionLine ? Number(transactionLine.slice(3, 5)) : now.getMonth() + 1;
  return {
    month,
    year: now.getFullYear(),
  };
}

function parseBrazilianAmount(value: string) {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

function suggestCategory(description: string) {
  const normalized = description.toUpperCase();

  if (normalized.includes("IFood".toUpperCase()) || normalized.includes("BOBS")) {
    return "Alimentação";
  }

  if (normalized.includes("OPENAI") || normalized.includes("MICROSOFT")) {
    return "Assinaturas";
  }

  if (normalized.includes("IOF")) {
    return "Taxas";
  }

  if (normalized.includes("CEA") || normalized.includes("INDITEX")) {
    return "Vestuário";
  }

  if (normalized.includes("CENTAURO")) {
    return "Compras";
  }

  return "A revisar";
}

function normalizeText(text: string) {
  return text.replace(/\r/g, "\n").replace(/\n{2,}/g, "\n");
}
