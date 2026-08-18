import {
  ShoppingCart,
  DollarSign,
  Package,
  ClipboardList,
  Bot,
  type LucideIcon,
} from "lucide-react";

export interface KpiCardData {
  title: string;
  value: string;
  icon: LucideIcon;
  iconClassName: string;
  footer: { text: string; className: string; href?: string };
}

export const kpiCards: KpiCardData[] = [
  {
    title: "Pedidos do Dia",
    value: "32",
    icon: ShoppingCart,
    iconClassName: "text-yellow-400",
    footer: { text: "+12% vs ontem", className: "text-green-400" },
  },
  {
    title: "Faturamento do Dia",
    value: "R$ 1.248,50",
    icon: DollarSign,
    iconClassName: "text-yellow-400",
    footer: { text: "+18% vs ontem", className: "text-green-400" },
  },
  {
    title: "Itens em Estoque",
    value: "128",
    icon: Package,
    iconClassName: "text-yellow-400",
    footer: { text: "12 críticos", className: "text-red-400" },
  },
  {
    title: "Pedidos em Aberto",
    value: "5",
    icon: ClipboardList,
    iconClassName: "text-yellow-400",
    footer: { text: "Ver pedidos", className: "text-yellow-400 hover:underline", href: "#" },
  },
  {
    title: "Automação (RPA)",
    value: "100%",
    icon: Bot,
    iconClassName: "text-white",
    footer: { text: "Todas as rotinas OK", className: "text-green-400" },
  },
];