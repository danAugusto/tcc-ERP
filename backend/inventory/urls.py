"""Inventory API routes."""

from rest_framework.routers import DefaultRouter

from .views import InsumoViewSet, MovimentacaoViewSet, ReceitaItemViewSet

router = DefaultRouter()
router.register('insumos', InsumoViewSet, basename='insumo')
router.register('movimentacoes', MovimentacaoViewSet, basename='movimentacao')
router.register('receitas', ReceitaItemViewSet, basename='receita')

urlpatterns = router.urls
