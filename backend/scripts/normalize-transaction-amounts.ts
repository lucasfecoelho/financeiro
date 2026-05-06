import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL ?? "file:C:/Financeiro/data/financas.db";
const adapter = new PrismaBetterSqlite3({
  url: databaseUrl,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const negativeTransactions = await prisma.transaction.findMany({
    where: {
      amount: {
        lt: 0,
      },
    },
    select: {
      id: true,
      amount: true,
      direction: true,
      source: true,
      descriptionOriginal: true,
    },
    orderBy: {
      date: "asc",
    },
  });

  console.log(`Transacoes com amount negativo encontradas: ${negativeTransactions.length}`);

  for (const transaction of negativeTransactions) {
    const previousAmount = Number(transaction.amount);
    const nextAmount = Math.abs(previousAmount);

    await prisma.transaction.update({
      where: {
        id: transaction.id,
      },
      data: {
        amount: nextAmount,
      },
    });

    console.log(
      [
        `Atualizada ${transaction.id}`,
        `source=${transaction.source}`,
        `direction=${transaction.direction}`,
        `amount ${previousAmount} -> ${nextAmount}`,
        `descricao="${transaction.descriptionOriginal}"`,
      ].join(" | "),
    );
  }
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
