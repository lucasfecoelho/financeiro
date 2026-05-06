import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client.js";

const defaultDatabaseUrl = "file:C:/Financeiro/data/financas.db";
export const databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl;

process.env.DATABASE_URL = databaseUrl;
ensureSqliteDirectory(databaseUrl);

const adapter = new PrismaBetterSqlite3({
  url: databaseUrl,
});

export const prisma = new PrismaClient({ adapter });

function ensureSqliteDirectory(url: string) {
  if (!url.startsWith("file:")) {
    return;
  }

  const normalizedPath = resolveSqliteFilePath(url);
  mkdirSync(dirname(normalizedPath), { recursive: true });
}

export function resolveSqliteFilePath(url: string) {
  const rawPath = url.slice("file:".length);
  return (
    rawPath.startsWith("/") || /^[A-Za-z]:\//.test(rawPath)
      ? rawPath
      : fileURLToPath(new URL(url))
  );
}
