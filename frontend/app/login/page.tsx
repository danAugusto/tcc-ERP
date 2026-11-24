"use client"

import { homeFor } from "@/lib/roles"
import { useState } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"
import { AlertCircle, RefreshCw } from "lucide-react"
import { BrandMark } from "../../components/BrandMark"
import { ThemeToggle } from "../../components/ThemeToggle"

import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import { useBranding } from "@/hooks/useBranding"

export default function LoginPage() {
  const router = useRouter()
  const { login, user } = useAuth()
  const { nome: brandName } = useBranding()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setErrorMessage("Preencha usuário e senha.")
      return
    }

    setLoading(true)
    setErrorMessage("")

    try {
      const result = await login(username.trim(), password.trim())
      if (result.success) {
        const role = result.user?.role || user?.role
        // Navegação completa: evita reaproveitar redirecionamentos em cache de sessões anteriores
        window.location.assign(homeFor(role))
      } else {
        setErrorMessage(result.error || "Credenciais inválidas. Verifique seu usuário e senha.")
      }
    } catch (err: any) {
      console.error("Falha de autenticação:", err)
      setErrorMessage("Erro ao conectar ao servidor de autenticação.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center bg-canvas px-4 py-12 text-ink">
      <ThemeToggle className="absolute right-4 top-4" />

      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-4">
          <BrandMark size={56} />
          <div className="min-w-0">
            <h1 className="font-display text-4xl text-ink">{brandName}</h1>
            <p className="mt-1 text-sm text-muted">Pedidos, cozinha, estoque e caixa</p>
          </div>
        </div>

        <div className="border-t border-line pt-6">
          <h2 className="text-3xl">Entrar</h2>
          <p className="mt-1 text-sm text-muted">Use o usuário e a senha que o gerente cadastrou para você.</p>

          {errorMessage && (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-danger/10 p-3 text-sm font-semibold text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {errorMessage}
            </p>
          )}

          <form onSubmit={handleLogin} className="mt-5 space-y-4">
            <div>
              <label htmlFor="login-user" className="mb-1.5 block text-sm font-semibold">
                Usuário ou e-mail
              </label>
              <input
                id="login-user"
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="h-12 w-full rounded-md border border-line-strong bg-canvas px-3 text-base text-ink focus:border-accent focus:outline-none disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="login-pass" className="mb-1.5 block text-sm font-semibold">
                Senha
              </label>
              <input
                id="login-pass"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="h-12 w-full rounded-md border border-line-strong bg-canvas px-3 text-base text-ink focus:border-accent focus:outline-none disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-accent text-base font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-60"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar no sistema"
              )}
            </button>
          </form>

          <p className="mt-5 border-t border-dashed border-line pt-4 text-center text-sm">
            <span className="text-muted">É cliente? </span>
            <Link href="/cliente" className="font-bold underline underline-offset-4">
              Ver o cardápio e pedir
            </Link>
          </p>

          {process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === "true" && (
            <p className="mt-3 text-center text-xs text-muted">
              Desenvolvimento: superadmin / superadmin · admin / admin
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
