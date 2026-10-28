"use client";

import React, { useEffect, useState, useMemo } from "react";
import { buttonClass } from "@/components/ui/button"
import { apiErrorMessage } from "@/lib/errors"
import { 
  ShieldCheck, 
  KeyRound, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Sliders, 
  Info,
  Lock,
  Sparkles,
  Users,
  Shield,
  Check
} from "lucide-react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { PageHeader, StatStrip } from "@/components/ui/blocks";
import api from "@/services/api";

interface RoleOption {
  key: string;
  label: string;
  readonly?: boolean;
}

interface PermissaoItem {
  id: number;
  codigo: string;
  descricao: string;
  roles: string[];
}

interface ModuloGroup {
  modulo: string;
  permissoes: PermissaoItem[];
}

interface MatrixResponse {
  roles: RoleOption[];
  modulos: ModuloGroup[];
}

export default function PermissoesPage() {
  const [matrixData, setMatrixData] = useState<MatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchMatrix = async () => {
    try {
      setLoading(true);
      const res = await api.get<MatrixResponse>("/users/rbac/matrix/");
      setMatrixData(res.data);
    } catch (err: any) {
      console.error("Erro ao buscar matriz de permissões:", err);
      showToast("error", apiErrorMessage(err, "Erro ao carregar matriz de permissões."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, []);

  const showToast = (type: "success" | "error", text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleToggle = async (role: string, codigo: string, currentStatus: boolean) => {
    // Evita revogar GERENCIAR_USUARIOS do administrador
    if (role === "administrador" && codigo === "GERENCIAR_USUARIOS" && currentStatus) {
      showToast("error", "Não é permitido revogar a permissão de gerenciamento de usuários do administrador.");
      return;
    }

    const key = `${role}-${codigo}`;
    setUpdatingKey(key);
    const newStatus = !currentStatus;

    // Atualização otimista no estado local
    setMatrixData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        modulos: prev.modulos.map((mod) => ({
          ...mod,
          permissoes: mod.permissoes.map((p) => {
            if (p.codigo !== codigo) return p;
            const updatedRoles = newStatus
              ? Array.from(new Set([...p.roles, role]))
              : p.roles.filter((r) => r !== role);
            return { ...p, roles: updatedRoles };
          }),
        })),
      };
    });

    try {
      const res = await api.post("/users/rbac/toggle/", {
        role,
        permissao_codigo: codigo,
        conceder: newStatus,
      });
      showToast("success", res.data?.message || `Permissão ${codigo} atualizada para ${role}.`);
    } catch (err: any) {
      // Reverter atualização otimista em caso de erro
      console.error("Erro ao salvar permissão:", err);
      setMatrixData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          modulos: prev.modulos.map((mod) => ({
            ...mod,
            permissoes: mod.permissoes.map((p) => {
              if (p.codigo !== codigo) return p;
              const revertedRoles = currentStatus
                ? Array.from(new Set([...p.roles, role]))
                : p.roles.filter((r) => r !== role);
              return { ...p, roles: revertedRoles };
            }),
          })),
        };
      });
      showToast("error", apiErrorMessage(err, "Falha ao atualizar permissão no servidor."));
    } finally {
      setUpdatingKey(null);
    }
  };

  // Filtragem
  const filteredModulos = useMemo(() => {
    if (!matrixData || !Array.isArray(matrixData.modulos)) return [];
    if (!searchTerm.trim()) return matrixData.modulos;

    const term = searchTerm.toLowerCase();
    return matrixData.modulos
      .map((mod) => ({
        ...mod,
        permissoes: Array.isArray(mod.permissoes)
          ? mod.permissoes.filter(
              (p) =>
                p.codigo.toLowerCase().includes(term) ||
                p.descricao.toLowerCase().includes(term) ||
                mod.modulo.toLowerCase().includes(term)
            )
          : [],
      }))
      .filter((mod) => mod.permissoes.length > 0);
  }, [matrixData, searchTerm]);

  // Contadores
  const totalPermissoes = useMemo(() => {
    if (!matrixData || !Array.isArray(matrixData.modulos)) return 0;
    return matrixData.modulos.reduce(
      (acc, m) => acc + (Array.isArray(m.permissoes) ? m.permissoes.length : 0),
      0
    );
  }, [matrixData]);

  const roleColors: Record<string, string> = {
    administrador: "bg-danger/10 text-danger border-danger/30",
    atendente: "bg-info/10 text-info border-info/30",
    cozinheiro: "bg-warn/10 text-warn border-warn/30",
    entregador: "bg-success/10 text-success border-success/30",
    cliente: "bg-raised text-soft border-line",
  };

  return (
    <AuthGuard allowedRoles={["administrador"]}>
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-canvas p-6 text-ink">
        <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
          <PageHeader
            title="Permissões"
            description="Quem pode fazer o quê em cada perfil. Cada alteração vale na hora, em todo o sistema."
            actions={
              <button
                type="button"
                onClick={fetchMatrix}
                disabled={loading}
                className={buttonClass("outline")}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-accent" : ""}`} />
                Atualizar
              </button>
            }
          />

          {/* Toast de Feedback */}
          {toastMessage && (
            <div
              className={`flex items-center gap-3 rounded-2xl border p-4 text-xs font-medium transition-colors    duration-300 ${
                toastMessage.type === "success"
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-danger/30 bg-danger/10 text-danger"
              }`}
            >
              {toastMessage.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0" />
              )}
              <span>{toastMessage.text}</span>
            </div>
          )}

          <StatStrip
            items={[
              { label: "Perfis", value: matrixData?.roles.length || 0, hint: "Administrador, atendente, cozinheiro, entregador e cliente" },
              { label: "Permissões", value: totalPermissoes, hint: "Ações que podem ser liberadas ou bloqueadas" },
              { label: "Bloqueio no servidor", value: "Ativo", hint: "A API recusa com erro 403 mesmo se a tela for burlada", tone: "success" },
            ]}
          />

          {/* Barra de Busca e Filtro */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Buscar permissão, código ou módulo"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Buscar permissão"
                className="h-10 w-full rounded-lg border border-line-strong bg-canvas pl-10 pr-4 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Tabela Matriz */}
          {loading && !matrixData ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-accent" />
              <p className="mt-3 text-xs font-semibold text-soft">Carregando matriz de permissões do sistema...</p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-ink">
                      <th className="min-w-[280px] p-3 text-sm font-bold text-ink">
                        Funcionalidade / Ação
                      </th>
                      {matrixData?.roles.map((r) => (
                        <th key={r.key} className="min-w-[110px] p-3 text-center text-sm font-bold text-ink">
                          {r.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredModulos.map((mod) => (
                      <React.Fragment key={mod.modulo}>
                        {/* Header do Módulo */}
                        <tr>
                          <td
                            colSpan={(matrixData?.roles.length || 0) + 1}
                            className="pb-2 pt-6 font-display text-2xl text-ink"
                          >
                            {({ ADMINISTRACAO: "Administração", INVENTARIO: "Estoque", FINANCEIRO: "Financeiro", PEDIDOS: "Pedidos" } as Record<string, string>)[mod.modulo] ?? mod.modulo.charAt(0) + mod.modulo.slice(1).toLowerCase()}
                          </td>
                        </tr>

                        {/* Linhas de Permissões */}
                        {mod.permissoes.map((perm) => (
                          <tr
                            key={perm.codigo}
                            className="transition-colors hover:bg-raised/30"
                          >
                            <td className="p-3 align-middle">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-ink">{perm.descricao}</span>
                                </div>
                                <span className="text-xs text-muted">{perm.codigo}</span>
                              </div>
                            </td>

                            {/* Células de Roles com Switches */}
                            {matrixData?.roles.map((role) => {
                              const hasPerm = perm.roles.includes(role.key);
                              const isUpdating = updatingKey === `${role.key}-${perm.codigo}`;
                              const isLocked = role.key === "administrador" && perm.codigo === "GERENCIAR_USUARIOS";
                              const isReadonly = !!role.readonly;

                              return (
                                <td key={role.key} className="p-3 text-center align-middle">
                                  <div className="flex items-center justify-center">
                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={hasPerm}
                                      aria-label={`${perm.descricao} para ${role.label}`}
                                      disabled={isUpdating || isLocked || isReadonly}
                                      onClick={() => handleToggle(role.key, perm.codigo, hasPerm)}
                                      title={
                                        isReadonly
                                          ? "Permissões do cliente são pré-definidas e não editáveis"
                                          : isLocked
                                          ? "Permissão essencial e obrigatória para o Administrador"
                                          : hasPerm
                                          ? `Revogar de ${role.label}`
                                          : `Conceder a ${role.label}`
                                      }
                                      className={`flex h-8 w-8 items-center justify-center rounded-md border-2 transition-colors disabled:cursor-not-allowed ${
                                        hasPerm
                                          ? "border-accent bg-accent text-accent-ink"
                                          : "border-line-strong bg-transparent text-transparent hover:border-ink"
                                      } ${isReadonly || isLocked ? "opacity-50" : ""}`}
                                    >
                                      {isLocked ? (
                                        <Lock className="h-4 w-4" />
                                      ) : isUpdating ? (
                                        <RefreshCw className="h-4 w-4 animate-spin text-soft" />
                                      ) : (
                                        <Check className="h-5 w-5" strokeWidth={3} />
                                      )}
                                    </button>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredModulos.length === 0 && (
                <div className="p-8 text-center text-xs text-muted">
                  Nenhuma permissão encontrada com o termo &quot;{searchTerm}&quot;.
                </div>
              )}
            </div>
          )}

          {/* Dica de Boas Práticas */}
          <div className="flex items-start gap-3 border-t border-dashed border-line pt-4 text-sm text-soft">
            <div className="space-y-1">
              <p className="font-semibold text-ink">Como funciona</p>
              <p>
                Quando você altera um botão nesta matriz, o vínculo é imediatamente persistido no banco de dados. 
                Os validadores de segurança no Backend rejeitarão qualquer chamada com código <strong>403 Forbidden</strong> caso o perfil não possua acesso. 
                No Frontend, botões sensíveis (como Cancelar Pedido e Fechar Caixa) desaparecem dinamicamente da tela do colaborador correspondente.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
