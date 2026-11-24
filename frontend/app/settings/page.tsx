"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Save, CheckCircle2, ArrowRight } from "lucide-react";
import api, { BACKEND_ORIGIN } from "../../services/api";
import { useBranding } from "../../hooks/useBranding";
import { apiErrorMessage } from "@/lib/errors";
import { PageHeader, TabBar } from "../../components/ui/blocks";
import { buttonClass } from "../../components/ui/button";
import { LogoUploader } from "../../components/settings/LogoUploader";

type Tab = "general" | "orders" | "access";

const fieldClass =
  "h-11 w-full rounded-lg border border-line-strong bg-canvas px-3.5 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none";

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const { data, refresh } = useBranding();
  const [tab, setTab] = useState<Tab>("general");
  const [form, setForm] = useState({
    nome: "",
    telefone: "",
    endereco: "",
    cnpj: "",
    taxa_entrega: "0.00",
    tempo_entrega: "",
    tempo_retirada: "",
    pedido_minimo: "0.00",
    aceita_pedidos_online: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Preenche o formulário com o que está salvo no banco
  useEffect(() => {
    if (!data) return;
    setForm({
      nome: data.nome ?? "",
      telefone: data.telefone ?? "",
      endereco: data.endereco ?? "",
      cnpj: data.cnpj ?? "",
      taxa_entrega: data.taxa_entrega ?? "0.00",
      tempo_entrega: data.tempo_entrega ?? "",
      tempo_retirada: data.tempo_retirada ?? "",
      pedido_minimo: data.pedido_minimo ?? "0.00",
      aceita_pedidos_online: data.aceita_pedidos_online ?? true,
    });
  }, [data]);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      await api.patch("/core/estabelecimento/", form);
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err: any) {
      setError(apiErrorMessage(err, "Não foi possível salvar as configurações."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-full min-w-0 flex-1 flex-col bg-canvas p-4 text-ink md:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-6 pb-12">
        <PageHeader
          title="Configurações"
          description="Dados do estabelecimento e regras dos pedidos. Tudo aqui é salvo no sistema e vale na hora."
          actions={
            <button type="button" onClick={() => handleSave()} disabled={saving} className={buttonClass("primary")}>
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          }
        />

        {saved && (
          <p role="status" className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm font-medium text-success">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            Configurações salvas.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm font-medium text-danger">
            {error}
          </p>
        )}

        <TabBar
          label="Seções"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "general", label: "Estabelecimento" },
            { value: "orders", label: "Pedidos e entrega" },
            { value: "access", label: "Acessos" },
          ]}
        />

        <form onSubmit={handleSave} className="space-y-6">
          {tab === "general" && (
            <div className="space-y-6">
              <LogoUploader />
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field id="cfg-nome" label="Nome do estabelecimento" hint="Aparece no menu, no cardápio, no cupom e na aba do navegador.">
                  <input id="cfg-nome" className={fieldClass} value={form.nome} onChange={set("nome")} maxLength={60} required />
                </Field>
                <Field id="cfg-telefone" label="Telefone ou WhatsApp" hint="Sai no cupom do cliente.">
                  <input id="cfg-telefone" className={fieldClass} value={form.telefone} onChange={set("telefone")} maxLength={30} inputMode="tel" placeholder="(11) 90000-0000" />
                </Field>
                <Field id="cfg-endereco" label="Endereço" hint="Sai no cupom do cliente.">
                  <input id="cfg-endereco" className={fieldClass} value={form.endereco} onChange={set("endereco")} maxLength={200} placeholder="Rua, número, bairro, cidade" />
                </Field>
                <Field id="cfg-cnpj" label="CNPJ" hint="Opcional. Se vazio, o cupom não mostra CNPJ.">
                  <input id="cfg-cnpj" className={fieldClass} value={form.cnpj} onChange={set("cnpj")} maxLength={20} inputMode="numeric" placeholder="00.000.000/0000-00" />
                </Field>
              </div>
            </div>
          )}

          {tab === "orders" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field id="cfg-taxa" label="Taxa de entrega (R$)" hint="Somada ao total de todo pedido de delivery. Use 0 para entrega grátis.">
                  <input id="cfg-taxa" className={fieldClass} type="number" min="0" step="0.50" value={form.taxa_entrega} onChange={set("taxa_entrega")} />
                </Field>
                <Field id="cfg-minimo" label="Pedido mínimo no aplicativo (R$)" hint="Só vale para pedidos feitos pelo cliente. Use 0 para não exigir.">
                  <input id="cfg-minimo" className={fieldClass} type="number" min="0" step="1" value={form.pedido_minimo} onChange={set("pedido_minimo")} />
                </Field>
                <Field id="cfg-tempo-entrega" label="Tempo de entrega" hint="Mostrado ao cliente. Ex.: 30–40 min">
                  <input id="cfg-tempo-entrega" className={fieldClass} value={form.tempo_entrega} onChange={set("tempo_entrega")} maxLength={20} />
                </Field>
                <Field id="cfg-tempo-retirada" label="Tempo para retirada" hint="Mostrado ao cliente. Ex.: 15–20 min">
                  <input id="cfg-tempo-retirada" className={fieldClass} value={form.tempo_retirada} onChange={set("tempo_retirada")} maxLength={20} />
                </Field>
              </div>

              <div className="flex items-center justify-between gap-4 border-y border-line py-4">
                <div>
                  <p id="cfg-online-label" className="text-sm font-semibold text-ink">Aceitar pedidos pelo aplicativo</p>
                  <p className="text-xs text-muted">Desligado, o cardápio continua visível, mas o cliente não consegue finalizar. O balcão funciona normalmente.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.aceita_pedidos_online}
                  aria-labelledby="cfg-online-label"
                  onClick={() => setForm((f) => ({ ...f, aceita_pedidos_online: !f.aceita_pedidos_online }))}
                  className={`relative h-8 w-14 shrink-0 rounded-full border-2 transition-colors ${
                    form.aceita_pedidos_online ? "border-accent bg-accent" : "border-line-strong bg-raised"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-canvas transition-transform duration-150 ${
                      form.aceita_pedidos_online ? "translate-x-6" : "translate-x-0.5"
                    }`}
                    aria-hidden
                  />
                </button>
              </div>
            </div>
          )}

          {tab === "access" && (
            <ul className="divide-y divide-line border-y border-line">
              <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">Permissões por perfil</p>
                  <p className="text-xs text-muted">Quem pode cancelar pedidos, fechar caixa, ver faturamento ou editar estoque.</p>
                </div>
                <Link href="/permissoes" className={buttonClass("outline")}>
                  Abrir permissões
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </li>
              <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">Painel técnico (Django Admin)</p>
                  <p className="text-xs text-muted">Acesso de baixo nível aos dados. Use só para manutenção.</p>
                </div>
                <a href={`${BACKEND_ORIGIN}/admin/`} target="_blank" rel="noreferrer" className={buttonClass("outline")}>
                  Abrir painel técnico
                  <ArrowRight className="h-4 w-4" />
                </a>
              </li>
            </ul>
          )}
        </form>
      </div>
    </div>
  );
}
