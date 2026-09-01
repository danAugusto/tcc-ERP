"""Inventory API routes."""

from rest_framework.routers import DefaultRouter

from .views import InsumoViewSet

router = DefaultRouter()
router.register('insumos', InsumoViewSet, basename='insumo')

urlpatterns = router.urls
