"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useAuth, Role } from "@/hooks/useAuth";
import { homeFor } from "@/lib/roles";

const PUBLIC_ROUTES = ["/login", "/unauthorized", "/cliente"];

/** Rotas que o cliente pode acessar (fora as PUBLIC_ROUTES) */
const CLIENT_ALLOWED_ROUTES = ["/cliente"];

export const ROUTE_ROLES: Record<string, Role[]> = {
  "/": ["administrador", "superadmin"],
  "/admin": ["administrador", "superadmin"],
  "/cozinha": ["cozinheiro", "administrador", "superadmin"],
  "/entregador": ["entregador", "administrador", "superadmin"],
  "/gestao": ["administrador", "atendente", "superadmin"],
  "/orders": ["administrador", "atendente", "superadmin"],
  "/equipe": ["administrador", "superadmin"],
  "/permissoes": ["administrador", "superadmin"],
  "/inventory": ["administrador", "cozinheiro", "superadmin"],
  "/catalog": ["administrador", "superadmin"],
  "/finance": ["administrador", "superadmin"],
  "/rpa": ["administrador", "superadmin"],
  "/settings": ["administrador", "superadmin"],
};

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export function resolveRedirect(
  pathname: string,
  user: { role: Role } | null,
  isAuthenticated: boolean,
  allowedRoles?: Role[]
): string | null {
  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  // 1. Rota pública: liberada (usuário logado em /login vai para o seu ambiente)
  if (isPublic) {
    return isAuthenticated && user && pathname === "/login" ? homeFor(user.role) : null;
  }

  // 2. Não autenticado em rota protegida -> Login
  if (!isAuthenticated || !user) return "/login";

  // 3. Cliente só acessa /cliente
  if (user.role === "cliente") {
    return CLIENT_ALLOWED_ROUTES.some((route) => pathname.startsWith(route)) ? null : "/cliente";
  }

  // 4. Superadmin (DevMode) e Administrador têm acesso universal
  if (user.role === "superadmin" || user.role === "administrador") return null;

  // 5. allowedRoles explícito
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return "/unauthorized";
  }

  // 6. Mapa de rotas: a raiz leva cada perfil operacional ao seu ambiente
  if (pathname === "/") {
    return ROUTE_ROLES["/"].includes(user.role) ? null : homeFor(user.role);
  }
  const matchingPrefix = Object.keys(ROUTE_ROLES)
    .filter((prefix) => prefix !== "/")
    .find((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
  if (matchingPrefix && !ROUTE_ROLES[matchingPrefix].includes(user.role)) {
    return "/unauthorized";
  }
  return null;
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  // Calculado durante a renderização: conteúdo proibido nunca chega a ser exibido (sem "piscar" de tela)
  const redirectTo = isLoading ? null : resolveRedirect(pathname, user, isAuthenticated, allowedRoles);

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  // Tela de carregamento suave (ou bloqueio enquanto o redirecionamento acontece)
  if ((isLoading && !isPublic) || (redirectTo && !isPublic)) {
    return (
      <div className="flex h-dvh w-screen items-center justify-center bg-canvas text-soft">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-accent" />
          <span className="text-xs font-semibold">Carregando ambiente seguro...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default AuthGuard;
