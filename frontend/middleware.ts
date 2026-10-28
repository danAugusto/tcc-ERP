import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Mapa de permissões por rota
const routeRoles: Record<string, string[]> = {
  "/": ["administrador", "superadmin"],
  "/admin": ["administrador", "superadmin"],
  "/finance": ["administrador", "superadmin"],
  "/cozinha": ["cozinheiro", "administrador", "superadmin"],
  "/entregador": ["entregador", "administrador", "superadmin"],
  "/gestao": ["administrador", "atendente", "superadmin"],
  "/orders": ["administrador", "atendente", "superadmin"],
  "/equipe": ["administrador", "superadmin"],
  "/permissoes": ["administrador", "superadmin"],
  "/inventory": ["administrador", "cozinheiro", "superadmin"],
  "/catalog": ["administrador", "superadmin"],
  "/rpa": ["administrador", "superadmin"],
  "/settings": ["administrador", "superadmin"],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Deixar rotas públicas e recursos estáticos passarem livremente
  const publicRoutes = [
    "/login",
    "/unauthorized",
    "/cliente",
    "/recuperar-senha",
    "/manifest.json",
    "/manifest.webmanifest",
    "/icon-",
    "/favicon",
  ];
  const isPublic = publicRoutes.some((route) => pathname.startsWith(route));

  // 2. Pegar os dados dos Cookies
  const token = request.cookies.get("access_token")?.value;
  const userRole = request.cookies.get("user_role")?.value;

  // 3. Usuário já logado tentando acessar o /login -> redireciona conforme cargo
  if (token && pathname === "/login") {
    if (userRole === "cliente") return NextResponse.redirect(new URL("/cliente", request.url));
    if (userRole === "cozinheiro") return NextResponse.redirect(new URL("/cozinha", request.url));
    if (userRole === "entregador") return NextResponse.redirect(new URL("/entregador", request.url));
    if (userRole === "atendente") return NextResponse.redirect(new URL("/orders", request.url));
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Se a rota for pública, deixa prosseguir sem mais checagens
  if (isPublic) {
    return NextResponse.next();
  }

  // 4. Se não tem token e a rota não é pública, manda pro Login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 5. Cliente tentando acessar qualquer rota fora de /cliente é redirecionado para /cliente
  if (userRole === "cliente") {
    return NextResponse.redirect(new URL("/cliente", request.url));
  }

  // 6. Superadmin e Administrador possuem acesso irrestrito a todas as rotas e telas do sistema
  if (userRole === "superadmin" || userRole === "administrador") {
    return NextResponse.next();
  }

  // 7. Redirecionamento da raiz "/" para cargos operacionais
  if (pathname === "/") {
    if (userRole === "cozinheiro") return NextResponse.redirect(new URL("/cozinha", request.url));
    if (userRole === "entregador") return NextResponse.redirect(new URL("/entregador", request.url));
    if (userRole === "atendente") return NextResponse.redirect(new URL("/orders", request.url));
  }

  // 8. Verificação de RBAC (Rotas restritas no Edge)
  // Atenção: "/" é tratado à parte (passo 7); casar "/" como prefixo bloquearia TODAS as rotas
  const protectedRoutePrefix = Object.keys(routeRoles)
    .filter((prefix) => prefix !== "/")
    .find((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));

  if (protectedRoutePrefix && userRole) {
    const allowedRoles = routeRoles[protectedRoutePrefix];

    // Se a role do usuário não está na lista permitida para essa rota
    if (!allowedRoles.includes(userRole)) {
      const unauthorizedUrl = new URL("/unauthorized", request.url);
      return NextResponse.redirect(unauthorizedUrl);
    }
  }

  // Se tem token e tem permissão (ou a rota não tem restrição de role), deixa seguir
  return NextResponse.next();
}

// Configuração para dizer ao Next.js em quais rotas o middleware deve agir
export const config = {
  matcher: [
    /*
     * Ignora rotas de API, arquivos estáticos e imagens:
     * - api (rotas da API)
     * - _next/static (arquivos estáticos)
     * - _next/image (arquivos de otimização de imagem)
     * - favicon.ico, manifest.json, ícones
     */
    "/((?!api|_next/static|_next/image|favicon.ico|favicon.svg|manifest.json|manifest.webmanifest|icon-).*)",
  ],
};
