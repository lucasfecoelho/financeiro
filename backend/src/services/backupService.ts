import { constants } from "node:fs";
import { access, copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { databaseUrl, resolveSqliteFilePath } from "../lib/database.js";

export type BackupFile = {
  name: string;
  date: string;
  size: number;
};

const backupsDirectory = "C:\\Financeiro\\backups";

export async function createDatabaseBackup() {
  const databasePath = resolveSqliteFilePath(databaseUrl);

  await access(databasePath, constants.R_OK);
  await mkdir(backupsDirectory, { recursive: true });

  const backupName = await getAvailableBackupName(new Date());
  const backupPath = join(backupsDirectory, backupName);

  await copyFile(databasePath, backupPath, constants.COPYFILE_EXCL);

  const metadata = await stat(backupPath);
  return {
    name: backupName,
    date: metadata.mtime.toISOString(),
    size: metadata.size,
  };
}

export async function listDatabaseBackups() {
  await mkdir(backupsDirectory, { recursive: true });

  const entries = await readdir(backupsDirectory, {
    withFileTypes: true,
  });

  const backups = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /^financas-backup-.*\.db$/i.test(entry.name))
      .map(async (entry) => {
        const metadata = await stat(join(backupsDirectory, entry.name));
        return {
          name: entry.name,
          date: metadata.mtime.toISOString(),
          size: metadata.size,
        };
      }),
  );

  return backups.sort((left, right) => right.date.localeCompare(left.date));
}

export function getBackupsDirectory() {
  return backupsDirectory;
}

async function getAvailableBackupName(date: Date) {
  const baseName = `financas-backup-${formatBackupTimestamp(date)}`;
  let candidate = `${baseName}.db`;
  let suffix = 1;

  while (await fileExists(join(backupsDirectory, candidate))) {
    suffix += 1;
    candidate = `${baseName}-${suffix}.db`;
  }

  return candidate;
}

async function fileExists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function formatBackupTimestamp(date: Date) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}-${hours}-${minutes}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
