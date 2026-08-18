"""Permissoes de acesso do modulo de pedidos."""

from rest_framework.permissions import BasePermission

ROLES_OPERACAO = ('atendente', 'cozinheiro', 'administrador')


class PodeOperarPedidos(BasePermission):
    """Permite atendentes, cozinheiros e administradores operarem pedidos."""

    message = 'Apenas a equipe pode operar pedidos.'

    def has_permission(self, request, view):
        user = request.user
        if not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        perfil = getattr(user, 'perfil', None)
        return perfil is not None and perfil.role in ROLES_OPERACAO


class IsCozinheiro(BasePermission):
    """Permite apenas cozinheiros operarem a fila de preparo."""

    message = 'Apenas cozinheiros podem operar a fila de preparo.'

    def has_permission(self, request, view):
        user = request.user
        if not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        perfil = getattr(user, 'perfil', None)
        return perfil is not None and perfil.role == 'cozinheiro'