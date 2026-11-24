"use client";

import { notify, askConfirm } from "@/components/ui/feedback";
import { buttonClass } from "@/components/ui/button"
import { apiErrorMessage } from "@/lib/errors"
import { Dialog } from "@/components/ui/dialog"
import React, { useState, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { api, fetcher, fetcherResults } from "@/services/api";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  Filter,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  RefreshCw,
  Search,
  X,
  CreditCard,
  Building,
  CheckCircle2,
  AlertCircle,
  FolderPlus,
  Download,
} from "lucide-react";
import { downloadCsv, csvMoney } from "@/lib/csv";
import { PageHeader, StatStrip, StatusTag, TabBar } from "@/components/ui/blocks";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Category {
  id: number;
  name: string;
  type: "receita" | "despesa";
  description?: string;
}

interface Lancamento {
  id: number;
  type: "receita" | "despesa";
  value: string | number;
  description: string;
  date: string;
  payment_method: string;
  category: number;
  category_name?: string;
  category_details?: Category;
  responsible?: number;
  responsible_name?: string;
  pedido?: number | null;
}

interface Resumo {
  total_receitas: string | number;
  total_despesas: string | number;
  saldo: string | number;
}

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  cartao_debito: "Cartão Débito",
  cartao_credito: "Cartão Crédito",
  pix: "Pix",
  outros: "Outros",
};

