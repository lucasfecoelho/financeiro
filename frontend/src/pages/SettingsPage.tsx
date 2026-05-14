import { useEffect, useMemo, useState } from "react";
import { Archive, Folder, Moon, Save, Sun, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { ErrorBlock, LoadingBlock } from "@/components/StateBlocks";
import { useApiQuery } from "@/hooks/useApiQuery";
import { api } from "@/lib/api";
import type {
  ApiBackup,
  ApiCategory,
  ApiCategoryRule,
  CategoryRuleInput,
} from "@/lib/apiTypes";

type SettingsForm = {
  cardClosingDay: string;
  cardDueDay: string;
  cardName: string;
  dataDirectory: string;
};

type SettingsPageProps = {
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
};

const defaultForm: SettingsForm = {
  cardClosingDay: "25",
  cardDueDay: "10",
  cardName: "Caixa",
  dataDirectory: "C:\\Financeiro",
};

export function SettingsPage({ theme = "dark", onToggleTheme }: SettingsPageProps = {}) {
  const { data: settings, error, isLoading, refetch } = useApiQuery(api.settings);
  const { data: categories, refetch: refetchCategories } = useApiQuery(api.categories);
  const {
    data: rules,
    error: rulesError,
    isLoading: isLoadingRules,
    refetch: refetchRules,
  } = useApiQuery(api.categoryRules);
  const {
    data: backups,
    error: backupsError,
    isLoading: isLoadingBackups,
    refetch: refetchBackups,
  } = useApiQuery(api.backups);
  const [form, setForm] = useState<SettingsForm>(defaultForm);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [backupState, setBackupState] = useState<"idle" | "creating" | "created" | "error">(
    "idle",
  );
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const settingsMap = useMemo(() => {
    return new Map(settings?.map((setting) => [setting.key, setting.value]) ?? []);
  }, [settings]);

  useEffect(() => {
    if (!settings) {
      return;
    }

    setForm({
      cardClosingDay: settingsMap.get("cardClosingDay") ?? defaultForm.cardClosingDay,
      cardDueDay: settingsMap.get("cardDueDay") ?? defaultForm.cardDueDay,
      cardName: settingsMap.get("cardName") ?? defaultForm.cardName,
      dataDirectory: settingsMap.get("dataDirectory") ?? defaultForm.dataDirectory,
    });
  }, [settings, settingsMap]);

  async function saveSettings() {
    setSaveState("saving");
    setSaveMessage(null);

    try {
      await Promise.all([
        api.updateSetting("cardClosingDay", form.cardClosingDay),
        api.updateSetting("cardDueDay", form.cardDueDay),
        api.updateSetting("cardName", form.cardName),
        api.updateSetting("dataDirectory", form.dataDirectory),
      ]);

      await refetch();
      setSaveState("saved");
      setSaveMessage("Configurações salvas.");
    } catch (caughtError) {
      setSaveState("error");
      setSaveMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível salvar as configurações.",
      );
    }
  }

  async function createBackup() {
    setBackupState("creating");
    setBackupMessage(null);

    try {
      const backup = await api.createBackup();
      await refetchBackups();
      setBackupState("created");
      setBackupMessage(`Backup criado: ${backup.name}`);
    } catch (caughtError) {
      setBackupState("error");
      setBackupMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível criar o backup.",
      );
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="configurações"
        title="Preferências e regras."
        description="Ajuste cartão, pastas e regras para deixar a organização mais leve."
      />

      {isLoading && (
        <Panel>
          <LoadingBlock label="Carregando configurações..." />
        </Panel>
      )}

      {error && (
        <Panel>
          <ErrorBlock message={error} onRetry={refetch} />
        </Panel>
      )}

      {!isLoading && !error && (
        <>
          <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
            <Panel title="Cartão" description="Datas e identificação visual.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Fechamento do cartão"
                  value={form.cardClosingDay}
                  suffix="dia"
                  onChange={(value) => updateField("cardClosingDay", value)}
                />
                <Field
                  label="Vencimento"
                  value={form.cardDueDay}
                  suffix="dia"
                  onChange={(value) => updateField("cardDueDay", value)}
                />
                <Field
                  label="Nome do cartão"
                  value={form.cardName}
                  onChange={(value) => updateField("cardName", value)}
                />
              </div>
            </Panel>

            <Panel
              title="Aparência"
              description="Escolha o tema que deixa a leitura mais confortável."
            >
              <button
                type="button"
                onClick={onToggleTheme}
                disabled={!onToggleTheme}
                className="flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-secondary/35 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              >
                <span>
                  <span className="block text-sm font-semibold text-foreground">
                    {theme === "dark" ? "Tema escuro" : "Tema claro"}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {theme === "dark" ? "Trocar para claro" : "Trocar para escuro"}
                  </span>
                </span>
                <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-card text-primary">
                  {theme === "dark" ? (
                    <Moon className="size-4" aria-hidden="true" />
                  ) : (
                    <Sun className="size-4" aria-hidden="true" />
                  )}
                </span>
              </button>
            </Panel>

          </div>

          <Panel title="Arquivos" className="mt-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <Field
                label="Pasta de dados"
                value={form.dataDirectory}
                icon={<Folder className="size-4 text-primary" aria-hidden="true" />}
                onChange={(value) => updateField("dataDirectory", value)}
              />
              <button
                type="button"
                onClick={saveSettings}
                disabled={saveState === "saving"}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="size-4" aria-hidden="true" />
                {saveState === "saving" ? "Salvando..." : "Salvar"}
              </button>
            </div>

            {saveMessage && (
              <p
                className={
                  saveState === "error"
                    ? "mt-4 text-sm text-rose-200"
                    : "mt-4 text-sm text-emerald-200"
                }
              >
                {saveMessage}
              </p>
            )}
          </Panel>

          <BackupPanel
            backups={backups ?? []}
            error={backupsError}
            isLoading={isLoadingBackups}
            state={backupState}
            message={backupMessage}
            onCreate={() => void createBackup()}
            onRetry={() => void refetchBackups()}
          />

          <CategoryRulesPanel
            categories={categories ?? []}
            isLoading={isLoadingRules}
            error={rulesError}
            rules={rules ?? []}
            onChanged={() => {
              void refetchRules();
              void refetchCategories();
            }}
          />
        </>
      )}
    </div>
  );

  function updateField(key: keyof SettingsForm, value: string) {
    setSaveState("idle");
    setSaveMessage(null);
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  }
}

