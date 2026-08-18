from django.urls import path

from .views import PedidoDetailView, PedidoListCreateView

app_name = 'orders'

urlpatterns = [
    path('', PedidoListCreateView.as_view(), name='pedido_list_create'),
    path('<int:pk>/', PedidoDetailView.as_view(), name='pedido_detail'),
]