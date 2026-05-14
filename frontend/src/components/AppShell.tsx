import { Settings2 } from "lucide-react";
import { navItems } from "@/config/navigation";
import { cn } from "@/lib/utils";
import type { PageId } from "@/types";

type AppShellProps = {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  children: React.ReactNode;
};

export function AppShell({ activePage, onNavigate, children }: AppShellProps) {
  const pageTitle = pageTitles[activePage] ?? "Finanças";

  return (
    <main className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="flex min-h-screen w-full flex-col lg:flex-row">
        <aside className="border-b border-border/70 bg-sidebar/90 px-4 py-4 shadow-soft backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="flex items-center justify-between gap-4 lg:block">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-xl font-extrabold tracking-tight text-primary shadow-soft">
                $
              </div>
              <p className="text-base font-extrabold tracking-tight">Finanças</p>
            </div>
          </div>

          <nav className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:mt-12 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.id === activePage;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition hover:-translate-y-0.5 hover:bg-accent hover:text-foreground lg:w-full",
                    active && "bg-primary/10 text-foreground ring-1 ring-primary/25",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-border/70 bg-background/88 px-5 py-4 shadow-sm backdrop-blur-xl lg:px-8 xl:px-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="mt-1 text-xl font-extrabold tracking-tight text-foreground">
                  {pageTitle}
                </h1>
              </div>

              <div className="flex items-center gap-4">
                <span className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm">
                  Lucas
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate("configuracoes")}
                  className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-accent hover:text-foreground"
                  aria-label="Abrir configurações"
                >
                  <Settings2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </header>

          <div className="px-5 py-6 lg:px-8 lg:py-8 xl:px-10 2xl:px-12">{children}</div>
        </section>
      </div>
    </main>
  );
}

const pageTitles: Record<PageId, string> = {
  inicio: "Visão geral",
  importar: "Importar arquivo",
  lancamentos: "Lançamentos",
  "fatura-caixa": "Fatura",
  configuracoes: "Configurações",
};
