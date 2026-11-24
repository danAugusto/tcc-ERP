"use client";

import React, { ReactNode } from "react";
import { useRBAC } from "@/hooks/useRBAC";
import { Role } from "@/contexts/AuthContext";

interface CanProps {
  roles?: Role | Role[];
  do?: string | string[];
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Componente declarativo para controle visual de permissões e perfis (RBAC).
 *
 * Exemplo de uso:
 * <Can roles={['administrador']}>
 *   <button onClick={excluir}>Excluir Pedido</button>
 * </Can>
 *
 * <Can do="CANCELAR_PEDIDO">
 *   <button onClick={cancelar}>Cancelar Pedido</button>
 * </Can>
 */
export function Can({ roles, do: permission, fallback = null, children }: CanProps) {
  const { user, isLoading, hasRole, hasPermission } = useRBAC();

  if (isLoading || !user) {
    return <>{fallback}</>;
  }

  // Validação por Role (se especificado)
  if (roles && !hasRole(roles)) {
    return <>{fallback}</>;
  }

  // Validação por Permissão granular (se especificado)
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export default Can;
