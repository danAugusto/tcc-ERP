from django.contrib import admin

from .models import Pedido


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ('id', 'status', 'total', 'created_at')
    list_filter = ('status',)
    date_hierarchy = 'created_at'