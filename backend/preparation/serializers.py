"""Serializers da fila de preparo."""

from rest_framework import serializers

from .models import Preparo


class PreparoSerializer(serializers.ModelSerializer):
    """Serializer da fila de preparo com dados do pedido em leitura."""

    pedido_id = serializers.IntegerField(source='pedido.id', read_only=True)
    pedido_status = serializers.CharField(
        source='pedido.status', read_only=True
    )

    class Meta:
        model = Preparo
        fields = (
            'id',
            'pedido_id',
            'pedido_status',
            'status',
            'entered_at',
            'started_at',
            'finished_at',
        )
        read_only_fields = fields