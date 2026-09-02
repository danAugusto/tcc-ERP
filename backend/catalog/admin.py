from django.contrib import admin

from .models import Categoria, Produto


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ('nome', 'status', 'created_at', 'updated_at')
    list_filter = ('status',)
    search_fields = ('nome',)


@admin.register(Produto)
class ProdutoAdmin(admin.ModelAdmin):
    list_display = ('nome', 'preco', 'categoria', 'disponibilidade')
    list_filter = ('disponibilidade', 'categoria')
    search_fields = ('nome',)
    list_select_related = ('categoria',)
