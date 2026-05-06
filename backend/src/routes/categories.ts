import { Router } from "express";
import { prisma } from "../lib/database.js";
import { asyncHandler } from "../lib/http.js";

export const categoriesRouter = Router();

categoriesRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    const categories = await prisma.category.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    response.json(categories);
  }),
);
