"use client"

import { useRef, useState } from "react"
import { apiErrorMessage } from "@/lib/errors"
import { ImagePlus, RotateCcw } from "lucide-react"
import api from "../../services/api"
import { BrandMark } from "../BrandMark"
import { useBranding } from "../../hooks/useBranding"

const FORMATS = ["image/png", "image/jpeg", "image/webp"]
const MAX_BYTES = 2 * 1024 * 1024

/** Troca a logo que aparece dentro do quadrado amarelo (menu, login, cardápio), na aba e no ícone do app. */
export function LogoUploader() {
  const { hasLogo, refresh } = useBranding()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null)

  const send = async (file: File) => {
    setMessage(null)
    if (!FORMATS.includes(file.type)) {
      setMessage({ kind: "error", text: "Formato inválido. Use PNG, JPG ou WebP." })
      return
    }
    if (file.size > MAX_BYTES) {
      setMessage({ kind: "error", text: "A imagem deve ter no máximo 2 MB." })
      return
    }
    setBusy(true)
    try {
      const body = new FormData()
      body.append("logo", file)
      await api.post("/core/estabelecimento/logo/", body)
      await refresh()
      setMessage({ kind: "ok", text: "Logo atualizada no menu, no cardápio, na aba do navegador e no ícone do app." })
    } catch (err: any) {
      setMessage({ kind: "error", text: apiErrorMessage(err, "Não foi possível enviar a imagem.") })
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const restore = async () => {
    setBusy(true)
    setMessage(null)
    try {
      await api.delete("/core/estabelecimento/logo/")
      await refresh()
      setMessage({ kind: "ok", text: "Ícone padrão restaurado." })
    } catch {
      setMessage({ kind: "error", text: "Não foi possível restaurar o ícone padrão." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-5 border-b border-dashed border-line pb-5">
      <BrandMark size={72} />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-sm font-bold text-ink">Logo do estabelecimento</p>
          <p className="text-xs text-muted">
            Entra dentro do quadrado amarelo. PNG com fundo transparente fica melhor. PNG, JPG ou WebP, até 2 MB.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && send(e.target.files[0])}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-xs font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-50"
          >
            <ImagePlus className="h-4 w-4" />
            {hasLogo ? "Trocar imagem" : "Enviar imagem"}
          </button>
          {hasLogo && (
            <button
              type="button"
              disabled={busy}
              onClick={restore}
              className="inline-flex items-center gap-2 rounded-lg border border-line px-3.5 py-2 text-xs font-semibold text-soft hover:bg-raised hover:text-ink disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Restaurar ícone padrão
            </button>
          )}
        </div>
        {message && (
          <p className={`text-xs font-medium ${message.kind === "ok" ? "text-success" : "text-danger"}`}>{message.text}</p>
        )}
      </div>
    </div>
  )
}