function BackupPanel({
  backups,
  error,
  isLoading,
  state,
  message,
  onCreate,
  onRetry,
}: {
  backups: ApiBackup[];
  error: string | null;
  isLoading: boolean;
  state: "idle" | "creating" | "created" | "error";
  message: string | null;
  onCreate: () => void;
  onRetry: () => void;
}) {
  return (
    <Panel
      title="Backup"
      description="Cópias manuais para guardar seu histórico com tranquilidade."
      className="mt-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-secondary/35 text-primary">
            <Archive className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium">Backup manual</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Nenhum backup é apagado automaticamente.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCreate}
          disabled={state === "creating"}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="size-4" aria-hidden="true" />
          {state === "creating" ? "Criando..." : "Criar backup agora"}
        </button>
      </div>

      {message && (
        <p
          className={
            state === "error"
              ? "mt-4 text-sm text-rose-200"
              : "mt-4 text-sm text-emerald-200"
          }
        >
          {message}
        </p>
      )}

      <div className="mt-5 overflow-hidden rounded-lg border border-border">
        <div className="hidden grid-cols-[1fr_150px_120px] gap-4 bg-secondary/70 px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground md:grid">
          <span>Arquivo</span>
          <span>Data</span>
          <span className="text-right">Tamanho</span>
        </div>

        {isLoading && <LoadingBlock label="Carregando backups..." />}
        {error && <ErrorBlock message={error} onRetry={onRetry} />}

        {!isLoading && !error && (
          <div className="divide-y divide-border/80">
            {backups.slice(0, 8).map((backup) => (
              <div
                key={backup.name}
                className="grid gap-2 px-4 py-4 text-sm md:grid-cols-[1fr_150px_120px] md:items-center md:gap-4"
              >
                <span className="font-medium text-foreground">{backup.name}</span>
                <span className="text-muted-foreground">{formatBackupDate(backup.date)}</span>
                <span className="font-medium text-muted-foreground md:text-right">
                  {formatFileSize(backup.size)}
                </span>
              </div>
            ))}
            {backups.length === 0 && (
              <p className="px-4 py-5 text-sm text-muted-foreground">
                Nenhum backup criado ainda.
              </p>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

function CategoryRulesPanel({
  categories,
  rules,
  isLoading,
  error,
  onChanged,
}: {
  categories: ApiCategory[];
  rules: ApiCategoryRule[];
  isLoading: boolean;
  error: string | null;
  onChanged: () => void;
}) {
  const reviewCategory = categories.find((category) => category.name === "A revisar");
  const [draft, setDraft] = useState<CategoryRuleInput>({
    pattern: "",
    matchType: "contains",
    categoryId: reviewCategory?.id ?? "",
    descriptionClean: "",
    paymentMethod: null,
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!draft.categoryId && reviewCategory?.id) {
      setDraft((current) => ({ ...current, categoryId: reviewCategory.id }));
    }
  }, [draft.categoryId, reviewCategory?.id]);

  async function createRule() {
    setMessage(null);

    try {
      await api.createCategoryRule({
        ...draft,
        descriptionClean: draft.descriptionClean || null,
        paymentMethod: draft.paymentMethod || null,
      });
      setDraft({
        pattern: "",
        matchType: "contains",
        categoryId: reviewCategory?.id ?? categories[0]?.id ?? "",
        descriptionClean: "",
        paymentMethod: null,
      });
      setMessage("Regra criada.");
      onChanged();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Erro ao criar regra.");
    }
  }

  return (
    <Panel
      title="Regras de categoria"
      description="Regras simples aplicadas em descrições originais e limpas nas próximas importações."
      className="mt-6"
    >
      {isLoading && <LoadingBlock label="Carregando regras..." />}
      {error && <ErrorBlock message={error} />}
      {!isLoading && !error && (
        <>
          <div className="grid gap-3 lg:grid-cols-[1fr_150px_190px_1fr_150px_auto] lg:items-end">
            <RuleInput
              label="Padrão"
              value={draft.pattern}
              onChange={(value) => setDraft((current) => ({ ...current, pattern: value }))}
            />
            <RuleSelect
              label="Tipo"
              value={draft.matchType}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  matchType: value as CategoryRuleInput["matchType"],
                }))
              }
              options={matchTypeOptions}
            />
            <RuleSelect
              label="Categoria"
              value={draft.categoryId}
              onChange={(value) => setDraft((current) => ({ ...current, categoryId: value }))}
              options={categories.map((category) => ({
                label: category.name,
                value: category.id,
              }))}
            />
            <RuleInput
              label="Descrição limpa"
              value={draft.descriptionClean ?? ""}
              onChange={(value) =>
                setDraft((current) => ({ ...current, descriptionClean: value }))
              }
            />
            <RuleSelect
              label="Forma"
              value={draft.paymentMethod ?? ""}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  paymentMethod: value as CategoryRuleInput["paymentMethod"],
                }))
              }
              options={paymentMethodOptions}
            />
            <button
              type="button"
              onClick={() => void createRule()}
              disabled={!draft.pattern || !draft.categoryId}
              className="h-10 rounded-lg border border-border bg-card px-4 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              Criar
            </button>
          </div>

          <div className="mt-6 divide-y divide-border/80">
            {rules.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                categories={categories}
                onChanged={onChanged}
              />
            ))}
            {rules.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">
                Nenhuma regra criada ainda.
              </p>
            )}
          </div>

          {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}
        </>
      )}
    </Panel>
  );
}

