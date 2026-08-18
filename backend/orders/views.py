from rest_framework import generics
from rest_framework.exceptions import ValidationError

from .models import Pedido
from .serializers import PedidoSerializer


class PedidoListCreateView(generics.ListCreateAPIView):
    """Lista ou cria pedidos."""

    serializer_class = PedidoSerializer
    queryset = Pedido.objects.all()


class PedidoDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Consulta, altera ou exclui um pedido."""

    serializer_class = PedidoSerializer
    queryset = Pedido.objects.all()

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.status == 'entregue':
            from finance.services import criar_receita_para_pedido

            criar_receita_para_pedido(instance, responsavel=self.request.user)

    def perform_destroy(self, instance):
        if instance.status == 'entregue':
            raise ValidationError(
                'Nao e possivel excluir um pedido entregue, pois ele ja gerou receita.'
            )
        instance.delete()