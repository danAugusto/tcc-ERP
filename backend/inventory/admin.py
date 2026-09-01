from django.contrib import admin

from .models import Insumo


@admin.register(Insumo)
class InsumoAdmin(admin.ModelAdmin):
    list_display = (
        'nome',
        'unidade_medida',
        'quantidade_atual',
        'estoque_minimo',
    )
    list_filter = ('unidade_medida',)
    search_fields = ('nome',)
