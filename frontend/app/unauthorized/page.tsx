"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { homeFor } from "@/lib/roles";

export default function UnauthorizedPage() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-canvas px-4 text-ink">
      <div className="w-full max-w-sm border-t border-line pt-6">
        <p className="font-display text-[5.5rem]">403</p>
        <h1 className="text-3xl">Sem acesso a esta tela</h1>
        <p className="mt-2 text-base text-muted">
          O perfil <strong className="text-ink">{user?.role || "visitante"}</strong> não tem permissão para abrir
          esta página. Se você precisa dela, peça ao gerente para liberar em Permissões.
        </p>

        <div className="mt-6 space-y-2">
          <Link
            href={user ? homeFor(user.role) : "/login"}
            className="flex h-12 w-full items-center justify-center rounded-md bg-accent text-base font-bold text-accent-ink hover:bg-accent-hover"
          >
            Voltar para a minha tela
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-line-strong text-base font-semibold text-ink hover:bg-raised"
          >
            <LogOut className="h-4 w-4" />
            Entrar com outra conta
          </button>
        </div>
      </div>
    </div>
  );
}
