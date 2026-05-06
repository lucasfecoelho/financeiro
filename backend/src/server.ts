import "dotenv/config";
import cors from "cors";
import express from "express";
import { aiRouter } from "./routes/ai.js";
import { backupsRouter } from "./routes/backups.js";
import { categoriesRouter } from "./routes/categories.js";
import { categoryRulesRouter } from "./routes/categoryRules.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { importBatchesRouter } from "./routes/importBatches.js";
import { importRouter } from "./routes/import.js";
import { invoicesRouter } from "./routes/invoices.js";
import { settingsRouter } from "./routes/settings.js";
import { transactionsRouter } from "./routes/transactions.js";

const app = express();
const port = Number(process.env.PORT ?? 3333);
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

app.use(
  cors({
    origin: [frontendUrl, "http://127.0.0.1:5173"],
  }),
);
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    app: "financas",
  });
});

app.use("/api/ai", aiRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/backups", backupsRouter);
app.use("/api/category-rules", categoryRulesRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/import", importRouter);
app.use("/api/import-batches", importBatchesRouter);

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error);
    response.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Erro interno no backend.",
    });
  },
);

app.listen(port, () => {
  console.log(`financas backend listening on http://localhost:${port}`);
});
