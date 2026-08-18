"""Regras de acesso especificas do modulo finance.

Somente administradores podem acessar e alterar o financeiro. A restricao
considera tanto o perfil de acesso (users.Perfil) quanto contas de equipe
(is_staff/is_superuser), mantendo o painel administrativo do Django funcional.
"""

from rest_framework.permissions import BasePermission


class IsAdministrador(BasePermission):
    """Permite acesso apenas a usuarios com perfil de administrador."""

    message = 'Apenas administradores podem acessar o financeiro.'

    def has_permission(self, request, view):
        user = request.user
        if not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        perfil = getattr(user, 'perfil', None)
        return perfil is not None and perfil.role == 'administrador'