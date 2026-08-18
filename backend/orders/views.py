from rest_framework import generics
from rest_framework.exceptions import ValidationError

from .models import Pedido
from .serializers import PedidoSerializer
from .services import transicionar_status


class PedidoListCreateView(generics.ListCreateAPIView):
    """Lista ou cria pedidos."""

    serializer_class = PedidoSerializer
    queryset = Pedido.objects.all()


class PedidoDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Consulta, altera ou exclui um pedido."""

    serializer_class = PedidoSerializer
    queryset = Pedido.objects.all()

    def perform_update(self, serializer):
        novo_status = serializer.validated_data.get('status')
        if novo_status and novo_status != serializer.instance.status:
            transicionar_status(
                serializer.instance,
                novo_status,
                responsavel=self.request.user,
            )
        else:
            serializer.save()

    def perform_destroy(self, instance):
        if instance.status == 'entregue':
            raise ValidationError(
                'Nao e possivel excluir um pedido entregue, pois ele ja gerou receita.'
            )
        instance.delete()