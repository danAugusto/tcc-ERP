"""Permissoes de acesso por perfil do modulo de usuarios."""

from rest_framework.permissions import BasePermission

ROLES_EQUIPE = ('atendente', 'cozinheiro', 'administrador')


def tem_perfil(user, roles):
    if not user.is_authenticated:
        return False
    perfil = getattr(user, 'perfil', None)
    return perfil is not None and perfil.role in roles


class IsCliente(BasePermission):
    """Permite apenas clientes."""

    message = 'Apenas clientes podem executar esta acao.'

    def has_permission(self, request, view):
        return tem_perfil(request.user, ('cliente',))


class IsAtendente(BasePermission):
    """Permite apenas atendentes."""

    message = 'Apenas atendentes podem executar esta acao.'

    def has_permission(self, request, view):
        return tem_perfil(request.user, ('atendente',))


class IsCozinheiro(BasePermission):
    """Permite apenas cozinheiros."""

    message = 'Apenas cozinheiros podem executar esta acao.'

    def has_permission(self, request, view):
        return tem_perfil(request.user, ('cozinheiro',))


class IsEquipe(BasePermission):
    """Permite atendentes, cozinheiros e administradores."""

    message = 'Apenas a equipe pode executar esta acao.'

    def has_permission(self, request, view):
        return tem_perfil(request.user, ROLES_EQUIPE)


class IsAdministrador(BasePermission):
    """Permite apenas administradores (perfil ou conta staff/superuser)."""

    message = 'Apenas administradores podem executar esta acao.'

    def has_permission(self, request, view):
        user = request.user
        if not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        perfil = getattr(user, 'perfil', None)
        return perfil is not None and perfil.role == 'administrador'