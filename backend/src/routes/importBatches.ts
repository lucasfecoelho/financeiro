import { Router } from "express";
import { prisma } from "../lib/database.js";
import { asyncHandler, serializeForJson } from "../lib/http.js";

export const importBatchesRouter = Router();

importBatchesRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    const batches = await prisma.importBatch.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 30,
      include: {
        _count: {
          select: {
            transactions: true,
          },
        },
      },
    });

    response.json(serializeForJson(batches));
  }),
);

