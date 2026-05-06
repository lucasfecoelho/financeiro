import { Banknote, CreditCard, FileText, Settings2, Wallet } from "lucide-react";
import type { NavItem } from "@/types";

export const navItems: NavItem[] = [
  { id: "inicio", label: "Início", icon: Wallet },
  { id: "importar", label: "Importar", icon: FileText },
  { id: "lancamentos", label: "Lançamentos", icon: Banknote },
  { id: "fatura-caixa", label: "Fatura Caixa", icon: CreditCard },
  { id: "configuracoes", label: "Configurações", icon: Settings2 },
];
