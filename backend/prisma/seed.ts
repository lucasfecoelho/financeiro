import "dotenv/config";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL ?? "file:C:/Financeiro/data/financas.db";

ensureSqliteDirectory(databaseUrl);

const adapter = new PrismaBetterSqlite3({
  url: databaseUrl,
});
const prisma = new PrismaClient({ adapter });

const categories = [
  { name: "Alimentação", type: "expense", color: "#67e8f9", icon: "utensils" },
  { name: "Mercado", type: "expense", color: "#86efac", icon: "shopping-bag" },
  { name: "Transporte", type: "expense", color: "#facc15", icon: "car" },
  { name: "Moradia", type: "expense", color: "#c4b5fd", icon: "home" },
  { name: "Saúde", type: "expense", color: "#fda4af", icon: "heart-pulse" },
  { name: "Educação", type: "expense", color: "#93c5fd", icon: "book-open" },
  { name: "Assinaturas", type: "expense", color: "#d8b4fe", icon: "repeat" },
  { name: "Compras", type: "expense", color: "#fdba74", icon: "shopping-cart" },
  { name: "Vestuário", type: "expense", color: "#f0abfc", icon: "shirt" },
  { name: "Lazer", type: "expense", color: "#5eead4", icon: "sparkles" },
  { name: "Serviços", type: "expense", color: "#cbd5e1", icon: "wrench" },
  { name: "Taxas", type: "expense", color: "#fb7185", icon: "receipt" },
  { name: "Outros", type: "neutral", color: "#a3a3a3", icon: "circle" },
  { name: "A revisar", type: "neutral", color: "#fbbf24", icon: "circle-alert" },
  { name: "Salário", type: "income", color: "#86efac", icon: "banknote" },
  { name: "Benefícios", type: "income", color: "#bef264", icon: "badge-check" },
  { name: "Reembolso", type: "income", color: "#6ee7b7", icon: "rotate-ccw" },
  { name: "Renda extra", type: "income", color: "#a7f3d0", icon: "plus-circle" },
  { name: "Transferência", type: "neutral", color: "#93c5fd", icon: "arrow-left-right" },
  { name: "Pagamento de fatura", type: "neutral", color: "#c4b5fd", icon: "credit-card" },
  { name: "Ajuste", type: "neutral", color: "#fde68a", icon: "sliders-horizontal" },
  { name: "Estorno", type: "income", color: "#99f6e4", icon: "undo-2" },
] as const;

const settings = [
  { key: "appName", value: "financas" },
  { key: "cardClosingDay", value: "25" },
  { key: "cardDueDay", value: "10" },
  { key: "cardName", value: "Caixa" },
  { key: "dataDirectory", value: "C:\\Financeiro" },
];

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {
        type: category.type,
        color: category.color,
        icon: category.icon,
        isDefault: true,
      },
      create: {
        ...category,
        isDefault: true,
      },
    });
  }

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }
}

function ensureSqliteDirectory(url: string) {
  if (!url.startsWith("file:")) {
    return;
  }

  const rawPath = url.slice("file:".length);
  const normalizedPath =
    rawPath.startsWith("/") || /^[A-Za-z]:\//.test(rawPath)
      ? rawPath
      : fileURLToPath(new URL(url));

  mkdirSync(dirname(normalizedPath), { recursive: true });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
