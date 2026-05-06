import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import {
  createDatabaseBackup,
  getBackupsDirectory,
  listDatabaseBackups,
} from "../services/backupService.js";

export const backupsRouter = Router();

backupsRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    const backups = await listDatabaseBackups();
    response.json(backups);
  }),
);

backupsRouter.post(
  "/create",
  asyncHandler(async (_request, response) => {
    const backup = await createDatabaseBackup();
    response.status(201).json({
      ...backup,
      directory: getBackupsDirectory(),
    });
  }),
);
