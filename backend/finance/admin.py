from django.contrib import admin

from .models import FinanceCategory, Lancamento


@admin.register(FinanceCategory)
class FinanceCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'type', 'description')
    list_filter = ('type',)
    search_fields = ('name',)


@admin.register(Lancamento)
class LancamentoAdmin(admin.ModelAdmin):
    list_display = ('date', 'type', 'value', 'category', 'responsible')
    list_filter = ('type', 'category')
    search_fields = ('description',)
    date_hierarchy = 'date'