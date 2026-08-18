export type OrderStatus = "Em preparo" | "Saiu para entrega" | "Concluído";
export type OrderType = "Salão" | "Delivery";

export interface Order {
  id: string;
  time: string;
  type: OrderType;
  customer: string;
  items: string;
  total: string;
  status: OrderStatus;
}

export const recentOrders: Order[] = [
  { id: "#0001", time: "10:02", type: "Delivery", customer: "Ana Souza", items: "3 itens", total: "R$ 42,50", status: "Em preparo" },
  { id: "#0002", time: "10:05", type: "Salão", customer: "Carlos Lima", items: "2 itens", total: "R$ 28,00", status: "Concluído" },
  { id: "#0003", time: "10:11", type: "Delivery", customer: "Marina Alves", items: "1 item", total: "R$ 18,90", status: "Saiu para entrega" },
  { id: "#0004", time: "10:14", type: "Salão", customer: "João Pedro", items: "4 itens", total: "R$ 57,30", status: "Em preparo" },
  { id: "#0005", time: "10:22", type: "Delivery", customer: "Fernanda Rocha", items: "2 itens", total: "R$ 33,00", status: "Concluído" },
  { id: "#0006", time: "10:30", type: "Salão", customer: "Lucas Martins", items: "5 itens", total: "R$ 74,20", status: "Em preparo" },
];

export type InventoryStatus = "Normal" | "Baixo" | "Crítico";

export interface InventoryItem {
  product: string;
  current: string;
  min: string;
  status: InventoryStatus;
}

export const inventoryControl: InventoryItem[] = [
  { product: "Farinha de trigo", current: "24 kg", min: "10 kg", status: "Normal" },
  { product: "Queijo mussarela", current: "6 kg", min: "8 kg", status: "Baixo" },
  { product: "Carne bovina", current: "1,2 kg", min: "5 kg", status: "Crítico" },
  { product: "Tomate", current: "3 kg", min: "4 kg", status: "Baixo" },
  { product: "Catupiry", current: "12 kg", min: "6 kg", status: "Normal" },
  { product: "Massa de pastel", current: "8 kg", min: "6 kg", status: "Normal" },
];

export interface InventoryEntry {
  product: string;
  supplier: string;
  quantity: string;
  date: string;
}

export const recentEntries: InventoryEntry[] = [
  { product: "Farinha de trigo", supplier: "Distribuidora Boa Safra", quantity: "25 kg", date: "12/05" },
  { product: "Queijo mussarela", supplier: "Laticínios Vale", quantity: "10 kg", date: "11/05" },
  { product: "Catupiry", supplier: "Laticínios Vale", quantity: "8 kg", date: "11/05" },
  { product: "Coca-cola 2L", supplier: "Bebidas Central", quantity: "24 un", date: "10/05" },
];

export interface CriticalItem {
  name: string;
  quantity: string;
  level: "Crítico" | "Atenção";
}

export const criticalStock: CriticalItem[] = [
  { name: "Carne Bovina", quantity: "1,2 kg", level: "Crítico" },
  { name: "Queijo", quantity: "6 kg", level: "Atenção" },
  { name: "Batata", quantity: "2 kg", level: "Crítico" },
  { name: "Ovo", quantity: "12 un", level: "Atenção" },
];

export interface RpaRoutine {
  name: string;
  time: string;
  status: "Sucesso";
}

export const rpaRoutines: RpaRoutine[] = [
  { name: "Sincronizar pedidos do PDV", time: "10:15", status: "Sucesso" },
  { name: "Atualizar estoque", time: "10:20", status: "Sucesso" },
  { name: "Emitir relatório diário", time: "10:30", status: "Sucesso" },
  { name: "Conciliar caixa", time: "10:40", status: "Sucesso" },
];

export interface DailyKpi {
  label: string;
  value: string;
  delta: string;
}

export const dailyReportKpis: DailyKpi[] = [
  { label: "Pedidos", value: "32", delta: "+12%" },
  { label: "Faturamento", value: "R$ 1.248,50", delta: "+18%" },
  { label: "Ticket Médio", value: "R$ 39,02", delta: "+5%" },
  { label: "Itens Vendidos", value: "84", delta: "+14%" },
];

export const chartData = [
  { time: "06h", value: 0 },
  { time: "08h", value: 320 },
  { time: "10h", value: 520 },
  { time: "12h", value: 1480 },
  { time: "14h", value: 820 },
  { time: "16h", value: 610 },
  { time: "18h", value: 980 },
  { time: "20h", value: 1320 },
  { time: "22h", value: 760 },
];