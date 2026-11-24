from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    LoginView,
    MeView,
    RegisterView,
    FuncionarioViewSet,
    DisponibilidadeView,
    RBACMatrixView,
)

router = DefaultRouter()
router.register('funcionarios', FuncionarioViewSet, basename='funcionario')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh_alt'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('disponibilidade/', DisponibilidadeView.as_view(), name='disponibilidade'),
    path('rbac/matrix/', RBACMatrixView.as_view(), name='rbac_matrix'),
    path('rbac/toggle/', RBACMatrixView.as_view(), name='rbac_toggle'),
    path('', include(router.urls)),
]
