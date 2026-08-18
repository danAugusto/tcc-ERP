from rest_framework import serializers

from .models import Pedido
from .services import validar_transicao


class PedidoSerializer(serializers.ModelSerializer):
    """Serializer de pedidos com validacao de valor e transicao de status."""

    class Meta:
        model = Pedido
        fields = ('id', 'status', 'total', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate_total(self, value):
        if value <= 0:
            raise serializers.ValidationError('O total deve ser maior que zero.')
        return value

    def validate_status(self, value):
        if self.instance and value != self.instance.status:
            validar_transicao(self.instance, value)
        return value