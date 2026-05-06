import { Router } from "express";
import { prisma } from "../lib/database.js";
import { asyncHandler } from "../lib/http.js";

export const settingsRouter = Router();

settingsRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    const settings = await prisma.setting.findMany({
      orderBy: { key: "asc" },
    });

    response.json(settings);
  }),
);

settingsRouter.patch(
  "/:key",
  asyncHandler(async (request, response) => {
    const key = String(request.params.key);
    const { value } = request.body as { value?: unknown };

    if (typeof value !== "string") {
      response.status(400).json({
        error: "INVALID_SETTING_VALUE",
        message: "O campo value deve ser uma string.",
      });
      return;
    }

    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    response.json(setting);
  }),
);
