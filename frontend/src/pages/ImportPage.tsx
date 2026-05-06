import { useRef, useState } from "react";
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

type ImportMode = "ofx" | "pdf";

export function ImportPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<ImportMode>("ofx");
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

      {ofxPreview && mode === "ofx" && (
        <OfxPreviewPanel
          preview={ofxPreview}
          isConfirming={isConfirming}
          onChange={setOfxPreview}
          onConfirm={() => void confirmImport()}
        />
      )}

      {pdfPreview && mode === "pdf" && (
        <PdfPreviewPanel
          categories={categories ?? []}
          preview={pdfPreview}
          isConfirming={isConfirming}
          onChange={setPdfPreview}
          onConfirm={() => void confirmImport()}
        />
      )}

      {currentPreview && result && (
        <Panel title="Resumo da importação" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Total lido" value={result.totalRows} />
            <SummaryCard label="Importados" value={result.importedRows} />
            <SummaryCard label="Duplicados ignorados" value={result.duplicatedRows} />
            <SummaryCard
              label="A revisar"
              value={"needsReviewRows" in result ? result.needsReviewRows : 0}
            />
          </div>
        </Panel>
      )}
    </div>
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
  isConfirming,
  onChange,
  onConfirm,
}: {
  preview: ApiOfxPreview;
  isConfirming: boolean;
  onChange: (preview: ApiOfxPreview) => void;
  onConfirm: () => void;
}) {
  const selectedCount = preview.transactions.filter((row) => row.import).length;

  return (
    <Panel
      title="Prévia do OFX"
      description={`${preview.totalRows} lançamentos lidos de ${preview.fileName}`}
      className="mt-6"
      action={
        <ConfirmButton
          disabled={isConfirming || selectedCount === 0}
          isConfirming={isConfirming}
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
        onToggle={(previewId) =>
          onChange({
            ...preview,
            transactions: preview.transactions.map((row) =>
              row.previewId === previewId ? { ...row, import: !row.import } : row,
            ),
          })
        }
      />
    </Panel>
  );
}

function PdfPreviewPanel({
  preview,
  categories,
  isConfirming,
  onChange,
  onConfirm,
}: {
  preview: ApiPdfInvoicePreview;
  categories: ApiCategory[];
  isConfirming: boolean;
  onChange: (preview: ApiPdfInvoicePreview) => void;
  onConfirm: () => void;
}) {
  const allRows = [
    ...preview.nationalTransactions,
    ...preview.internationalTransactions,
    ...preview.fees,
  ];
  const selectedCount = allRows.filter((row) => row.import).length;

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
          disabled={isConfirming || selectedCount === 0}
          isConfirming={isConfirming}
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
            return {
              ...row,
              categoryId: categoryId || null,
              categoryName: category?.name ?? "A revisar",
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
            return {
              ...row,
              categoryId: categoryId || null,
              categoryName: category?.name ?? "A revisar",
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
            return {
              ...row,
              categoryId: categoryId || null,
              categoryName: category?.name ?? "A revisar",
            };
          })
        }
      />
    </Panel>
  );
}

function OfxPreviewTable({
  rows,
  onToggle,
}: {
  rows: ApiOfxPreviewTransaction[];
  onToggle: (previewId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="hidden grid-cols-[84px_92px_minmax(240px,1fr)_120px_100px_150px_130px] gap-4 bg-secondary/70 px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground xl:grid">
        <span>Importar</span>
        <span>Data</span>
        <span>Descrição</span>
        <span className="text-right">Valor</span>
        <span>Tipo</span>
        <span>Categoria</span>
        <span>Duplicado</span>
      </div>
      <div className="divide-y divide-border/80">
        {rows.map((row) => (
          <div
            key={row.previewId}
            className="grid gap-3 px-4 py-4 text-sm xl:grid-cols-[84px_92px_minmax(240px,1fr)_120px_100px_150px_130px] xl:items-center xl:gap-4"
          >
            <Checkbox checked={row.import} onChange={() => onToggle(row.previewId)} />
            <span className="text-muted-foreground">{formatDate(row.date)}</span>
            <span className="font-medium text-foreground">{row.memo}</span>
            <Amount
              value={row.direction === "expense" ? -Math.abs(row.amount) : Math.abs(row.amount)}
            />
            <span className="text-muted-foreground">{row.trnType}</span>
            <span className="text-muted-foreground">{row.categoryName}</span>
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
  onConfirm,
}: {
  disabled: boolean;
  isConfirming: boolean;
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
      {isConfirming ? "Importando..." : "Confirmar importação"}
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
