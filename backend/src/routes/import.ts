import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../lib/http.js";
import {
  buildOfxPreview,
  confirmOfxImport,
  type ConfirmOfxImportInput,
} from "../services/importService.js";
import { parseOfx } from "../services/ofxParser.js";
import {
  buildPdfInvoicePreview,
  confirmPdfInvoiceImport,
  type PdfInvoicePreview,
} from "../services/pdfInvoiceImportService.js";
import { parsePdfInvoice } from "../services/pdfInvoiceParser.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

export const importRouter = Router();

importRouter.post(
  "/ofx/preview",
  upload.single("file"),
  asyncHandler(async (request, response) => {
    if (!request.file) {
      response.status(400).json({
        error: "MISSING_FILE",
        message: "Envie um arquivo .ofx no campo file.",
      });
      return;
    }

    if (!request.file.originalname.toLowerCase().endsWith(".ofx")) {
      response.status(400).json({
        error: "INVALID_FILE_TYPE",
        message: "O arquivo deve ter extensao .ofx.",
      });
      return;
    }

    const content = request.file.buffer.toString("utf8");
    const statement = parseOfx(content);
    const preview = await buildOfxPreview(request.file.originalname, statement);

    response.json(preview);
  }),
);

importRouter.post(
  "/ofx/confirm",
  asyncHandler(async (request, response) => {
    const input = request.body as ConfirmOfxImportInput;

    if (!input.fileName || !Array.isArray(input.transactions)) {
      response.status(400).json({
        error: "INVALID_IMPORT_PAYLOAD",
        message: "Payload de confirmacao OFX invalido.",
      });
      return;
    }

    const result = await confirmOfxImport(input);
    response.json(result);
  }),
);

importRouter.post(
  "/pdf-invoice/preview",
  upload.single("file"),
  asyncHandler(async (request, response) => {
    if (!request.file) {
      response.status(400).json({
        error: "MISSING_FILE",
        message: "Envie um arquivo PDF no campo file.",
      });
      return;
    }

    if (!request.file.originalname.toLowerCase().endsWith(".pdf")) {
      response.status(400).json({
        error: "INVALID_FILE_TYPE",
        message: "O arquivo deve ter extensao .pdf.",
      });
      return;
    }

    const parsedInvoice = await parsePdfInvoice(request.file.buffer);
    const preview = await buildPdfInvoicePreview(
      request.file.originalname,
      parsedInvoice,
    );

    response.json(preview);
  }),
);

importRouter.post(
  "/pdf-invoice/confirm",
  asyncHandler(async (request, response) => {
    const input = request.body as PdfInvoicePreview;

    if (!input.fileName || !Array.isArray(input.nationalTransactions)) {
      response.status(400).json({
        error: "INVALID_IMPORT_PAYLOAD",
        message: "Payload de confirmacao da fatura invalido.",
      });
      return;
    }

    const result = await confirmPdfInvoiceImport(input);
    response.json(result);
  }),
);
