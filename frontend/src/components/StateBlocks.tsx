import { AlertCircle, Inbox, Loader2 } from "lucide-react";

export function LoadingBlock({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-border/80 bg-secondary/25 px-6 py-10 text-center">
      <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 px-6 py-10 text-center">
      <AlertCircle className="size-7 text-rose-600 dark:text-rose-200" aria-hidden="true" />
      <p className="mt-4 max-w-md text-sm text-rose-700 dark:text-rose-100">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 h-10 rounded-lg border border-rose-200/20 px-4 text-sm font-medium text-rose-100 transition hover:bg-rose-300/10"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function EmptyBlock({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border/90 bg-secondary/20 px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-card text-primary">
        <Inbox className="size-6" aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-lg font-extrabold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
