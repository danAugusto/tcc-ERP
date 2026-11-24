from django.contrib import admin

from .models import Preparo


@admin.register(Preparo)
class PreparoAdmin(admin.ModelAdmin):
    list_display = ('id', 'pedido', 'status', 'entered_at')
    list_filter = ('status',)
    date_hierarchy = 'entered_at'