export default function FinancePage() {
  // Estados de Filtro
  const [periodo, setPeriodo] = useState<"hoje" | "7d" | "mes" | "ano" | "todos" | "custom">("mes");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "receita" | "despesa">("todos");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  // Modais
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [showCatModal, setShowCatModal] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Novo Lançamento
  const [formType, setFormType] = useState<"receita" | "despesa">("receita");
  const [formValue, setFormValue] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formCategory, setFormCategory] = useState<string>("");
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [formPaymentMethod, setFormPaymentMethod] = useState<string>("pix");

  // Form Nova Categoria
  const [newCatName, setNewCatName] = useState<string>("");
  const [newCatType, setNewCatType] = useState<"receita" | "despesa">("despesa");
  const [newCatDesc, setNewCatDesc] = useState<string>("");

  // Determinar datas conforme período selecionado
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    const today = new Date();

    if (periodo === "hoje") {
      const dateStr = today.toISOString().split("T")[0];
      params.append("inicio", dateStr);
      params.append("fim", dateStr);
    } else if (periodo === "7d") {
      const past = new Date(today);
      past.setDate(past.getDate() - 7);
      params.append("inicio", past.toISOString().split("T")[0]);
      params.append("fim", today.toISOString().split("T")[0]);
    } else if (periodo === "mes") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      params.append("inicio", firstDay.toISOString().split("T")[0]);
      params.append("fim", today.toISOString().split("T")[0]);
    } else if (periodo === "ano") {
      const firstDay = new Date(today.getFullYear(), 0, 1);
      params.append("inicio", firstDay.toISOString().split("T")[0]);
      params.append("fim", today.toISOString().split("T")[0]);
    } else if (periodo === "custom") {
      if (dataInicio) params.append("inicio", dataInicio);
      if (dataFim) params.append("fim", dataFim);
    }

    if (tipoFiltro !== "todos") {
      params.append("tipo", tipoFiltro);
    }
    if (categoriaFiltro) {
      params.append("categoria", categoriaFiltro);
    }

    return params.toString();
  }, [periodo, dataInicio, dataFim, tipoFiltro, categoriaFiltro]);

  const summaryParams = useMemo(() => {
    const params = new URLSearchParams();
    const today = new Date();

    if (periodo === "hoje") {
      const dateStr = today.toISOString().split("T")[0];
      params.append("inicio", dateStr);
      params.append("fim", dateStr);
    } else if (periodo === "7d") {
      const past = new Date(today);
      past.setDate(past.getDate() - 7);
      params.append("inicio", past.toISOString().split("T")[0]);
      params.append("fim", today.toISOString().split("T")[0]);
    } else if (periodo === "mes") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      params.append("inicio", firstDay.toISOString().split("T")[0]);
      params.append("fim", today.toISOString().split("T")[0]);
    } else if (periodo === "ano") {
      const firstDay = new Date(today.getFullYear(), 0, 1);
      params.append("inicio", firstDay.toISOString().split("T")[0]);
      params.append("fim", today.toISOString().split("T")[0]);
    } else if (periodo === "custom") {
      if (dataInicio) params.append("inicio", dataInicio);
      if (dataFim) params.append("fim", dataFim);
    }

    return params.toString();
  }, [periodo, dataInicio, dataFim]);

  // Consultas SWR
  const summaryUrl = `/finance/summary/${summaryParams ? `?${summaryParams}` : ""}`;
  const lancamentosUrl = `/finance/lancamentos/${queryParams ? `?${queryParams}` : ""}`;

  const { data: resumo, isLoading: loadingResumo } = useSWR<Resumo>(summaryUrl, fetcher);
  const { data: lancamentosRaw, isLoading: loadingLancamentos } = useSWR<any>(lancamentosUrl, fetcher);
  const { data: categoriesRaw } = useSWR<any>("/finance/categories/", fetcher);

  // Extrair arrays com segurança
  const lancamentos: Lancamento[] = useMemo(() => {
    if (!lancamentosRaw) return [];
    if (Array.isArray(lancamentosRaw)) return lancamentosRaw;
    if (lancamentosRaw.results && Array.isArray(lancamentosRaw.results)) return lancamentosRaw.results;
    return [];
  }, [lancamentosRaw]);

  const categories: Category[] = useMemo(() => {
    if (!categoriesRaw) return [];
    if (Array.isArray(categoriesRaw)) return categoriesRaw;
    if (categoriesRaw.results && Array.isArray(categoriesRaw.results)) return categoriesRaw.results;
    return [];
  }, [categoriesRaw]);

  // Filtro de texto no frontend
  const filteredLancamentos = useMemo(() => {
    return lancamentos.filter((l) => {
      const matchSearch =
        search === "" ||
        l.description.toLowerCase().includes(search.toLowerCase()) ||
        (l.category_name && l.category_name.toLowerCase().includes(search.toLowerCase())) ||
        (l.responsible_name && l.responsible_name.toLowerCase().includes(search.toLowerCase()));
      return matchSearch;
    });
  }, [lancamentos, search]);

  const exportCsv = () => {
    const rows: unknown[][] = [
      ["Data", "Tipo (Receita/Despesa)", "Categoria", "Descrição", "Forma de Pagamento", "Valor (R$)", "Responsável"],
    ];
    let receitas = 0;
    let despesas = 0;
    filteredLancamentos.forEach((l) => {
      const v = Number(l.value) || 0;
      if (l.type === "receita") receitas += v;
      else despesas += v;
      rows.push([
        l.date.split("-").reverse().join("/"),
        l.type === "receita" ? "Receita" : "Despesa",
        l.category_name || "",
        l.description,
        PAYMENT_LABELS[l.payment_method] || l.payment_method,
        csvMoney(v),
        l.responsible_name || "Sistema",
      ]);
    });
    rows.push([]);
    rows.push(["", "", "", "", "Total de Receitas", csvMoney(receitas), ""]);
    rows.push(["", "", "", "", "Total de Despesas", csvMoney(despesas), ""]);
    rows.push(["", "", "", "", "Saldo Líquido", csvMoney(receitas - despesas), ""]);
    downloadCsv(`relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  // Dados para Gráfico de Fluxo de Caixa por Data
  const chartData = useMemo(() => {
    const map: Record<string, { date: string; receitas: number; despesas: number }> = {};
    lancamentos.forEach((l) => {
      const d = l.date || "N/D";
      if (!map[d]) {
        map[d] = { date: d, receitas: 0, despesas: 0 };
      }
      const val = Number(l.value) || 0;
      if (l.type === "receita") {
        map[d].receitas += val;
      } else {
        map[d].despesas += val;
      }
    });

    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [lancamentos]);

  // Formatação
  const formatCurrency = (val: string | number | undefined) => {
    const num = Number(val) || 0;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Handlers
  const handleCreateLancamento = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const numVal = parseFloat(formValue.replace(",", "."));
    if (isNaN(numVal) || numVal <= 0) {
      setErrorMessage("Informe um valor numérico válido e maior que zero.");
      return;
    }
    if (!formCategory) {
      setErrorMessage("Selecione uma categoria financeira.");
      return;
    }
    if (!formDescription.trim()) {
      setErrorMessage("A descrição é obrigatória.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/finance/lancamentos/", {
        type: formType,
        value: numVal.toFixed(2),
        description: formDescription.trim(),
        date: formDate,
        payment_method: formPaymentMethod,
        category: parseInt(formCategory),
      });

      setSuccessMessage("Lançamento cadastrado com sucesso!");
      setFormValue("");
      setFormDescription("");
      setShowNewModal(false);
      mutate(summaryUrl);
      mutate(lancamentosUrl);
    } catch (err: any) {
      setErrorMessage(apiErrorMessage(err, "Não foi possível salvar o lançamento. Confira os dados."));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLancamento = async (id: number) => {
    if (!(await askConfirm("Tem certeza que deseja excluir este lançamento financeiro?"))) return;

    try {
      await api.delete(`/finance/lancamentos/${id}/`);
      mutate(summaryUrl);
      mutate(lancamentosUrl);
    } catch (err: any) {
      notify(apiErrorMessage(err, "Não foi possível excluir o lançamento."));
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      await api.post("/finance/categories/", {
        name: newCatName.trim(),
        type: newCatType,
        description: newCatDesc.trim(),
      });
      setNewCatName("");
      setNewCatDesc("");
      mutate("/finance/categories/");
    } catch (err: any) {
      notify(apiErrorMessage(err, "Não foi possível cadastrar a categoria. O nome pode já existir."));
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!(await askConfirm("Excluir esta categoria financeira?"))) return;

    try {
      await api.delete(`/finance/categories/${id}/`);
      mutate("/finance/categories/");
    } catch (err: any) {
      notify(apiErrorMessage(err, "Não é possível excluir uma categoria que possui lançamentos."));
    }
  };

  const totalReceitas = Number(resumo?.total_receitas) || 0;
  const totalDespesas = Number(resumo?.total_despesas) || 0;
  const saldoLiquido = Number(resumo?.saldo) || 0;

  return (
    <div className="flex min-h-full w-full flex-col bg-canvas p-6 text-ink">
      {/* Top Header */}
      <PageHeader
        title="Financeiro"
        description="Receitas, despesas e fluxo de caixa do período."
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                mutate(summaryUrl);
                mutate(lancamentosUrl);
              }}
              className={buttonClass("outline")}
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => setShowCatModal(true)}
              className={buttonClass("outline")}
            >
              <Layers className="h-4 w-4" />
              Categorias
            </button>
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className={buttonClass("primary")}
            >
              <Plus className="h-4 w-4" />
              Novo lançamento
            </button>
          </>
        }
      />

      <div className="my-6">
        <StatStrip
          items={[
            { label: "Receitas", value: loadingResumo ? "…" : formatCurrency(totalReceitas), hint: "Entradas de pedidos e vendas", tone: "success" },
            { label: "Despesas", value: loadingResumo ? "…" : formatCurrency(totalDespesas), hint: "Insumos, compras e custos", tone: "danger" },
            {
              label: "Saldo do período",
              value: loadingResumo ? "…" : formatCurrency(saldoLiquido),
              hint: saldoLiquido >= 0 ? "Resultado positivo" : "Resultado negativo",
              tone: saldoLiquido >= 0 ? "accent" : "danger",
            },
          ]}
        />
      </div>

      {/* Gráfico de Fluxo de Caixa */}
      {chartData.length > 0 && (
        <section className="mb-8">
          <div className="mb-4 flex items-end justify-between border-b-2 border-ink pb-2">
            <h2 className="text-3xl text-ink">Receitas e despesas por dia</h2>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-success font-semibold">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-success" /> Receitas
              </span>
              <span className="flex items-center gap-1.5 text-danger font-semibold">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-danger" /> Despesas
              </span>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--c-line)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--c-muted)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--c-muted)" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--c-surface)",
                    borderColor: "var(--c-line-strong)",
                    borderRadius: "4px",
                    color: "var(--c-ink)",
                    fontSize: "12px",
                  }}
                  formatter={(val: any) => formatCurrency(val)}
                />
                <Bar dataKey="receitas" fill="var(--c-success)" radius={[2, 2, 0, 0]} name="Receitas" />
                <Bar dataKey="despesas" fill="var(--c-danger)" radius={[2, 2, 0, 0]} name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Barra de Filtros e Busca */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <TabBar
            label="Período"
            value={periodo as string}
            onChange={(v) => setPeriodo(v as any)}
            tabs={[
              { value: "hoje", label: "Hoje" },
              { value: "7d", label: "7 dias" },
              { value: "mes", label: "Mês atual" },
              { value: "ano", label: "Ano" },
              { value: "todos", label: "Tudo" },
              { value: "custom", label: "Personalizado" },
            ]}
          />

          <div className="flex items-center gap-2">
            <select
              aria-label="Filtrar por tipo"
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value as any)}
              className="h-10 rounded-lg border border-line-strong bg-canvas px-3 text-sm text-ink focus:border-accent focus:outline-none"
            >
              <option value="todos">Receitas e despesas</option>
              <option value="receita">Só receitas</option>
              <option value="despesa">Só despesas</option>
            </select>
            <select
              aria-label="Filtrar por categoria"
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="h-10 rounded-lg border border-line-strong bg-canvas px-3 text-sm text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Linha adicional se período personalizado */}
        {periodo === "custom" && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-soft">De:</span>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="h-10 rounded-lg border border-line-strong bg-canvas px-3 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-soft">Até:</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="h-10 rounded-lg border border-line-strong bg-canvas px-3 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Busca por Texto */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" aria-hidden />
          <input
            type="text"
            placeholder="Buscar por descrição, categoria ou responsável"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar lançamentos" className="h-10 w-full rounded-lg border border-line-strong bg-canvas pl-9 pr-4 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {/* Tabela de Lançamentos */}
      <div className="flex-1">
        <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
          <h2 className="text-3xl text-ink">
            Lançamentos <span className="font-display text-accent">{filteredLancamentos.length}</span>
          </h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={exportCsv}
              disabled={filteredLancamentos.length === 0}
              className={buttonClass("outline")}
            >
              <Download className="h-3.5 w-3.5" />
              Exportar relatório (CSV)
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-ink text-sm font-bold text-ink">
              <tr>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Pagamento</th>
                <th className="py-3 px-4">Responsável</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40 text-soft">
              {loadingLancamentos ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted">
                    Carregando lançamentos...
                  </td>
                </tr>
              ) : filteredLancamentos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted">
                    Nenhum lançamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredLancamentos.map((l) => (
                  <tr key={l.id} className="transition-colors hover:bg-raised/40">
                    <td className="whitespace-nowrap py-3 px-4 text-soft">{formatDate(l.date)}</td>
                    <td className="py-3 px-4">
                      <StatusTag tone={l.type === "receita" ? "success" : "danger"}>
                        {l.type === "receita" ? "Receita" : "Despesa"}
                      </StatusTag>
                    </td>
                    <td className="py-3 px-4 font-medium text-ink">
                      {l.description}
                      {l.pedido && (
                        <span className="ml-2 text-xs font-semibold text-muted">pedido {l.pedido}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-soft">
                      {l.category_name || (l.category_details ? l.category_details.name : `Cat #${l.category}`)}
                    </td>
                    <td className="py-3 px-4 text-soft">
                      {PAYMENT_LABELS[l.payment_method] || l.payment_method}
                    </td>
                    <td className="py-3 px-4 text-soft">
                      {l.responsible_name || "Sistema"}
                    </td>
                    <td className="whitespace-nowrap py-3 px-4 text-right">
                      <span className={`font-display text-2xl ${l.type === "receita" ? "text-success" : "text-danger"}`}>
                        {l.type === "receita" ? "+" : "−"}
                        {formatCurrency(l.value)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDeleteLancamento(l.id)}
                        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                        title="Excluir lançamento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Novo Lançamento */}
      {showNewModal && (
        <Dialog label="Novo lançamento" onClose={() => setShowNewModal(false)}>
          <div className="relative w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <button
              onClick={() => setShowNewModal(false)}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-soft hover:bg-raised hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-3xl text-ink">Novo lançamento</h3>
            <p className="mb-4 text-xs text-soft">
              Adicione uma receita ou despesa manual ao fluxo financeiro.
            </p>

            {errorMessage && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleCreateLancamento} className="space-y-4 text-xs">
              {/* Toggle Tipo */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormType("receita");
                      setFormCategory("");
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 font-bold transition-colors ${
                      formType === "receita"
                        ? "bg-success text-accent-ink "
                        : "border border-line bg-canvas text-soft hover:bg-raised"
                    }`}
                  >
                    <ArrowUpRight className="h-4 w-4" /> Receita
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormType("despesa");
                      setFormCategory("");
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 font-bold transition-colors ${
                      formType === "despesa"
                        ? "bg-danger text-accent-ink "
                        : "border border-line bg-canvas text-soft hover:bg-raised"
                    }`}
                  >
                    <ArrowDownRight className="h-4 w-4" /> Despesa
                  </button>
                </div>
              </div>

              {/* Valor e Data */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="f-appfinancepage-1" className="mb-1.5 block text-sm font-semibold text-ink">Valor (R$)*</label>
                  <input id="f-appfinancepage-1"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    className="h-11 w-full rounded-lg border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="f-appfinancepage-2" className="mb-1.5 block text-sm font-semibold text-ink">Data*</label>
                  <input id="f-appfinancepage-2"
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="h-11 w-full rounded-lg border border-line-strong bg-canvas px-3 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              {/* Categoria */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="font-semibold text-soft">Categoria Financeira*</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewModal(false);
                      setShowCatModal(true);
                    }}
                    className="text-xs text-accent hover:underline"
                  >
                    + Criar categoria
                  </button>
                </div>
                <select
                  required
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="h-11 w-full rounded-lg border border-line-strong bg-canvas px-3 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  <option value="">Selecione uma categoria...</option>
                  {categories
                    .filter((c) => c.type === formType)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Descrição */}
              <div>
                <label htmlFor="f-appfinancepage-3" className="mb-1.5 block text-sm font-semibold text-ink">Descrição*</label>
                <input id="f-appfinancepage-3"
                  type="text"
                  required
                  placeholder="Ex: Pagamento Fornecedor de Embalagens"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="h-11 w-full rounded-lg border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                />
              </div>

              {/* Forma de Pagamento */}
              <div>
                <label htmlFor="f-appfinancepage-4" className="mb-1.5 block text-sm font-semibold text-ink">Forma de pagamento</label>
                <select id="f-appfinancepage-4"
                  value={formPaymentMethod}
                  onChange={(e) => setFormPaymentMethod(e.target.value)}
                  className="h-11 w-full rounded-lg border border-line-strong bg-canvas px-3 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botões de Ação */}
              <div className="mt-6 flex justify-end gap-2 border-t border-line/60 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-soft hover:bg-raised hover:text-ink"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2 text-xs font-bold text-accent-ink  hover:bg-accent-hover disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Salvar lançamento"}
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* Modal Gerenciar Categorias */}
      {showCatModal && (
        <Dialog label="Categorias financeiras" onClose={() => setShowCatModal(false)}>
          <div className="relative w-full max-w-xl rounded-2xl border border-line bg-surface p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <button
              onClick={() => setShowCatModal(false)}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-soft hover:bg-raised hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-3xl text-ink">Categorias financeiras</h3>
            <p className="mb-4 text-xs text-soft">
              Gerencie as categorias de receitas e despesas do estabelecimento.
            </p>

            {/* Formulário Nova Categoria */}
            <form
              onSubmit={handleCreateCategory}
              className="mb-4 rounded-xl border border-line bg-canvas p-4 text-xs space-y-3"
            >
              <h4 className="font-bold text-ink">Adicionar categoria</h4>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Nome (ex: Marketing)"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="col-span-2 h-9 rounded-xl border border-line bg-surface px-3 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                />
                <select
                  value={newCatType}
                  onChange={(e) => setNewCatType(e.target.value as any)}
                  className="h-9 rounded-xl border border-line bg-surface px-2.5 text-xs text-ink focus:border-accent focus:outline-none"
                >
                  <option value="despesa">Despesa</option>
                  <option value="receita">Receita</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Descrição opcional..."
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="flex-1 h-9 rounded-xl border border-line bg-surface px-3 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-accent-ink hover:bg-accent-hover"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </button>
              </div>
            </form>

            {/* Lista de Categorias */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <h4 className="text-xs font-bold text-soft   mb-2">
                Categorias Cadastradas ({categories.length})
              </h4>
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-line/80 bg-canvas/60 p-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink">{c.name}</span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-bold  ${
                          c.type === "receita"
                            ? "bg-success/10 text-success border border-success/20"
                            : "bg-danger/10 text-danger border border-danger/20"
                        }`}
                      >
                        {c.type}
                      </span>
                    </div>
                    {c.description && <p className="text-xs text-muted mt-0.5">{c.description}</p>}
                  </div>
                  <button
                    onClick={() => handleDeleteCategory(c.id)}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    title="Excluir categoria"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end border-t border-line/60 pt-3">
              <button
                type="button"
                onClick={() => setShowCatModal(false)}
                className="rounded-xl bg-raised px-4 py-2 text-xs font-semibold text-ink hover:bg-line-strong"
              >
                Fechar
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
