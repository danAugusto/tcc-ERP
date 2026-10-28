"use client";

import { notify, askConfirm } from "@/components/ui/feedback";
import { brl } from "@/lib/format"
import { buttonClass } from "@/components/ui/button"
import { apiErrorMessage } from "@/lib/errors"
import { Dialog } from "@/components/ui/dialog"
import React, { useState } from "react";
import useSWR, { mutate } from "swr";
import { api, fetcher } from "@/services/api";
import { PageHeader, StatusTag, TabBar } from "@/components/ui/blocks";
import { AuthGuard } from "@/components/auth/AuthGuard";
import {
  Users,
  ShieldCheck,
  Clock,
  History,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  DollarSign,
  Search,
  Filter,
  Eye,
  Lock,
  UserPlus,
  RefreshCw,
} from "lucide-react";

interface Funcionario {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: "administrador" | "atendente" | "cozinheiro" | "entregador" | "cliente";
  is_online: boolean;
  is_active: boolean;
  date_joined: string;
}

interface Turno {
  id: number;
  user: number;
  username: string;
  user_nome: string;
  user_role: string;
  inicio: string;
  fim: string | null;
  saldo_dinheiro: string | number;
  acerto_confirmado: boolean;
  duracao_minutos: number;
}

interface AuditoriaItem {
  id: number;
  user: number;
  username: string;
  acao: string;
  entidade: string;
  entidade_id: number;
  detalhes: string;
  data: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  administrador: { label: "Administrador", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  atendente: { label: "Atendente", color: "bg-info/20 text-info border-info/30" },
  cozinheiro: { label: "Cozinheiro", color: "bg-warn/20 text-warn border-warn/30" },
  entregador: { label: "Entregador", color: "bg-success/20 text-success border-success/30" },
  cliente: { label: "Cliente", color: "bg-muted/20 text-soft border-line/30" },
};

export default function EquipePage() {
  const [activeTab, setActiveTab] = useState<"equipe" | "turnos" | "auditoria">("equipe");
  const [search, setSearch] = useState("");

  // Modal Funcionário
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFuncionario, setEditingFuncionario] = useState<Funcionario | null>(null);
  const [formUsername, setFormUsername] = useState("");
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<string>("atendente");
  const [submitting, setSubmitting] = useState(false);

  // SWR Fetching
  const { data: funcionarios, mutate: mutateFuncionarios } = useSWR<Funcionario[]>(
    "/users/funcionarios/",
    fetcher
  );
  const { data: turnos, mutate: mutateTurnos } = useSWR<Turno[]>(
    "/core/turnos/",
    fetcher,
    { refreshInterval: 10000 }
  );
  const { data: auditoria } = useSWR<AuditoriaItem[]>(
    "/core/auditoria/",
    fetcher,
    { refreshInterval: 10000 }
  );

  const openCreateModal = () => {
    setEditingFuncionario(null);
    setFormUsername("");
    setFormFirstName("");
    setFormLastName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("atendente");
    setIsModalOpen(true);
  };

  const openEditModal = (func: Funcionario) => {
    setEditingFuncionario(func);
    setFormUsername(func.username);
    setFormFirstName(func.first_name);
    setFormLastName(func.last_name);
    setFormEmail(func.email);
    setFormPassword("");
    setFormRole(func.role);
    setIsModalOpen(true);
  };

  const handleSaveFuncionario = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: any = {
        username: formUsername,
        first_name: formFirstName,
        last_name: formLastName,
        email: formEmail,
        role: formRole,
      };
      if (formPassword) payload.password = formPassword;

      if (editingFuncionario) {
        await api.patch(`/users/funcionarios/${editingFuncionario.id}/`, payload);
      } else {
        await api.post("/users/funcionarios/", payload);
      }

