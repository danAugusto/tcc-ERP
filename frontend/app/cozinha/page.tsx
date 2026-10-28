"use client"

import { notify, askConfirm } from "@/components/ui/feedback";
import { formatDuration } from "@/lib/format"
import { useEffect, useRef, useState } from "react"
import useSWR, { mutate } from "swr"
import api, { fetcher } from "../../services/api"
import { Button, buttonClass } from "../../components/ui/button"
import { ReceiptPrintModal } from "../../components/orders/ReceiptPrintModal"
import { 
  ChefHat, 
  Clock, 
  CheckCircle2, 
  Flame, 
  RefreshCw, 
  Utensils, 
  Send,
  AlertCircle,
  Hash,
  MapPin,
  Volume2,
  VolumeX,
  Bell,
  Printer,
} from "lucide-react"

interface ItemPreparo {
  id: number
  produto: number
  produto_nome?: string
  quantidade: number
  preco_unitario: number | string
  subtotal: number | string
}

interface EnderecoPreparo {
  cep: string
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  uf: string
}

interface Preparo {
  id: number
  pedido_id: number
  pedido_status: string
  tipo_atendimento: string
  numero_mesa: string
  numero_comanda: string
  endereco?: EnderecoPreparo | null
  itens: ItemPreparo[]
  total: number | string
  status: "pendente" | "em_preparo" | "pronto" | "entregue"
  entered_at: string
  started_at: string | null
  finished_at: string | null
}

