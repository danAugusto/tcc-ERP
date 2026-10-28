from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EstabelecimentoLogoView, EstabelecimentoView, RpaExecuteView, TurnoViewSet, AuditoriaViewSet, ConfiguracaoViewSet
from .metrics_views import MetricasAnaliticasView

router = DefaultRouter()
router.register('turnos', TurnoViewSet, basename='turno')
router.register('auditoria', AuditoriaViewSet, basename='auditoria')
router.register('configuracoes', ConfiguracaoViewSet, basename='configuracao')

urlpatterns = [
    path('metricas/', MetricasAnaliticasView.as_view(), name='metricas-analiticas'),
    path('estabelecimento/', EstabelecimentoView.as_view(), name='estabelecimento'),
    path('estabelecimento/logo/', EstabelecimentoLogoView.as_view(), name='estabelecimento-logo'),
    path('rpa/execute/', RpaExecuteView.as_view(), name='rpa-execute'),
    path('', include(router.urls)),
]
