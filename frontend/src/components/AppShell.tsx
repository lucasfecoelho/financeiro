import { Activity, CalendarDays, WalletCards } from "lucide-react";
import { navItems } from "@/config/navigation";
import { currentMonthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HealthState, PageId } from "@/types";

type AppShellProps = {
  activePage: PageId;
  health: HealthState;
  onNavigate: (page: PageId) => void;
  children: React.ReactNode;
};

export function AppShell({
  activePage,
  health,
  onNavigate,
  children,
}: AppShellProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col lg:flex-row">
        <aside className="border-b border-border/80 bg-sidebar/80 px-4 py-4 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="flex items-center justify-between gap-4 lg:block">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-card text-primary shadow-soft">
                <WalletCards className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-base font-semibold">financas</p>
                <p className="text-xs text-muted-foreground">controle local</p>
              </div>
            </div>

            <HealthBadge health={health} className="lg:hidden" />
          </div>

          <nav className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:mt-10 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.id === activePage;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground lg:w-full",
                    active &&
                      "bg-primary/12 text-foreground ring-1 ring-primary/25",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-8 hidden rounded-lg border border-border bg-card/70 p-4 lg:block">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Ambiente
            </p>
            <p className="mt-3 text-sm leading-6 text-card-foreground">
              Dados locais em SQLite. Importacao, fatura e IA ainda pedem
              validacao com arquivos e chave reais.
            </p>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-border/80 bg-background/88 px-5 py-4 backdrop-blur lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                <span className="capitalize">{currentMonthLabel()}</span>
              </div>
              <HealthBadge health={health} className="hidden lg:flex" />
            </div>
          </header>

          <div className="px-5 py-6 lg:px-8 lg:py-8">{children}</div>
        </section>
      </div>
    </main>
  );
}

function HealthBadge({
  health,
  className,
}: {
  health: HealthState;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          health === "ok" && "bg-emerald-400",
          health === "offline" && "bg-rose-400",
          health === "checking" && "bg-amber-300",
        )}
      />
      <Activity className="size-3.5" aria-hidden="true" />
      <span>
        API{" "}
        {health === "checking"
          ? "verificando"
          : health === "ok"
            ? "online"
            : "offline"}
      </span>
    </div>
  );
}
