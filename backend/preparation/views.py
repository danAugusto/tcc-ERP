"""Views da fila de preparo."""

from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from orders.permissions import IsCozinheiro, PodeOperarPedidos

from .models import Preparo
from .serializers import PreparoSerializer
from .services import concluir_preparo, proximo_pedido


class PreparoQueueView(generics.ListAPIView):
    """Lista a fila de preparo na ordem FIFO (entrada na fila)."""

    serializer_class = PreparoSerializer
    permission_classes = [PodeOperarPedidos]

    def get_queryset(self):
        return (
            Preparo.objects.select_related('pedido')
            .filter(status__in=['pendente', 'em_preparo', 'pronto'])
            .order_by('entered_at', 'id')
        )


class NextPreparoView(APIView):
    """Inicia o proximo pedido pendente da fila (cozinheiro)."""

    permission_classes = [IsCozinheiro]

    def post(self, request):
        preparo = proximo_pedido(responsavel=request.user)
        return Response(
            PreparoSerializer(preparo).data, status=status.HTTP_201_CREATED
        )


class CompletePreparoView(APIView):
    """Marca um pedido em preparo como pronto (cozinheiro)."""

    permission_classes = [IsCozinheiro]

    def post(self, request, pk):
        preparo = get_object_or_404(Preparo, pk=pk)
        preparo = concluir_preparo(preparo, responsavel=request.user)
        return Response(PreparoSerializer(preparo).data)