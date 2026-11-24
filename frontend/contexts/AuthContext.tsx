"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { api } from "@/services/api";
import { logoutDestination } from "@/lib/roles";

export type Role = "superadmin" | "administrador" | "atendente" | "cozinheiro" | "entregador" | "cliente";

export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: Role;
  is_online?: boolean;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  role: Role | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; user?: User | null; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  permissions: [],
  isAuthenticated: false,
  isLoading: true,
  login: async () => ({ success: false }),
  logout: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  // Helper para persistência unificada (Cookies + localStorage)
  const saveTokens = (access: string, refresh?: string, userRole?: string) => {
    // Cookies (com validade de 1 dia para access e 7 para refresh)
    Cookies.set("access_token", access, { expires: 1, path: "/" });
    if (refresh) {
      Cookies.set("refresh_token", refresh, { expires: 7, path: "/" });
    }
    if (userRole) {
      Cookies.set("user_role", userRole, { expires: 1, path: "/" });
    }

    // Fallback de retrocompatibilidade
    localStorage.setItem("access_token", access);
    if (refresh) {
      localStorage.setItem("refresh_token", refresh);
    }
  };

  const clearAuthData = useCallback(() => {
    Cookies.remove("access_token", { path: "/" });
    Cookies.remove("refresh_token", { path: "/" });
    Cookies.remove("user_role", { path: "/" });
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
  }, []);

  const fetchCurrentUser = useCallback(async (): Promise<User | null> => {
    try {
      const response = await api.get("/users/me/");
      const userData: User = {
        ...response.data,
        permissions: response.data.permissions || [],
      };

      setUser(userData);
      if (userData.role) {
        Cookies.set("user_role", userData.role, { expires: 1, path: "/" });
      }
      return userData;
    } catch (err) {
      console.warn("Falha ao recuperar sessão do usuário:", err);
      clearAuthData();
      return null;
    }
  }, [clearAuthData]);

  // Montagem inicial: Migração suave localStorage -> Cookies & Carregamento de Perfil
  useEffect(() => {
    const initAuth = async () => {
      try {
        const localAccess = localStorage.getItem("access_token");
        const localRefresh = localStorage.getItem("refresh_token");
        const cookieAccess = Cookies.get("access_token");

        // Rollout transparente: se existe no localStorage mas ainda não nos cookies, migra
        if (localAccess && !cookieAccess) {
          Cookies.set("access_token", localAccess, { expires: 1, path: "/" });
          if (localRefresh) {
            Cookies.set("refresh_token", localRefresh, { expires: 7, path: "/" });
          }
        }

        const effectiveToken = cookieAccess || localAccess;
        if (effectiveToken) {
          await fetchCurrentUser();
        }
      } catch (err) {
        console.error("Erro na inicialização da autenticação:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [fetchCurrentUser]);

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await api.post("/users/login/", {
        username: username.trim(),
        password: password.trim(),
      });

      const { access, refresh } = response.data;
      if (!access) {
        throw new Error("Token não retornado pela API.");
      }

      saveTokens(access, refresh);

      // Busca dados completos do usuário imediatamente após obter o token
      const profile = await fetchCurrentUser();
      if (profile?.role) {
        Cookies.set("user_role", profile.role, { expires: 1, path: "/" });
      }

      return { success: true, user: profile };
    } catch (err: any) {
      console.error("Erro no login:", err);
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        (err.response?.status === 401 ? "Usuário ou senha inválidos." : "Falha na conexão.");
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = useCallback(() => {
    const destino = logoutDestination(user?.role);
    clearAuthData();
    // Navegação completa (não SPA): descarta o cache do roteador e qualquer estado da sessão anterior
    window.location.assign(destino);
  }, [clearAuthData, user]);

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        permissions: user?.permissions || [],
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser utilizado dentro de um <AuthProvider />");
  }
  return context;
}
