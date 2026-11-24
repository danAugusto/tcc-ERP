"use client"

import { ChefHat } from "lucide-react"
import { useBranding } from "../hooks/useBranding"

/** Quadrado amarelo da marca: mostra a logo enviada em Configurações ou, por padrão, o chapéu de cozinheiro. */
export function BrandMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  const { logoUrl, nome } = useBranding()

  // Com logo enviada, ela substitui o ícone por completo: sem quadrado amarelo, sem borda, sem folga.
  // A imagem já vem sem a margem transparente (o backend apara), então ocupa o espaço todo.
  if (logoUrl) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl ${className}`} style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={nome} className="h-full w-full object-contain" />
      </span>
    )
  }

  // Padrão: chapéu de cozinheiro no quadrado amarelo
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink ${className}`}
      style={{ width: size, height: size }}
    >
      <ChefHat style={{ width: "55%", height: "55%" }} aria-hidden />
    </span>
  )
}
