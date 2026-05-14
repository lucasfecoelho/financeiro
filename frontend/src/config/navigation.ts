import { CreditCard, House, ReceiptText } from "lucide-react";
import type { NavItem } from "@/types";

export const navItems: NavItem[] = [
  { id: "inicio", label: "Início", icon: House },
  { id: "lancamentos", label: "Lançamentos", icon: ReceiptText },
  { id: "fatura-caixa", label: "Fatura", icon: CreditCard },
];
