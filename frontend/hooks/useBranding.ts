"use client"

import { useEffect } from "react"
import useSWR from "swr"
import { fetcher, mediaUrl } from "../services/api"

export const DEFAULT_BRAND = "PL Lanchonete & Pastelaria"

export interface BrandLogo {
  logo: string
  logo_bw: string
  favicon: string
  icon_192: string
  icon_512: string
}

export interface Estabelecimento {
  nome: string
  logo: BrandLogo | null
  telefone: string
  endereco: string
  cnpj: string
  taxa_entrega: string
  tempo_entrega: string
  tempo_retirada: string
  pedido_minimo: string
  aceita_pedidos_online: boolean
}

/** Nome e logo do estabelecimento (white-label), vindos do banco via API pública. */
export function useBranding() {
  const { data, mutate } = useSWR<Estabelecimento>("/core/estabelecimento/", fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })
  return {
    nome: data?.nome || DEFAULT_BRAND,
    logoUrl: mediaUrl(data?.logo?.logo ?? null),
    receiptLogoUrl: mediaUrl(data?.logo?.logo_bw ?? null),
    faviconUrl: mediaUrl(data?.logo?.favicon ?? null),
    hasLogo: !!data?.logo,
    data,
    refresh: mutate,
  }
}

/** Mantém título e favicon da aba sincronizados com o nome e a logo do estabelecimento. */
export function BrandingTitle() {
  const { nome, faviconUrl } = useBranding()
  useEffect(() => {
    document.title = `${nome} — ERP & Automação`
  }, [nome])
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-brand]')
    if (!faviconUrl) {
      link?.remove() // volta ao favicon padrão declarado no layout
      return
    }
    if (!link) {
      link = document.createElement("link")
      link.rel = "icon"
      link.setAttribute("data-brand", "1")
      document.head.appendChild(link)
    }
    link.type = "image/png"
    link.href = faviconUrl
  }, [faviconUrl])
  return null
}
