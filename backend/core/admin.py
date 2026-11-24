from django.contrib import admin
from .models import Turno, Auditoria, Configuracao


@admin.register(Turno)
class TurnoAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'inicio', 'fim', 'saldo_dinheiro', 'acerto_confirmado')
    list_filter = ('acerto_confirmado', 'inicio')
    search_fields = ('user__username', 'user__first_name')


@admin.register(Auditoria)
class AuditoriaAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'acao', 'entidade', 'entidade_id', 'data')
    list_filter = ('acao', 'entidade', 'data')
    search_fields = ('user__username', 'acao', 'entidade', 'detalhes')


@admin.register(Configuracao)
class ConfiguracaoAdmin(admin.ModelAdmin):
    list_display = ('chave', 'valor', 'descricao', 'atualizado_em')
    search_fields = ('chave', 'descricao')
