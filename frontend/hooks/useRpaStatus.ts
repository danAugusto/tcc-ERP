import useSWR from "swr"
import { fetcher } from "../services/api"

export interface RpaLog {
  id: number
  acao: string
  detalhes: string
  data: string
  username: string
}

export const RPA_ACTIONS: Record<string, string> = {
  "rpa-01": "RPA_SINCRONIZACAO_PEDIDOS",
  "rpa-02": "RPA_ALERTA_ESTOQUE",
  "rpa-03": "RPA_CONCILIACAO_CAIXA",
}

/** Histórico real das execuções dos robôs, lido da trilha de auditoria (somente administrador). */
export function useRpaStatus(enabled = true) {
  const { data, mutate, isLoading } = useSWR<RpaLog[]>(
    enabled ? "/core/auditoria/?page_size=200" : null,
    fetcher,
    { refreshInterval: 30000 }
  )
  const logs = (Array.isArray(data) ? data : []).filter((l) => l.acao.startsWith("RPA_"))
  const today = new Date().toDateString()
  return {
    logs,
    isLoading,
    refresh: mutate,
    lastRun: logs[0]?.data ?? null,
    lastRunOf: (taskId: string) => logs.find((l) => l.acao === RPA_ACTIONS[taskId])?.data ?? null,
    countOf: (taskId: string) => logs.filter((l) => l.acao === RPA_ACTIONS[taskId]).length,
    runsToday: logs.filter((l) => new Date(l.data).toDateString() === today).length,
  }
}

export const formatRun = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "Nunca executado"
