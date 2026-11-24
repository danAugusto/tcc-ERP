from django.contrib import admin
from django.contrib.auth.models import User

from .models import Perfil, Permissao, RolePermissao


@admin.register(Perfil)
class PerfilAdmin(admin.ModelAdmin):
    list_display = ('user', 'role')
    list_filter = ('role',)
    search_fields = ('user__username',)

@admin.register(Permissao)
class PermissaoAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'descricao', 'modulo')
    list_filter = ('modulo',)
    search_fields = ('codigo', 'descricao')

@admin.register(RolePermissao)
class RolePermissaoAdmin(admin.ModelAdmin):
    list_display = ('role_nome', 'permissao')
    list_filter = ('role_nome', 'permissao__modulo')
    search_fields = ('permissao__codigo',)
