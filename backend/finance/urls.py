from django.urls import path

from .views import (
    CategoryDetailView,
    CategoryListCreateView,
    FinanceSummaryView,
    LancamentoDetailView,
    LancamentoListCreateView,
)

urlpatterns = [
    path('categories/', CategoryListCreateView.as_view(), name='category_list_create'),
    path(
        'categories/<int:pk>/',
        CategoryDetailView.as_view(),
        name='category_detail',
    ),
    path('lancamentos/', LancamentoListCreateView.as_view(), name='lancamento_list_create'),
    path(
        'lancamentos/<int:pk>/',
        LancamentoDetailView.as_view(),
        name='lancamento_detail',
    ),
    path('summary/', FinanceSummaryView.as_view(), name='finance_summary'),
]