/** Tela inicial de cada perfil. */
export function homeFor(role?: string | null): string {
  switch (role) {
    case "cliente":
      return "/cliente"
    case "cozinheiro":
      return "/cozinha"
    case "entregador":
      return "/entregador"
    case "atendente":
      return "/orders"
    default:
      return "/"
  }
}

/** Para onde ir após sair: apps mobile (cliente/entregador) voltam à tela pública; equipe volta ao login. */
export function logoutDestination(role?: string | null): string {
  return role === "cliente" || role === "entregador" ? "/cliente" : "/login"
}
