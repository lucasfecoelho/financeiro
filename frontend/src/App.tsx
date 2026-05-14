import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CaixaInvoicePage } from "@/pages/CaixaInvoicePage";
import { HomePage } from "@/pages/HomePage";
import { ImportPage } from "@/pages/ImportPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { TransactionsPage } from "@/pages/TransactionsPage";
import type { PageId } from "@/types";

type ThemeMode = "light" | "dark";

const pages: Record<PageId, React.ComponentType> = {
  inicio: HomePage,
  importar: ImportPage,
  lancamentos: TransactionsPage,
  "fatura-caixa": CaixaInvoicePage,
  configuracoes: SettingsPage,
};

export function App() {
  const [activePage, setActivePage] = useState<PageId>("inicio");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("financas:theme", theme);
  }, [theme]);

  useEffect(() => {
    function handleNavigate(event: Event) {
      const detail = (event as CustomEvent<{ page?: PageId }>).detail;
      const page = detail?.page;

      if (page && page in pages) {
        setActivePage(page);
        setIsImportOpen(false);
      }
    }

    window.addEventListener("financas:navigate", handleNavigate);
    return () => window.removeEventListener("financas:navigate", handleNavigate);
  }, []);

  useEffect(() => {
    function handleOpenImport(event: Event) {
      const detail = (event as CustomEvent<{ mode?: "ofx" | "pdf" }>).detail;

      if (detail?.mode) {
        window.sessionStorage.setItem("financas:import-mode", detail.mode);
      }

      setIsImportOpen(true);
    }

    window.addEventListener("financas:open-import", handleOpenImport);
    return () => window.removeEventListener("financas:open-import", handleOpenImport);
  }, []);

  const ActivePage = pages[activePage];

  return (
    <AppShell
      activePage={activePage}
      onNavigate={setActivePage}
    >
      {activePage === "configuracoes" ? (
        <SettingsPage
          theme={theme}
          onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        />
      ) : (
        <ActivePage />
      )}
      {isImportOpen && <ImportDrawer onClose={() => setIsImportOpen(false)} />}
    </AppShell>
  );
}

function getInitialTheme(): ThemeMode {
  const savedTheme = window.localStorage.getItem("financas:theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function ImportDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/70 backdrop-blur-sm">
      <button
        type="button"
        className="hidden flex-1 cursor-default md:block"
        aria-label="Fechar importação"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-5xl flex-col border-l border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
              importar
            </p>
            <h2 className="mt-1 text-xl font-semibold">Escolha o arquivo</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 lg:px-7">
          <ImportPage embedded onClose={onClose} />
        </div>
      </aside>
    </div>
  );
}
