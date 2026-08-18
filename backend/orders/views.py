"""Views do modulo de pedidos."""

from rest_framework import generics
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import Pedido
from .permissions import is_equipe
from .serializers import PedidoSerializer
from .services import transicionar_status


class PedidoListCreateView(generics.ListCreateAPIView):
    """Lista ou cria pedidos, respeitando a visibilidade por perfil."""

    serializer_class = PedidoSerializer
    queryset = Pedido.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        if not is_equipe(self.request.user):
            queryset = queryset.filter(cliente=self.request.user)
        return queryset

    def perform_create(self, serializer):
        if is_equipe(self.request.user):
            serializer.save()
        else:
            serializer.save(cliente=self.request.user)


class PedidoDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Consulta, altera ou exclui um pedido."""

    serializer_class = PedidoSerializer
    queryset = Pedido.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        if not is_equipe(self.request.user):
            queryset = queryset.filter(cliente=self.request.user)
        return queryset

    def perform_update(self, serializer):
        if not is_equipe(self.request.user):
            raise PermissionDenied('Apenas a equipe pode alterar pedidos.')

        novo_status = serializer.validated_data.get('status')
        if novo_status and novo_status != serializer.instance.status:
            transicionar_status(
                serializer.instance,
                novo_status,
                responsavel=self.request.user,
                motivo=serializer.validated_data.get('cancellation_reason'),
            )
        else:
            serializer.save()

    def perform_destroy(self, instance):
        if not is_equipe(self.request.user):
            raise PermissionDenied('Apenas a equipe pode excluir pedidos.')

        if instance.status == 'entregue':
            raise ValidationError(
                'Nao e possivel excluir um pedido entregue, pois ele ja gerou receita.'
            )
        instance.delete()