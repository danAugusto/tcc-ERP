"""URLs do modulo de catalogo."""

from django.urls import path

from .views import ProductDetailView, ProductListCreateView

app_name = 'catalog'

urlpatterns = [
    path('products/', ProductListCreateView.as_view(), name='product_list_create'),
    path('products/<int:pk>/', ProductDetailView.as_view(), name='product_detail'),
]