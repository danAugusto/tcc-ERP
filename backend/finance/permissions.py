"""Regras de acesso especificas do modulo finance.

Somente administradores podem acessar e alterar o financeiro. A restricao
considera tanto o perfil de acesso (users.Perfil) quanto contas de equipe
(is_staff/is_superuser), mantendo o painel administrativo do Django funcional.
"""

from users.permissions import IsAdministrador

__all__ = ['IsAdministrador']