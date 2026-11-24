"""Permissoes de acesso por perfil do modulo de usuarios."""

from rest_framework.permissions import BasePermission

ROLES_EQUIPE = ('atendente', 'cozinheiro', 'administrador', 'superadmin')
ROLES_FUNCIONARIOS = ('atendente', 'cozinheiro', 'entregador', 'administrador', 'superadmin')

DEFAULT_ROLE_PERMISSIONS = {
    'administrador': {'VER_METRICAS', 'CANCELAR_PEDIDO', 'FECHAR_CAIXA', 'EDITAR_ESTOQUE', 'GERENCIAR_USUARIOS'},
    'atendente': {'CANCELAR_PEDIDO', 'FECHAR_CAIXA'},
    'cozinheiro': {'EDITAR_ESTOQUE'},
}


def tem_perfil(user, roles):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or getattr(user, 'is_staff', False):
        return True
    perfil = getattr(user, 'perfil', None)
    return perfil is not None and (perfil.role in roles or perfil.role in ('administrador', 'superadmin'))



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


class IsFuncionario(BasePermission):
    """Permite atendentes, cozinheiros, entregadores e administradores."""

    message = 'Apenas funcionários podem executar esta acao.'

    def has_permission(self, request, view):
        return tem_perfil(request.user, ROLES_FUNCIONARIOS)


class IsAdministrador(BasePermission):
    """Permite apenas administradores (perfil ou conta staff/superuser)."""

    message = 'Apenas administradores podem executar esta acao.'

    def has_permission(self, request, view):
        return tem_perfil(request.user, ('administrador',))


def tem_permissao(user, codigo_permissao):
    """Verifica se o usuário possui a permissão específica vinculada ao seu perfil na base de dados."""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or getattr(user, 'is_staff', False):
        return True
    perfil = getattr(user, 'perfil', None)
    if not perfil:
        return False
    if perfil.role in ('administrador', 'superadmin'):
        return True

    from .models import RolePermissao
    # Se a tabela RBAC já foi populada, usar apenas ela como fonte de verdade
    if RolePermissao.objects.exists():
        return RolePermissao.objects.filter(
            role_nome=perfil.role, permissao__codigo=codigo_permissao
        ).exists()

    # Fallback para papéis padrão apenas quando a tabela ainda não foi populada (ex: testes limpos)
    default_perms = DEFAULT_ROLE_PERMISSIONS.get(perfil.role, set())
    return codigo_permissao in default_perms


class HasActionPermission(BasePermission):
    """Valida se o perfil do usuário possui a permissão configurada na view ou na classe."""

    message = 'Você não possui permissão para executar esta ação.'

    def __init__(self, required_permission=None):
        if required_permission:
            self.required_permission = required_permission

    def has_permission(self, request, view):
        perm_code = getattr(view, 'required_permission', getattr(self, 'required_permission', None))
        if not perm_code:
            return True
        return tem_permissao(request.user, perm_code)