import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CreditCard, FileClock, FolderUp, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { ErrorBlock, LoadingBlock } from "@/components/StateBlocks";
import { StatusPill } from "@/components/StatusPill";
import { useApiQuery } from "@/hooks/useApiQuery";
import { api } from "@/lib/api";
import type {
  ApiCategory,
  ApiOfxConfirmResult,
  ApiOfxPreview,
  ApiOfxPreviewTransaction,
  ApiPdfInvoiceConfirmResult,
  ApiPdfInvoicePreview,
  ApiPdfInvoicePreviewTransaction,
} from "@/lib/apiTypes";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PageId } from "@/types";

type ImportMode = "ofx" | "pdf";

function getInitialImportMode(): ImportMode {
  const requestedMode = window.sessionStorage.getItem("financas:import-mode");
  window.sessionStorage.removeItem("financas:import-mode");
  return requestedMode === "pdf" ? "pdf" : "ofx";
}

export function ImportPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<ImportMode>(getInitialImportMode);
  const [ofxPreview, setOfxPreview] = useState<ApiOfxPreview | null>(null);
  const [pdfPreview, setPdfPreview] = useState<ApiPdfInvoicePreview | null>(null);
  const [result, setResult] = useState<
    ApiOfxConfirmResult | ApiPdfInvoiceConfirmResult | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const { data: categories } = useApiQuery(api.categories);

  const currentPreview = mode === "ofx" ? ofxPreview : pdfPreview;

  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  async function handleFile(file: File | null) {
    if (!file) {
      return;
    }

    setError(null);
    setResult(null);
    setOfxPreview(null);
    setPdfPreview(null);
    setIsPreviewing(true);

    try {
      if (mode === "ofx") {
        setOfxPreview(await api.previewOfx(file));
      } else {
        setPdfPreview(await api.previewPdfInvoice(file));
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível ler o arquivo.",
      );
    } finally {
      setIsPreviewing(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function confirmImport() {
    setError(null);
    setResult(null);
    setIsConfirming(true);

    try {
      if (mode === "ofx" && ofxPreview) {
        const importResult = await api.confirmOfx(ofxPreview);
        setResult(importResult);
      }

      if (mode === "pdf" && pdfPreview) {
        const importResult = await api.confirmPdfInvoice(pdfPreview);
        setResult(importResult);
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível confirmar a importação.",
      );
    } finally {
      setIsConfirming(false);
    }
  }

  function resetCurrentImport() {
    setError(null);
    setResult(null);
    setOfxPreview(null);
    setPdfPreview(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function resetForMode(nextMode: ImportMode) {
    setMode(nextMode);
    setError(null);
    setResult(null);
    setOfxPreview(null);
    setPdfPreview(null);
  }

  return (
    <div>
      <PageHeader
        eyebrow="importação"
        title="Importe conta e fatura com prévia."
        description="OFX da conta Caixa e PDF da fatura do cartão passam por prévia antes de qualquer gravação no SQLite."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <ImportCard
          active={mode === "ofx"}
          title="OFX da conta Caixa"
          description="Receitas, despesas no débito, PIX, TEV e lançamentos da conta."
          icon={FileClock}
          status="ativo"
          onClick={() => resetForMode("ofx")}
        />
        <ImportCard
          active={mode === "pdf"}
          title="PDF da fatura Caixa"
          description="Compras nacionais, internacionais, IOF e total da fatura."
          icon={CreditCard}
          status="ativo"
          onClick={() => resetForMode("pdf")}
        />
      </div>

      <Panel
        title={mode === "ofx" ? "Selecionar arquivo OFX" : "Selecionar PDF da fatura"}
        description={
          mode === "ofx"
            ? "A prévia do OFX não grava lançamentos no banco."
            : "O PDF precisa ter texto selecionável; OCR fica para uma etapa futura."
        }
        className="mt-6"
      >
        <input
          ref={inputRef}
          type="file"
          accept={mode === "ofx" ? ".ofx" : ".pdf"}
          className="hidden"
          onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
        />

        <div
          className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-primary/30 bg-secondary/25 px-6 py-10 text-center"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void handleFile(event.dataTransfer.files?.[0] ?? null);
          }}
        >
          <div className="flex size-14 items-center justify-center rounded-lg border border-border bg-card text-primary">
            <UploadCloud className="size-7" aria-hidden="true" />
          </div>
          <h2 className="mt-5 text-xl font-semibold">
            Arraste um {mode === "ofx" ? "OFX" : "PDF"} aqui
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Você poderá revisar e desmarcar lançamentos antes de confirmar.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            <FolderUp className="size-4" aria-hidden="true" />
            Selecionar {mode === "ofx" ? "OFX" : "PDF"}
          </button>
        </div>
      </Panel>

      {isPreviewing && (
        <Panel className="mt-6">
          <LoadingBlock label="Lendo arquivo e preparando prévia..." />
        </Panel>
      )}

      {error && (
        <Panel className="mt-6">
          <ErrorBlock message={error} />
        </Panel>
      )}

      {currentPreview && result && (
        <div ref={resultRef}>
          <ImportResultPanel
            result={result}
            mode={mode}
            onNavigate={navigateToPage}
            onReset={resetCurrentImport}
          />
        </div>
      )}

      {ofxPreview && mode === "ofx" && (
        <OfxPreviewPanel
          categories={categories ?? []}
          preview={ofxPreview}
          isConfirming={isConfirming}
          isConfirmed={Boolean(result)}
          onChange={setOfxPreview}
          onConfirm={() => void confirmImport()}
        />
      )}

      {pdfPreview && mode === "pdf" && (
        <PdfPreviewPanel
          categories={categories ?? []}
          preview={pdfPreview}
          isConfirming={isConfirming}
          isConfirmed={Boolean(result)}
          onChange={setPdfPreview}
          onConfirm={() => void confirmImport()}
        />
      )}

    </div>
  );
}

function navigateToPage(page: PageId) {
  window.dispatchEvent(new CustomEvent("financas:navigate", { detail: { page } }));
}

function ImportResultPanel({
  result,
  mode,
  onNavigate,
  onReset,
}: {
  result: ApiOfxConfirmResult | ApiPdfInvoiceConfirmResult;
  mode: ImportMode;
  onNavigate: (page: PageId) => void;
  onReset: () => void;
}) {
  const needsReviewRows = "needsReviewRows" in result ? result.needsReviewRows : 0;
  const allRowsAreDuplicates =
    result.totalRows > 0 &&
    result.importedRows === 0 &&
    result.duplicatedRows === result.totalRows;
  const nothingImported =
    result.totalRows > 0 && result.importedRows === 0 && !allRowsAreDuplicates;
  const title = allRowsAreDuplicates
    ? "Todos os lançamentos parecem já ter sido importados."
    : nothingImported
      ? "Nenhum lançamento novo foi importado."
      : "Importação concluída";
  const description = allRowsAreDuplicates
    ? "O arquivo foi conferido, mas todas as linhas bateram com lançamentos existentes. Para revisar, abra Lançamentos ou importe outro arquivo."
    : nothingImported
      ? "A confirmação chegou ao backend, mas nenhuma linha selecionada virou lançamento novo. Confira duplicados, seleção das linhas e tente novamente se necessário."
      : mode === "ofx"
        ? "Os lançamentos OFX aprovados foram salvos no SQLite e já podem aparecer em Lançamentos e no Dashboard do mês."
        : "A fatura e os lançamentos aprovados foram salvos no SQLite e já podem aparecer em Fatura Caixa, Lançamentos e no Dashboard.";

  return (
    <Panel title={title} description={description} className="mt-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total lido" value={result.totalRows} />
        <SummaryCard label="Importados" value={result.importedRows} />
        <SummaryCard label="Duplicados ignorados" value={result.duplicatedRows} />
        <SummaryCard label="A revisar" value={needsReviewRows} />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onNavigate("lancamentos")}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15"
        >
          Ver lançamentos importados
        </button>
        <button
          type="button"
          onClick={() => onNavigate("inicio")}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-accent"
        >
          Ir para dashboard
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground transition hover:bg-accent"
        >
          Importar outro arquivo
        </button>
        {mode === "pdf" && "invoiceId" in result && (
          <button
            type="button"
            onClick={() => onNavigate("fatura-caixa")}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground transition hover:bg-accent"
          >
            Ver fatura criada
          </button>
        )}
      </div>
    </Panel>
  );
}

function ImportCard({
  active,
  title,
  description,
  icon: Icon,
  status,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  status: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border border-border bg-card p-5 text-left shadow-soft transition hover:bg-accent/40",
        active && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex size-11 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden />
        </div>
        <StatusPill tone={active ? "invoicePaid" : "neutral"}>{status}</StatusPill>
      </div>
      <h2 className="mt-5 text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </button>
  );
}

function OfxPreviewPanel({
  preview,
  categories,
  isConfirming,
  isConfirmed,
  onChange,
  onConfirm,
}: {
  preview: ApiOfxPreview;
  categories: ApiCategory[];
  isConfirming: boolean;
  isConfirmed: boolean;
  onChange: (preview: ApiOfxPreview) => void;
  onConfirm: () => void;
}) {
  const selectedCount = preview.transactions.filter((row) => row.import).length;
  const reviewCategory = categories.find(
    (category) => category.name.toLowerCase() === "a revisar",
  );

  function updateRow(
    previewId: string,
    updater: (row: ApiOfxPreviewTransaction) => ApiOfxPreviewTransaction,
  ) {
    onChange({
      ...preview,
      transactions: preview.transactions.map((row) =>
        row.previewId === previewId ? updater(row) : row,
      ),
    });
  }

  return (
    <Panel
      title="Prévia do OFX"
      description={`${preview.totalRows} lançamentos lidos de ${preview.fileName}`}
      className="mt-6"
      action={
        <ConfirmButton
          disabled={isConfirming || isConfirmed || preview.transactions.length === 0}
          isConfirming={isConfirming}
          isConfirmed={isConfirmed}
          onConfirm={onConfirm}
        />
      }
    >
      <div className="mb-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5">
        <Meta label="Banco" value={preview.bankCode ?? "-"} />
        <Meta label="Conta" value={preview.accountId ?? "-"} />
        <Meta label="Tipo" value={preview.accountType ?? "-"} />
        <Meta label="Início" value={preview.periodStart ?? "-"} />
        <Meta label="Fim" value={preview.periodEnd ?? "-"} />
      </div>
      <OfxPreviewTable
        rows={preview.transactions}
        categories={categories}
        onToggle={(previewId) =>
          updateRow(previewId, (row) => ({ ...row, import: !row.import }))
        }
        onDescriptionChange={(previewId, descriptionClean) =>
          updateRow(previewId, (row) => ({ ...row, descriptionClean }))
        }
        onCategoryChange={(previewId, categoryId) =>
          updateRow(previewId, (row) => {
            const category = categories.find((item) => item.id === categoryId);
            const isReviewCategory = !categoryId || category?.id === reviewCategory?.id;

            return {
              ...row,
              categoryId: categoryId || null,
              categoryName: category?.name ?? "A revisar",
              reviewStatus: isReviewCategory ? "needs_review" : "reviewed",
            };
          })
        }
        onDirectionChange={(previewId, direction) =>
          updateRow(previewId, (row) => ({ ...row, direction }))
        }
        onPaymentMethodChange={(previewId, paymentMethod) =>
          updateRow(previewId, (row) => ({ ...row, paymentMethod }))
        }
      />
      <p className="mt-4 text-sm text-muted-foreground">
        {selectedCount} selecionados para importar. Duplicados permanecem visiveis
        para conferencia e sao ignorados na confirmacao.
      </p>
      {isConfirming && (
        <p className="mt-3 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground">
          Enviando confirmação ao backend e gravando no SQLite...
        </p>
      )}
    </Panel>
  );
}

function PdfPreviewPanel({
  preview,
  categories,
  isConfirming,
  isConfirmed,
  onChange,
  onConfirm,
}: {
  preview: ApiPdfInvoicePreview;
  categories: ApiCategory[];
  isConfirming: boolean;
  isConfirmed: boolean;
  onChange: (preview: ApiPdfInvoicePreview) => void;
  onConfirm: () => void;
}) {
  const allRows = [
    ...preview.nationalTransactions,
    ...preview.internationalTransactions,
    ...preview.fees,
  ];
  const selectedCount = allRows.filter((row) => row.import).length;
  const reviewCategory = categories.find(
    (category) => category.name.toLowerCase() === "a revisar",
  );

  function updateRow(
    section: "nationalTransactions" | "internationalTransactions" | "fees",
    previewId: string,
    updater: (row: ApiPdfInvoicePreviewTransaction) => ApiPdfInvoicePreviewTransaction,
  ) {
    onChange({
      ...preview,
      [section]: preview[section].map((row) =>
        row.previewId === previewId ? updater(row) : row,
      ),
    });
  }

  return (
    <Panel
      title="Prévia da fatura"
      description={`${allRows.length} lançamentos lidos de ${preview.fileName}`}
      className="mt-6"
      action={
        <ConfirmButton
          disabled={isConfirming || isConfirmed || allRows.length === 0}
          isConfirming={isConfirming}
          isConfirmed={isConfirmed}
          onConfirm={onConfirm}
        />
      }
    >
      <div className="mb-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5">
        <Meta label="Tipo" value={preview.invoiceType} />
        <Meta label="Final cartão" value={preview.cardLastDigits ?? "-"} />
        <Meta
          label="Total PDF"
          value={preview.totalFromFile === null ? "-" : formatCurrency(preview.totalFromFile)}
        />
        <Meta label="Total calculado" value={formatCurrency(preview.totalCalculated)} />
        <Meta
          label="Diferença"
          value={preview.difference === null ? "-" : formatCurrency(preview.difference)}
          tone={
            preview.difference !== null && Math.abs(preview.difference) > 0.01
              ? "warning"
              : undefined
          }
        />
      </div>

      {preview.difference !== null && Math.abs(preview.difference) > 0.01 && (
        <p className="mb-5 rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          O total informado no PDF difere do total calculado. Revise os lançamentos
          antes de confirmar.
        </p>
      )}

      <PdfSectionTable
        title="Movimentações nacionais"
        rows={preview.nationalTransactions}
        categories={categories}
        onToggle={(previewId) =>
          updateRow("nationalTransactions", previewId, (row) => ({
            ...row,
            import: !row.import,
          }))
        }
        onCategoryChange={(previewId, categoryId) =>
          updateRow("nationalTransactions", previewId, (row) => {
            const category = categories.find((item) => item.id === categoryId);
            const isReviewCategory = !categoryId || category?.id === reviewCategory?.id;
            return {
              ...row,
              categoryId: categoryId || null,
              categoryName: category?.name ?? "A revisar",
              reviewStatus: isReviewCategory ? "needs_review" : "reviewed",
            };
          })
        }
      />
      <PdfSectionTable
        title="Movimentações internacionais"
        rows={preview.internationalTransactions}
        categories={categories}
        onToggle={(previewId) =>
          updateRow("internationalTransactions", previewId, (row) => ({
            ...row,
            import: !row.import,
          }))
        }
        onCategoryChange={(previewId, categoryId) =>
          updateRow("internationalTransactions", previewId, (row) => {
            const category = categories.find((item) => item.id === categoryId);
            const isReviewCategory = !categoryId || category?.id === reviewCategory?.id;
            return {
              ...row,
              categoryId: categoryId || null,
              categoryName: category?.name ?? "A revisar",
              reviewStatus: isReviewCategory ? "needs_review" : "reviewed",
            };
          })
        }
      />
      <PdfSectionTable
        title="Taxas e IOF"
        rows={preview.fees}
        categories={categories}
        onToggle={(previewId) =>
          updateRow("fees", previewId, (row) => ({
            ...row,
            import: !row.import,
          }))
        }
        onCategoryChange={(previewId, categoryId) =>
          updateRow("fees", previewId, (row) => {
            const category = categories.find((item) => item.id === categoryId);
            const isReviewCategory = !categoryId || category?.id === reviewCategory?.id;
            return {
              ...row,
              categoryId: categoryId || null,
              categoryName: category?.name ?? "A revisar",
              reviewStatus: isReviewCategory ? "needs_review" : "reviewed",
            };
          })
        }
      />
      <p className="mt-4 text-sm text-muted-foreground">
        {selectedCount} selecionados para importar. Duplicados permanecem visíveis
        para conferência e são ignorados na confirmação.
      </p>
      {isConfirming && (
        <p className="mt-3 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground">
          Enviando confirmação ao backend e gravando no SQLite...
        </p>
      )}
    </Panel>
  );
}

function OfxPreviewTable({
  rows,
  categories,
  onToggle,
  onDescriptionChange,
  onCategoryChange,
  onDirectionChange,
  onPaymentMethodChange,
}: {
  rows: ApiOfxPreviewTransaction[];
  categories: ApiCategory[];
  onToggle: (previewId: string) => void;
  onDescriptionChange: (previewId: string, descriptionClean: string) => void;
  onCategoryChange: (previewId: string, categoryId: string) => void;
  onDirectionChange: (
    previewId: string,
    direction: ApiOfxPreviewTransaction["direction"],
  ) => void;
  onPaymentMethodChange: (
    previewId: string,
    paymentMethod: ApiOfxPreviewTransaction["paymentMethod"],
  ) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="hidden grid-cols-[72px_92px_minmax(220px,1fr)_120px_130px_130px_160px_120px] gap-4 bg-secondary/70 px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground xl:grid">
        <span>Importar</span>
        <span>Data</span>
        <span>Descrição</span>
        <span className="text-right">Valor</span>
        <span>Direcao</span>
        <span>Pagamento</span>
        <span>Categoria</span>
        <span>Duplicado</span>
      </div>
      <div className="divide-y divide-border/80">
        {rows.map((row) => (
          <div
            key={row.previewId}
            className={cn(
              "grid gap-3 px-4 py-4 text-sm xl:grid-cols-[72px_92px_minmax(220px,1fr)_120px_130px_130px_160px_120px] xl:items-center xl:gap-4",
              row.possibleDuplicate && "bg-amber-300/5",
            )}
          >
            <Checkbox checked={row.import} onChange={() => onToggle(row.previewId)} />
            <span className="text-muted-foreground">{formatDate(row.date)}</span>
            <div>
              <input
                value={row.descriptionClean ?? ""}
                onChange={(event) =>
                  onDescriptionChange(row.previewId, event.target.value)
                }
                className="h-10 w-full rounded-lg border border-border bg-secondary/35 px-3 text-foreground outline-none transition focus:border-primary/50"
              />
              <p className="mt-1 text-xs text-muted-foreground">Original: {row.memo}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                ID: {row.fitId ?? row.externalId}
              </p>
            </div>
            <Amount
              value={row.direction === "expense" ? -Math.abs(row.amount) : Math.abs(row.amount)}
            />
            <select
              value={row.direction}
              onChange={(event) =>
                onDirectionChange(
                  row.previewId,
                  event.target.value as ApiOfxPreviewTransaction["direction"],
                )
              }
              className="h-10 rounded-lg border border-border bg-secondary/35 px-3 text-foreground outline-none transition focus:border-primary/50"
            >
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
              <option value="neutral">Neutro</option>
            </select>
            <select
              value={row.paymentMethod}
              onChange={(event) =>
                onPaymentMethodChange(
                  row.previewId,
                  event.target.value as ApiOfxPreviewTransaction["paymentMethod"],
                )
              }
              className="h-10 rounded-lg border border-border bg-secondary/35 px-3 text-foreground outline-none transition focus:border-primary/50"
            >
              <option value="account">Conta</option>
              <option value="debit">Debito</option>
              <option value="credit">Credito</option>
              <option value="adjustment">Ajuste</option>
            </select>
            <select
              value={row.categoryId ?? ""}
              onChange={(event) => onCategoryChange(row.previewId, event.target.value)}
              className="h-10 rounded-lg border border-border bg-secondary/35 px-3 text-foreground outline-none transition focus:border-primary/50"
            >
              <option value="">A revisar</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <DuplicatePill duplicate={row.possibleDuplicate} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PdfSectionTable({
  title,
  rows,
  categories,
  onToggle,
  onCategoryChange,
}: {
  title: string;
  rows: ApiPdfInvoicePreviewTransaction[];
  categories: ApiCategory[];
  onToggle: (previewId: string) => void;
  onCategoryChange: (previewId: string, categoryId: string) => void;
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="hidden grid-cols-[84px_92px_minmax(240px,1fr)_120px_180px_120px] gap-4 bg-secondary/70 px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground xl:grid">
          <span>Importar</span>
          <span>Data</span>
          <span>Descrição</span>
          <span className="text-right">Valor</span>
          <span>Categoria</span>
          <span>Duplicado</span>
        </div>
        <div className="divide-y divide-border/80">
          {rows.map((row) => (
            <div
              key={row.previewId}
              className={cn(
                "grid gap-3 px-4 py-4 text-sm xl:grid-cols-[84px_92px_minmax(240px,1fr)_120px_180px_120px] xl:items-center xl:gap-4",
                row.possibleDuplicate && "bg-amber-300/5",
              )}
            >
              <Checkbox checked={row.import} onChange={() => onToggle(row.previewId)} />
              <span className="text-muted-foreground">{formatDate(row.date)}</span>
              <div>
                <p className="font-medium text-foreground">{row.descriptionOriginal}</p>
                {row.isFee && <p className="mt-1 text-xs text-amber-200">taxa/IOF</p>}
              </div>
              <Amount value={-Math.abs(row.amount)} />
              <select
                value={row.categoryId ?? ""}
                onChange={(event) => onCategoryChange(row.previewId, event.target.value)}
                className="h-10 rounded-lg border border-border bg-secondary/35 px-3 text-foreground outline-none transition focus:border-primary/50"
              >
                <option value="">A revisar</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <DuplicatePill duplicate={row.possibleDuplicate} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 accent-emerald-300"
      />
      <span className="xl:hidden">Importar</span>
    </label>
  );
}

function Amount({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "font-semibold xl:text-right",
        value < 0 ? "text-rose-200" : "text-emerald-200",
      )}
    >
      {formatCurrency(value)}
    </span>
  );
}

function DuplicatePill({ duplicate }: { duplicate: boolean }) {
  return (
    <StatusPill tone={duplicate ? "review" : "neutral"}>
      {duplicate ? "possível" : "não"}
    </StatusPill>
  );
}

function ConfirmButton({
  disabled,
  isConfirming,
  isConfirmed,
  onConfirm,
}: {
  disabled: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  onConfirm: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onConfirm}
      disabled={disabled}
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
    >
      <CheckCircle2 className="size-4" aria-hidden="true" />
      {isConfirming
        ? "Importando..."
        : isConfirmed
          ? "Importação concluída"
          : "Confirmar importação"}
    </button>
  );
}

function Meta({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-secondary/25 px-3 py-3",
        tone === "warning" && "border-amber-300/20 bg-amber-300/10",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-lg border border-border bg-secondary/25 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
  );
}