export default function CozinhaKDS() {
  const [filterStatus, setFilterStatus] = useState<string>("todos")
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [printOrder, setPrintOrder] = useState<Preparo | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const knownIds = useRef<Set<number> | null>(null)
  const audioCtx = useRef<AudioContext | null>(null)
  const soundRef = useRef(true)

  const { data: preparos, error, isLoading, isValidating } = useSWR<Preparo[]>(
    "/preparation/",
    fetcher,
    { refreshInterval: 4000 }
  )

  useEffect(() => {
    try {
      const saved = localStorage.getItem("kds-sound")
      if (saved !== null) {
        setSoundEnabled(saved === "on")
        soundRef.current = saved === "on"
      }
    } catch {}
  }, [])

  const playBell = () => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      if (!Ctx) return
      const ctx = audioCtx.current ?? (audioCtx.current = new Ctx())
      if (ctx.state === "suspended") ctx.resume()
      const now = ctx.currentTime
      // Dois tons harmônicos de sino: 587Hz (Ré5) e 880Hz (Lá5)
      ;[587, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const start = now + i * 0.18
        osc.type = "sine"
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.exponentialRampToValueAtTime(0.4, start + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.1)
        osc.connect(gain).connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 1.2)
      })
    } catch (err) {
      console.error("Falha ao tocar alerta sonoro:", err)
    }
  }

  const toggleSound = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    soundRef.current = next
    try {
      localStorage.setItem("kds-sound", next ? "on" : "off")
    } catch {}
    if (next) playBell() // também desbloqueia o áudio no navegador
  }

  // Detecta novos pedidos na fila e toca a campainha
  useEffect(() => {
    if (!Array.isArray(preparos)) return
    const current = preparos.filter((p) => p.status === "pendente" || p.status === "em_preparo")
    if (knownIds.current === null) {
      knownIds.current = new Set(preparos.map((p) => p.id))
      return
    }
    const known = knownIds.current
    const hasNew = current.some((p) => !known.has(p.id))
    preparos.forEach((p) => known.add(p.id))
    if (hasNew && soundRef.current) playBell()
  }, [preparos])

  const handleStart = async (id: number) => {
    setActionLoadingId(id)
    try {
      await api.post(`/preparation/${id}/start/`)
      mutate("/preparation/")
    } catch (err: any) {
      console.error("Erro ao iniciar preparo:", err)
      notify("Falha ao iniciar preparo do pedido.")
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleComplete = async (id: number) => {
    setActionLoadingId(id)
    try {
      await api.post(`/preparation/${id}/complete/`)
      mutate("/preparation/")
    } catch (err: any) {
      console.error("Erro ao concluir preparo:", err)
      notify("Falha ao marcar pedido como pronto.")
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDeliver = async (id: number) => {
    setActionLoadingId(id)
    try {
      await api.post(`/preparation/${id}/deliver/`)
      mutate("/preparation/")
    } catch (err: any) {
      console.error("Erro ao entregar preparo:", err)
      notify("Falha ao marcar pedido como entregue.")
    } finally {
      setActionLoadingId(null)
    }
  }

  const getTimeElapsed = (dateString: string) => {
    const diffMs = Date.now() - new Date(dateString).getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return "Agora mesmo"
    if (mins === 1) return "1 min atrás"
    return `${mins} min atrás`
  }

  const getMinutesCount = (dateString: string) => {
    return Math.floor((Date.now() - new Date(dateString).getTime()) / 60000)
  }

  const activeOrders = Array.isArray(preparos) ? preparos : []

  const filteredOrders = activeOrders.filter((order) => {
    if (filterStatus === "todos") return true
    return order.status === filterStatus
  })

  const countPendente = activeOrders.filter((p) => p.status === "pendente").length
  const countEmPreparo = activeOrders.filter((p) => p.status === "em_preparo").length
  const countPronto = activeOrders.filter((p) => p.status === "pronto").length

  const columns = [
    { id: "pendente", title: "Na fila", empty: "Nenhum pedido esperando.", orders: activeOrders.filter((p) => p.status === "pendente") },
    { id: "em_preparo", title: "No fogo", empty: "Nada em preparo.", orders: activeOrders.filter((p) => p.status === "em_preparo") },
    { id: "pronto", title: "Prontos", empty: "Nada pronto aguardando retirada.", orders: activeOrders.filter((p) => p.status === "pronto") },
  ]

  const stripe: Record<string, string> = {
    pendente: "bg-paper-line",
    em_preparo: "bg-accent",
    pronto: "bg-success",
  }

  const renderTicket = (order: Preparo) => {
    const minutes = getMinutesCount(order.entered_at)
    const isDelayed = minutes >= 15
    const isActionLoading = actionLoadingId === order.id
    const comanda = order.numero_comanda || String(order.pedido_id).padStart(4, "0")
    const local =
      order.tipo_atendimento === "delivery"
        ? "Delivery"
        : order.numero_mesa
        ? /^\d+$/.test(order.numero_mesa) ? `Mesa ${order.numero_mesa}` : order.numero_mesa
        : "Balcão"

    return (
      <article key={order.id} className="ticket flex flex-col px-4 pb-4 pt-5">
        <div className={`-mx-4 mb-3 h-1.5 ${stripe[order.status] ?? "bg-paper-line"}`} aria-hidden />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-[2.75rem] xl:text-[3.5rem]">{comanda}</p>
            <p className="mt-1.5 truncate text-lg font-bold leading-none">{local}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className={`font-display ${minutes < 60 ? "text-4xl" : "text-2xl"} ${isDelayed ? "animate-pulse text-paper-danger" : ""}`}>
              {formatDuration(minutes)}
            </p>
            <button
              type="button"
              onClick={() => setPrintOrder(order)}
              title="Imprimir comanda"
              aria-label="Imprimir comanda"
              className="mt-2 inline-flex items-center gap-1.5 rounded border border-paper-line px-2 py-1 text-xs font-semibold text-paper-muted hover:border-paper-ink hover:text-paper-ink"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </button>
          </div>
        </div>

        <div className="my-3 border-t-2 border-dashed border-paper-line" aria-hidden />

        <ul className="flex-1 space-y-1">
          {order.itens && order.itens.length > 0 ? (
            order.itens.map((item) => (
              <li key={item.id} className="flex items-baseline gap-3 leading-snug">
                <span className="font-display w-14 shrink-0 text-[2rem]">{item.quantidade}×</span>
                <span className="text-lg font-semibold">{item.produto_nome || `Item #${item.produto}`}</span>
              </li>
            ))
          ) : (
            <li className="text-sm text-paper-muted">Pedido sem itens listados.</li>
          )}
        </ul>

        {order.tipo_atendimento === "delivery" && order.endereco && (
          <div className="mt-3 border-l border-paper-line pl-3 text-sm leading-snug">
            <p className="font-bold">
              {order.endereco.logradouro}, {order.endereco.numero}
              {order.endereco.complemento ? ` (${order.endereco.complemento})` : ""}
            </p>
            <p className="text-paper-muted">
              {order.endereco.bairro}, {order.endereco.cidade}/{order.endereco.uf}
            </p>
          </div>
        )}

        <div className="mt-4">
          {order.status === "pendente" && (
            <button
              type="button"
              onClick={() => handleStart(order.id)}
              disabled={isActionLoading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-accent text-base font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-60"
            >
              {isActionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
              Iniciar preparo
            </button>
          )}
          {order.status === "em_preparo" && (
            <button
              type="button"
              onClick={() => handleComplete(order.id)}
              disabled={isActionLoading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-paper-ink text-base font-bold text-paper hover:opacity-90 disabled:opacity-60"
            >
              {isActionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Marcar como pronto
            </button>
          )}
          {order.status === "pronto" && order.tipo_atendimento === "delivery" && (
            <p className="flex h-12 w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-paper-line text-sm font-bold text-paper-muted">
              <Send className="h-4 w-4" />
              Aguardando entregador
            </p>
          )}
          {order.status === "pronto" && order.tipo_atendimento !== "delivery" && (
            <button
              type="button"
              onClick={() => handleDeliver(order.id)}
              disabled={isActionLoading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md border-2 border-paper-ink text-base font-bold text-paper-ink hover:bg-paper-ink hover:text-paper disabled:opacity-60"
            >
              {isActionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Entregar ao cliente
            </button>
          )}
        </div>
      </article>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas p-4 text-ink md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-dashed border-line pb-4">
        <div>
          <h1 className="text-5xl text-ink">Cozinha</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
            Atualiza sozinha a cada 4 segundos. Os pedidos seguem a ordem de chegada.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSound}
            title={soundEnabled ? "Silenciar o aviso sonoro" : "Ativar o aviso sonoro"}
            className={buttonClass("outline")}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-success" /> : <VolumeX className="h-4 w-4 text-danger" />}
            {soundEnabled ? "Som ligado" : "Som desligado"}
          </button>
          <button
            type="button"
            onClick={playBell}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3.5 text-sm font-semibold text-soft hover:bg-raised hover:text-ink"
          >
            <Bell className="h-4 w-4 text-accent" />
            Testar som
          </button>
          <button
            type="button"
            onClick={() => mutate("/preparation/")}
            disabled={isValidating}
            title="Atualizar agora"
            aria-label="Atualizar agora"
            className={buttonClass("outline", "icon")}
          >
            <RefreshCw className={`h-4 w-4 ${isValidating ? "animate-spin text-accent" : ""}`} />
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="mt-4 flex items-center gap-3 rounded-lg bg-danger/10 p-3 text-sm text-danger">
          <AlertCircle className="h-5 w-5 shrink-0" />
          Não foi possível carregar a fila. Confira a conexão com o servidor; a tela tenta de novo sozinha.
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center gap-3 text-muted">
          <RefreshCw className="h-6 w-6 animate-spin text-accent" />
          <span>Carregando comandas...</span>
        </div>
      ) : (
        <div className="mt-5 grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto md:grid-cols-3 md:overflow-hidden lg:gap-6">
          {columns.map((col) => (
            <section key={col.id} className="flex min-h-0 flex-col" aria-label={col.title}>
              <h2 className="mb-3 flex items-baseline gap-3 border-b-2 border-ink pb-2 text-3xl text-ink">
                {col.title}
                <span className="font-display text-3xl text-accent">{col.orders.length}</span>
              </h2>
              <div className="flex-1 space-y-5 overflow-y-auto pb-6 pr-1">
                {col.orders.length === 0 ? (
                  <p className="border border-dashed border-line p-6 text-center text-sm text-muted">{col.empty}</p>
                ) : (
                  col.orders.map(renderTicket)
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {printOrder && (
        <ReceiptPrintModal
          variant="cozinha"
          order={{
            id: printOrder.pedido_id,
            numero_comanda: printOrder.numero_comanda,
            numero_mesa: printOrder.numero_mesa,
            tipo_atendimento: printOrder.tipo_atendimento,
            total: printOrder.total,
            endereco: printOrder.endereco,
            itens: printOrder.itens,
          }}
          onClose={() => setPrintOrder(null)}
        />
      )}
    </div>
  )
}
