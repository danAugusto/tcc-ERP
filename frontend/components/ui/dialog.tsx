"use client"

import { useEffect, useRef } from "react"

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Diálogo acessível usado por todos os modais:
 * - role="dialog" + aria-modal + nome acessível;
 * - Esc e clique no fundo fecham (quando `dismissible`);
 * - o foco entra no diálogo, fica preso nele (Tab/Shift+Tab) e volta ao botão que o abriu;
 * - entrada curta (200 ms, ease-out forte) a partir de 97% de escala; nada de surgir do zero.
 * O conteúdo (o "painel") continua sendo desenhado por quem usa o componente.
 */
export function Dialog({
  label,
  onClose,
  children,
  placement = "center",
  dismissible = true,
  className = "",
  zIndex = 50,
}: {
  label: string
  onClose: () => void
  children: React.ReactNode
  placement?: "center" | "sheet"
  dismissible?: boolean
  className?: string
  zIndex?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const root = ref.current
    const first = root?.querySelector<HTMLElement>("[autofocus]") ?? root?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? root)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) {
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (e.key !== "Tab" || !root) return
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      previous?.focus?.()
    }
  }, [dismissible])

  const sheet = placement === "sheet"

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      style={{ zIndex }}
      className={`fixed inset-0 flex justify-center outline-none ${sheet ? "items-end p-0 sm:items-center sm:p-4" : "items-center p-4"} ${className}`}
    >
      <div
        aria-hidden
        onClick={dismissible ? () => closeRef.current() : undefined}
        className="absolute inset-0 bg-black/75 transition-opacity duration-200 starting:opacity-0 print:hidden"
      />
      <div
        className={`relative flex w-full justify-center transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 ${
          sheet ? "starting:translate-y-6 sm:starting:translate-y-0 sm:starting:scale-[0.97]" : "starting:scale-[0.97]"
        }`}
      >
        {children}
      </div>
    </div>
  )
}
