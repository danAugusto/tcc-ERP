from django.urls import path

from .views import (
    CloseShiftView,
    OrderAddItemView,
    OrderPayView,
    OrderRemoveItemView,
    PedidoDetailView,
    PedidoListCreateView,
    MinhasEntregasView,
    AtribuirEntregadorView,
    ConfirmarEntregaView,
    FalhaEntregaView,
    EntregadoresDisponiveisView,
)

app_name = 'orders'

urlpatterns = [
    path('', PedidoListCreateView.as_view(), name='pedido_list_create'),
    path('minhas-entregas/', MinhasEntregasView.as_view(), name='minhas_entregas'),
    path('entregadores-disponiveis/', EntregadoresDisponiveisView.as_view(), name='entregadores_disponiveis'),
    path('<int:pk>/', PedidoDetailView.as_view(), name='pedido_detail'),
    path('<int:pk>/pay/', OrderPayView.as_view(), name='pedido_pay'),
    path('<int:pk>/add-item/', OrderAddItemView.as_view(), name='pedido_add_item'),
    path('<int:pk>/remove-item/', OrderRemoveItemView.as_view(), name='pedido_remove_item'),
    path('<int:pk>/atribuir-entregador/', AtribuirEntregadorView.as_view(), name='pedido_atribuir_entregador'),
    path('<int:pk>/confirmar-entrega/', ConfirmarEntregaView.as_view(), name='pedido_confirmar_entrega'),
    path('<int:pk>/falha-entrega/', FalhaEntregaView.as_view(), name='pedido_falha_entrega'),
    path('close-shift/', CloseShiftView.as_view(), name='orders_close_shift'),
]