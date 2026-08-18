"""Serializers do modulo de pedidos."""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import ItemPedido, Pedido
from .services import recalcular_total, validar_transicao

User = get_user_model()


class ItemPedidoSerializer(serializers.ModelSerializer):
    """Item de pedido com preco registrado no momento da venda."""

    subtotal = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = ItemPedido
        fields = ('id', 'produto', 'quantidade', 'preco_unitario', 'subtotal')
        read_only_fields = ('id', 'preco_unitario', 'subtotal')

    def validate_quantidade(self, value):
        if value <= 0:
            raise serializers.ValidationError('A quantidade deve ser maior que zero.')
        return value


class PedidoSerializer(serializers.ModelSerializer):
    """Serializer de pedidos com itens aninhados e total calculado."""

    itens = ItemPedidoSerializer(many=True)
    total = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    cliente = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False
    )

    class Meta:
        model = Pedido
        fields = (
            'id',
            'status',
            'cliente',
            'itens',
            'total',
            'confirmed_at',
            'cancelled_at',
            'cancelled_by',
            'cancellation_reason',
            'created_at',
            'updated_at',
        )
        read_only_fields = (
            'id',
            'confirmed_at',
            'cancelled_at',
            'cancelled_by',
            'created_at',
            'updated_at',
        )

    def validate_status(self, value):
        if not self.instance and value != 'criado':
            raise serializers.ValidationError(
                'Pedidos devem ser criados com status criado.'
            )
        if self.instance and value != self.instance.status:
            validar_transicao(self.instance, value)
        return value

    def validate(self, attrs):
        if self.instance and 'itens' in attrs and self.instance.status != 'criado':
            raise serializers.ValidationError(
                {'itens': 'Itens so podem ser alterados enquanto o pedido esta criado.'}
            )
        return attrs

    def _build_itens(self, pedido, itens_data):
        for item in itens_data:
            produto = item['produto']
            if not produto.is_available:
                raise serializers.ValidationError(
                    {'itens': f'Produto indisponivel: {produto.name}.'}
                )
            ItemPedido.objects.create(
                pedido=pedido,
                produto=produto,
                quantidade=item['quantidade'],
                preco_unitario=produto.price,
            )

    def create(self, validated_data):
        itens_data = validated_data.pop('itens')
        cliente = validated_data.pop('cliente', None) or self.context['request'].user

        if not itens_data:
            raise serializers.ValidationError(
                {'itens': 'Um pedido deve ter pelo menos um item.'}
            )

        pedido = Pedido.objects.create(cliente=cliente, **validated_data)
        self._build_itens(pedido, itens_data)
        recalcular_total(pedido)
        return pedido

    def update(self, instance, validated_data):
        itens_data = validated_data.pop('itens', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if itens_data is not None:
            instance.itens.all().delete()
            self._build_itens(instance, itens_data)
            recalcular_total(instance)

        return instance