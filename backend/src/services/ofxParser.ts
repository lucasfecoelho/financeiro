export type ParsedOfxTransaction = {
  date: Date;
  dateText: string;
  trnType: string;
  amount: number;
  fitId: string;
  memo: string;
};

export type ParsedOfxStatement = {
  bankCode: string | null;
  accountId: string | null;
  accountType: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  transactions: ParsedOfxTransaction[];
};

export function parseOfx(content: string): ParsedOfxStatement {
  const body = stripHeaders(content);
  const accountSection = getSection(body, "BANKACCTFROM") ?? body;
  const transactionSection = getSection(body, "BANKTRANLIST") ?? body;

  const transactions = getSections(transactionSection, "STMTTRN").map(
    (transactionContent, index) => {
      const dateRaw = getTagValue(transactionContent, "DTPOSTED");
      const amountRaw = getTagValue(transactionContent, "TRNAMT");
      const fitId = getTagValue(transactionContent, "FITID") ?? `ofx-row-${index + 1}`;
      const memo = getTagValue(transactionContent, "MEMO") ?? "";
      const trnType = getTagValue(transactionContent, "TRNTYPE") ?? "OTHER";
      const date = parseOfxDate(dateRaw);

      return {
        date,
        dateText: toDateOnly(date),
        trnType: cleanText(trnType).toUpperCase(),
        amount: parseAmount(amountRaw),
        fitId: cleanText(fitId),
        memo: cleanText(memo),
      };
    },
  );

  return {
    bankCode: cleanNullable(getTagValue(accountSection, "BANKID")),
    accountId: cleanNullable(getTagValue(accountSection, "ACCTID")),
    accountType: cleanNullable(getTagValue(accountSection, "ACCTTYPE")),
    periodStart: toDateOnlyOrNull(getTagValue(transactionSection, "DTSTART")),
    periodEnd: toDateOnlyOrNull(getTagValue(transactionSection, "DTEND")),
    transactions,
  };
}

function stripHeaders(content: string) {
  const ofxIndex = content.search(/<OFX>/i);
  return ofxIndex >= 0 ? content.slice(ofxIndex) : content;
}

function getSection(content: string, tag: string) {
  const regex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  return regex.exec(content)?.[1] ?? null;
}

function getSections(content: string, tag: string) {
  const regex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  return Array.from(content.matchAll(regex), (match) => match[1] ?? "");
}

function getTagValue(content: string, tag: string) {
  const regex = new RegExp(`<${tag}\\b[^>]*>\\s*([^<\\r\\n]*)`, "i");
  const value = regex.exec(content)?.[1];
  return value ? cleanText(value) : null;
}

function parseOfxDate(value: string | null) {
  if (!value) {
    throw new Error("Transacao OFX sem data.");
  }

  const match = value.match(/(\d{4})(\d{2})(\d{2})/);

  if (!match) {
    throw new Error(`Data OFX invalida: ${value}`);
  }

  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
}

function parseAmount(value: string | null) {
  if (!value) {
    throw new Error("Transacao OFX sem valor.");
  }

  const normalized = value.replace(",", ".").trim();
  const amount = Number(normalized);

  if (!Number.isFinite(amount)) {
    throw new Error(`Valor OFX invalido: ${value}`);
  }

  return amount;
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toDateOnlyOrNull(value: string | null) {
  return value ? toDateOnly(parseOfxDate(value)) : null;
}

function cleanNullable(value: string | null) {
  return value ? cleanText(value) : null;
}

function cleanText(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}
