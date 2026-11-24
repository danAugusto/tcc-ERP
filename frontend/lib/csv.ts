/** Utilitários de exportação CSV (UTF-8 com BOM e separador ";" para o Excel pt-BR). */

const escapeCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v)
  // Neutraliza injeção de fórmulas em planilhas
  const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function downloadCsv(filename: string, rows: unknown[][]) {
  const content = "﻿" + rows.map((r) => r.map(escapeCell).join(";")).join("\r\n")
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const csvMoney = (v: number | string) => Number(v || 0).toFixed(2).replace(".", ",")
export const csvDate = (iso?: string) => (iso ? new Date(iso).toLocaleString("pt-BR") : "")
