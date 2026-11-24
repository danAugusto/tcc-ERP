"use client"

import { useState } from "react"
import { apiErrorMessage } from "@/lib/errors"
import { CheckCircle2, Play, RefreshCw, AlertTriangle } from "lucide-react"
import api from "../../services/api"
import { useRpaStatus, formatRun } from "../../hooks/useRpaStatus"
import { PageHeader, StatStrip } from "../../components/ui/blocks"

const rpaTasks = [
  {
    id: "rpa-01",
    name: "Sincronização de pedidos",
    description: "Confere os pedidos em andamento e recoloca na fila da cozinha os que ficaram sem preparo.",
    frequency: "A cada 30 min",
  },
  {
    id: "rpa-02",
    name: "Alerta de estoque crítico",
    description: "Varre os insumos e registra na auditoria os que estão no mínimo ou abaixo.",
    frequency: "A cada 1 hora",
  },
  {
    id: "rpa-03",
    name: "Conciliação do caixa do dia",
    description: "Soma as receitas e despesas do dia por forma de pagamento e compara o dinheiro com os turnos.",
    frequency: "Diário (Fim do turno)",
  },
]

export default function RpaPage() {
  const [runningId, setRunningId] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState("")
  const [errorNotice, setErrorNotice] = useState("")
  const rpa = useRpaStatus()

  const triggerRpa = async (id: string, name: string) => {
    setRunningId(id)
    setSuccessNotice("")
    setErrorNotice("")
    try {
      const res = await api.post("/core/rpa/execute/", { task_id: id })
      const d = res.data
      setSuccessNotice(`Robô executado: ${d.mensagem} (${d.tempo_ms} ms). Evidência registrada na auditoria.`)
      setTimeout(() => setSuccessNotice(""), 8000)
      rpa.refresh()
    } catch (err: any) {
      setErrorNotice(apiErrorMessage(err, `Falha ao executar a rotina "${name}".`))
      setTimeout(() => setErrorNotice(""), 8000)
    } finally {
      setRunningId(null)
    }
  }

  return (
    <div className="flex min-h-full flex-col gap-6 bg-canvas p-6 text-ink">
      <PageHeader
        title="Automações"
        description="Os robôs rodam quando você pede e deixam o resultado registrado na auditoria. Ainda não há agendamento automático."
      />

      {successNotice && (
        <p role="status" className="flex items-center gap-3 rounded-lg bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {successNotice}
        </p>
      )}
      {errorNotice && (
        <p role="alert" className="flex items-center gap-3 rounded-lg bg-danger/10 p-3 text-sm text-danger">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {errorNotice}
        </p>
      )}

      <StatStrip
        items={[
          { label: "Robôs disponíveis", value: rpaTasks.length },
          { label: "Execuções hoje", value: rpa.runsToday, hint: "Registradas na auditoria" },
          { label: "Última execução", value: formatRun(rpa.lastRun), hint: "Execução manual" },
        ]}
      />

      <section aria-label="Robôs">
        <h2 className="border-b-2 border-ink pb-2 text-3xl text-ink">Robôs</h2>
        <ul className="divide-y divide-line">
          {rpaTasks.map((task) => (
            <li key={task.id} className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="text-2xl text-ink">{task.name}</h3>
                <p className="mt-1 max-w-2xl text-sm text-soft">{task.description}</p>
                <p className="mt-2 text-sm text-muted">
                  Última execução: <span className="text-ink">{formatRun(rpa.lastRunOf(task.id))}</span>
                  {" · "}
                  {rpa.countOf(task.id)} no histórico
                  {" · "}
                  frequência recomendada: {task.frequency.toLowerCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => triggerRpa(task.id, task.name)}
                disabled={runningId === task.id}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-50"
              >
                {runningId === task.id ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Executando...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Executar agora
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
