"use client";

import { useAuth, Role } from "./useAuth";

export function useRBAC() {
  const { user, isLoading, isAuthenticated } = useAuth();

  const hasRole = (allowedRoles: Role | Role[]): boolean => {
    if (!user) return false;
    // Superadmin e Administrador têm acesso irrestrito a todas as funções e telas
    if (user.role === "superadmin" || user.role === "administrador") return true;
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return rolesArray.includes(user.role);
  };

  const hasPermission = (permission: string | string[]): boolean => {
    if (!user) return false;
    // Superadmin e Administrador têm todas as permissões
    if (user.role === "superadmin" || user.role === "administrador") return true;
    if (!user.permissions) return false;
    const permissionsArray = Array.isArray(permission) ? permission : [permission];
    return permissionsArray.some((p) => user.permissions.includes(p));
  };

  return {
    user,
    role: user?.role || null,
    permissions: user?.permissions || [],
    isLoading,
    isAuthenticated,
    hasRole,
    hasPermission,
  };
}

export default useRBAC;
