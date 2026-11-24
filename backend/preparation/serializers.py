"""Serializers da fila de preparo."""

from rest_framework import serializers

from orders.serializers import EnderecoPedidoSerializer, ItemPedidoSerializer
from .models import Preparo


class PreparoSerializer(serializers.ModelSerializer):
    """Serializer da fila de preparo com dados completos do pedido em leitura."""

    pedido_id = serializers.IntegerField(source='pedido.id', read_only=True)
    pedido_status = serializers.CharField(
        source='pedido.status', read_only=True
    )
    tipo_atendimento = serializers.CharField(
        source='pedido.tipo_atendimento', read_only=True
    )
    numero_mesa = serializers.CharField(
        source='pedido.numero_mesa', read_only=True
    )
    numero_comanda = serializers.CharField(
        source='pedido.numero_comanda', read_only=True
    )
    endereco = EnderecoPedidoSerializer(
        source='pedido.endereco', read_only=True
    )
    itens = ItemPedidoSerializer(
        source='pedido.itens', many=True, read_only=True
    )
    total = serializers.DecimalField(
        source='pedido.total', max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = Preparo
        fields = (
            'id',
            'pedido_id',
            'pedido_status',
            'tipo_atendimento',
            'numero_mesa',
            'numero_comanda',
            'endereco',
            'itens',
            'total',
            'status',
            'entered_at',
            'started_at',
            'finished_at',
        )
        read_only_fields = fields