function RuleRow({
  rule,
  categories,
  onChanged,
}: {
  rule: ApiCategoryRule;
  categories: ApiCategory[];
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState<CategoryRuleInput>({
    pattern: rule.pattern,
    matchType: rule.matchType,
    categoryId: rule.categoryId,
    descriptionClean: rule.descriptionClean ?? "",
    paymentMethod: rule.paymentMethod,
  });

  async function saveRule() {
    await api.updateCategoryRule(rule.id, {
      ...draft,
      descriptionClean: draft.descriptionClean || null,
      paymentMethod: draft.paymentMethod || null,
    });
    onChanged();
  }

  async function deleteRule() {
    await api.deleteCategoryRule(rule.id);
    onChanged();
  }

  return (
    <div className="grid gap-3 py-4 lg:grid-cols-[1fr_150px_190px_1fr_150px_auto_auto] lg:items-end">
      <RuleInput
        label="Padrão"
        value={draft.pattern}
        onChange={(value) => setDraft((current) => ({ ...current, pattern: value }))}
      />
      <RuleSelect
        label="Tipo"
        value={draft.matchType}
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            matchType: value as CategoryRuleInput["matchType"],
          }))
        }
        options={matchTypeOptions}
      />
      <RuleSelect
        label="Categoria"
        value={draft.categoryId}
        onChange={(value) => setDraft((current) => ({ ...current, categoryId: value }))}
        options={categories.map((category) => ({
          label: category.name,
          value: category.id,
        }))}
      />
      <RuleInput
        label="Descrição limpa"
        value={draft.descriptionClean ?? ""}
        onChange={(value) =>
          setDraft((current) => ({ ...current, descriptionClean: value }))
        }
      />
      <RuleSelect
        label="Forma"
        value={draft.paymentMethod ?? ""}
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            paymentMethod: value as CategoryRuleInput["paymentMethod"],
          }))
        }
        options={paymentMethodOptions}
      />
      <button
        type="button"
        onClick={() => void saveRule()}
        className="h-10 rounded-lg border border-border bg-card px-4 text-sm font-medium transition hover:bg-accent"
      >
        Salvar
      </button>
      <button
        type="button"
        onClick={() => void deleteRule()}
        className="flex h-10 items-center justify-center rounded-lg border border-rose-300/20 px-3 text-rose-200 transition hover:bg-rose-300/10"
        aria-label="Excluir regra"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  suffix,
  icon,
  onChange,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon?: React.ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-muted-foreground">{label}</span>
      <div className="flex h-11 items-center gap-3 rounded-lg border border-border bg-secondary/35 px-3 text-sm text-foreground">
        {icon}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
        {suffix && <span className="text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

function RuleInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-border bg-secondary/35 px-3 text-sm text-foreground outline-none transition focus:border-primary/50"
      />
    </label>
  );
}

function RuleSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-border bg-secondary/35 px-3 text-sm text-foreground outline-none transition focus:border-primary/50"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatBackupDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const matchTypeOptions = [
  { label: "Contém", value: "contains" },
  { label: "Começa com", value: "starts_with" },
  { label: "Igual", value: "equals" },
  { label: "Regex", value: "regex" },
];

const paymentMethodOptions = [
  { label: "Qualquer", value: "" },
  { label: "Conta", value: "account" },
  { label: "Débito", value: "debit" },
  { label: "Cartão", value: "credit" },
  { label: "Ajuste", value: "adjustment" },
];
