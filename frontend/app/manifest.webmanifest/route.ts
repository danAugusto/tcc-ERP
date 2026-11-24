import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const INTERNAL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"
const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL || "/api/"
// Em desenvolvimento a API está noutra origem; em produção tudo é servido pela mesma origem
const MEDIA_ORIGIN = /^https?:\/\//.test(PUBLIC_API) ? new URL(PUBLIC_API).origin : ""

export async function GET() {
  let nome = "PL Lanchonete & Pastelaria"
  let icons = [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  ]
  try {
    const res = await fetch(`${INTERNAL}/api/core/estabelecimento/`, { cache: "no-store" })
    if (res.ok) {
      const data = await res.json()
      if (data.nome) nome = data.nome
      if (data.logo) {
        icons = [
          { src: `${MEDIA_ORIGIN}${data.logo.icon_192}`, sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: `${MEDIA_ORIGIN}${data.logo.icon_512}`, sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ]
      }
    }
  } catch {
    // backend indisponível: usa o padrão
  }
  return NextResponse.json(
    {
      name: `${nome} - Cardápio Digital`,
      short_name: nome.slice(0, 12),
      description: `Cardápio digital e autoatendimento de ${nome}`,
      start_url: "/cliente",
      display: "standalone",
      orientation: "portrait",
      background_color: "#000000",
      theme_color: "#000000",
      icons,
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=60" } }
  )
}