      await mutateFuncionarios();
      setIsModalOpen(false);
    } catch (err: any) {
      notify(apiErrorMessage(err, "Erro ao salvar funcionário."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (func: Funcionario) => {
    try {
      await api.patch(`/users/funcionarios/${func.id}/`, {
        is_active: !func.is_active,
      });
      await mutateFuncionarios();
    } catch (err: any) {
      notify("Erro ao alterar status do funcionário.");
    }
  };

  const handleConfirmarAcerto = async (turnoId: number) => {
    if (!(await askConfirm("Confirmar o recebimento do dinheiro deste entregador?"))) return;
    try {
      await api.post(`/core/turnos/${turnoId}/confirmar-acerto/`);
      await mutateTurnos();
    } catch (err: any) {
      notify(apiErrorMessage(err, "Erro ao confirmar acerto."));
    }
  };

  return (
    <AuthGuard allowedRoles={["administrador"]}>
    <div className="flex-1 space-y-6 p-6 lg:p-8">
      <PageHeader
        title="Equipe"
        description="Funcionários, turnos e a trilha de auditoria das ações críticas."
        actions={
          activeTab === "equipe" ? (
            <button
              type="button"
              onClick={openCreateModal}
              className={buttonClass("primary")}
            >
              <UserPlus className="h-4 w-4" />
              Novo funcionário
            </button>
          ) : undefined
        }
      />

      <TabBar
        label="Seções da equipe"
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { value: "equipe", label: "Equipe e acessos", count: funcionarios?.length || 0 },
          { value: "turnos", label: "Turnos e ponto", count: turnos?.length || 0 },
          { value: "auditoria", label: "Auditoria", count: auditoria?.length || 0 },
        ]}
      />

      {/* ABA 1: EQUIPE & ACESSOS */}
      {activeTab === "equipe" && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-ink text-sm font-bold text-ink">
              <tr>
                <th className="px-3 py-3">Funcionário</th>
                <th className="px-3 py-3">Perfil</th>
                <th className="px-3 py-3">E-mail</th>
                <th className="px-3 py-3">Disponibilidade</th>
                <th className="px-3 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(Array.isArray(funcionarios) ? funcionarios : []).map((func) => {
                const roleInfo = ROLE_LABELS[func.role] || { label: func.role, color: "" };
                return (
                  <tr key={func.id} className={func.is_active ? "" : "opacity-60"}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <span className="font-display flex h-10 w-10 items-center justify-center rounded-md bg-raised text-2xl text-ink" aria-hidden>
                          {func.first_name?.[0]?.toUpperCase() || func.username[0]?.toUpperCase()}
                        </span>
                        <div>
                          <p className="font-semibold text-ink">
                            {func.first_name ? `${func.first_name} ${func.last_name}` : func.username}
                          </p>
                          <p className="text-xs text-muted">@{func.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-semibold text-ink">{roleInfo.label}</td>
                    <td className="px-3 py-3 text-soft">{func.email || "Não informado"}</td>
                    <td className="px-3 py-3">
                      <StatusTag tone={func.is_online ? "success" : "neutral"}>
                        {func.is_online ? "Disponível" : "Indisponível"}
                      </StatusTag>
                      {!func.is_active && <p className="mt-0.5 text-xs font-semibold text-danger">Conta desativada</p>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(func)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-sm font-semibold text-ink hover:bg-raised"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(func)}
                          className={`inline-flex h-9 items-center rounded-lg border px-3 text-sm font-semibold ${
                            func.is_active
                              ? "border-danger/50 text-danger hover:bg-danger/10"
                              : "border-success/50 text-success hover:bg-success/10"
                          }`}
                        >
                          {func.is_active ? "Desativar" : "Reativar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ABA 2: TURNOS & PONTO */}
      {activeTab === "turnos" && (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-soft">
              <thead className="border-b-2 border-ink text-sm font-bold text-ink">
                <tr>
                  <th className="px-5 py-3.5">Funcionário</th>
                  <th className="px-5 py-3.5">Início</th>
                  <th className="px-5 py-3.5">Fim / Duração</th>
                  <th className="px-5 py-3.5">Dinheiro a repassar</th>
                  <th className="px-5 py-3.5">Acerto de caixa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {(Array.isArray(turnos) ? turnos : []).map((turno) => {
                  const isAberto = !turno.fim;
                  return (
                    <tr key={turno.id} className="hover:bg-raised/20">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-ink">{turno.user_nome}</div>
                        <div className="text-xs text-muted">@{turno.username} • {turno.user_role}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-ink font-medium">
                          {new Date(turno.inicio).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div className="text-xs text-muted">
                          {new Date(turno.inicio).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {isAberto ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-0.5 text-xs font-bold text-success border border-success/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-success" />
                            Em Turno ({turno.duracao_minutos} min)
                          </span>
                        ) : (
                          <div>
                            <span className="text-soft">
                              {new Date(turno.fim!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span className="ml-2 text-xs text-muted">({turno.duracao_minutos} min)</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 font-semibold text-ink">
                        {brl(turno.saldo_dinheiro)}
                      </td>
                      <td className="px-5 py-4">
                        {Number(turno.saldo_dinheiro) > 0 ? (
                          turno.acerto_confirmado ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                              <CheckCircle2 className="h-4 w-4" /> Confirmado
                            </span>
                          ) : (
                            <button
                              onClick={() => handleConfirmarAcerto(turno.id)}
                              className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent hover:text-accent-ink transition-colors"
                            >
                              Confirmar Acerto
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-muted">Sem pendências</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 3: TRILHA DE AUDITORIA */}
      {activeTab === "auditoria" && (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-soft">
              <thead className="border-b-2 border-ink text-sm font-bold text-ink">
                <tr>
                  <th className="px-5 py-3.5">Data / Hora</th>
                  <th className="px-5 py-3.5">Usuário</th>
                  <th className="px-5 py-3.5">Ação</th>
                  <th className="px-5 py-3.5">Registro afetado</th>
                  <th className="px-5 py-3.5">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {(Array.isArray(auditoria) ? auditoria : []).map((log) => (
                  <tr key={log.id} className="hover:bg-raised/20">
                    <td className="px-5 py-4 text-xs text-soft">
                      {new Date(log.data).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 font-semibold text-ink">
                      @{log.username}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-lg bg-raised px-2.5 py-1 text-xs font-bold text-accent border border-line">
                        {log.acao}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-soft">
                      {log.entidade} #{log.entidade_id}
                    </td>
                    <td className="px-5 py-4 text-xs text-soft max-w-md">
                      {log.detalhes || "Nenhum detalhe adicional"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL CRIAR / EDITAR FUNCIONÁRIO */}
      {isModalOpen && (
        <Dialog label={editingFuncionario ? "Editar funcionário" : "Novo funcionário"} onClose={() => setIsModalOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl   ">
            <h2 className="text-3xl text-ink">
              <Users className="h-5 w-5 text-accent" />
              {editingFuncionario ? "Editar funcionário" : "Novo funcionário"}
            </h2>

            <form onSubmit={handleSaveFuncionario} className="space-y-4">
              <div>
                <label htmlFor="f-appequipepage-1" className="block text-xs font-medium text-soft mb-1">Username (Login)</label>
                <input id="f-appequipepage-1"
                  type="text"
                  required
                  disabled={!!editingFuncionario}
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  className="w-full rounded-xl border border-line bg-raised/60 px-3.5 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="f-appequipepage-2" className="block text-xs font-medium text-soft mb-1">Nome</label>
                  <input id="f-appequipepage-2"
                    type="text"
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    className="w-full rounded-xl border border-line bg-raised/60 px-3.5 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="f-appequipepage-3" className="block text-xs font-medium text-soft mb-1">Sobrenome</label>
                  <input id="f-appequipepage-3"
                    type="text"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    className="w-full rounded-xl border border-line bg-raised/60 px-3.5 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="f-appequipepage-4" className="block text-xs font-medium text-soft mb-1">E-mail</label>
                <input id="f-appequipepage-4"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full rounded-xl border border-line bg-raised/60 px-3.5 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="f-appequipepage-5" className="block text-xs font-medium text-soft mb-1">Cargo / Role</label>
                <select id="f-appequipepage-5"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full rounded-xl border border-line bg-raised/60 px-3.5 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  <option value="atendente">Atendente</option>
                  <option value="cozinheiro">Cozinheiro</option>
                  <option value="entregador">Entregador</option>
                  <option value="administrador">Administrador</option>
                </select>
              </div>

              <div>
                <label htmlFor="f-appequipepage-6" className="block text-xs font-medium text-soft mb-1">
                  Senha {editingFuncionario && "(Deixe em branco para não alterar)"}
                </label>
                <input id="f-appequipepage-6"
                  type="password"
                  required={!editingFuncionario}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingFuncionario ? "••••••••" : "Mínimo 8 caracteres"}
                  className="w-full rounded-xl border border-line bg-raised/60 px-3.5 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-soft hover:bg-raised"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-ink hover:bg-accent-hover transition-colors"
                >
                  {submitting ? "Salvando..." : "Salvar funcionário"}
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}
    </div>
    </AuthGuard>
  );
}
