import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CaixaInvoicePage } from "@/pages/CaixaInvoicePage";
import { HomePage } from "@/pages/HomePage";
import { ImportPage } from "@/pages/ImportPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { TransactionsPage } from "@/pages/TransactionsPage";
import type { HealthState, PageId } from "@/types";

const pages: Record<PageId, React.ComponentType> = {
  inicio: HomePage,
  importar: ImportPage,
  lancamentos: TransactionsPage,
  "fatura-caixa": CaixaInvoicePage,
  configuracoes: SettingsPage,
};

export function App() {
  const [activePage, setActivePage] = useState<PageId>("inicio");
  const [health, setHealth] = useState<HealthState>("checking");

  useEffect(() => {
    let active = true;

    async function loadHealth() {
      try {
        const response = await fetch("/api/health");

        if (!response.ok) {
          throw new Error("Health check failed");
        }

        const data = (await response.json()) as { status?: string };

        if (active) {
          setHealth(data.status === "ok" ? "ok" : "offline");
        }
      } catch {
        if (active) {
          setHealth("offline");
        }
      }
    }

    void loadHealth();

    return () => {
      active = false;
    };
  }, []);

  const ActivePage = pages[activePage];

  return (
    <AppShell activePage={activePage} health={health} onNavigate={setActivePage}>
      <ActivePage />
    </AppShell>
  );
}
