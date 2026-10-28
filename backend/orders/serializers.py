"""Serializers do modulo de pedidos."""

import random
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from .models import EnderecoPedido, ItemPedido, Pedido
from .permissions import is_equipe
from .services import recalcular_total, validar_transicao

User = get_user_model()


class EnderecoPedidoSerializer(serializers.ModelSerializer):
    """Endereco de entrega vinculado a pedidos do tipo delivery."""

    class Meta:
        model = EnderecoPedido
        fields = (
            'id',
            'cep',
            'logradouro',
            'numero',
            'complemento',
            'bairro',
            'cidade',
            'uf',
        )
        read_only_fields = ('id',)


class ItemPedidoSerializer(serializers.ModelSerializer):
    """Item de pedido com preco registrado no momento da venda."""

    produto_nome = serializers.CharField(source='produto.nome', read_only=True)
    subtotal = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = ItemPedido
        fields = ('id', 'produto', 'produto_nome', 'quantidade', 'preco_unitario', 'subtotal')
        read_only_fields = ('id', 'produto_nome', 'preco_unitario', 'subtotal')

    def validate_quantidade(self, value):
        if value <= 0:
            raise serializers.ValidationError('A quantidade deve ser maior que zero.')
        return value


class PedidoSerializer(serializers.ModelSerializer):
    """Serializer de pedidos com itens aninhados, endereco e total calculado."""

    itens = ItemPedidoSerializer(many=True, required=False)
    endereco = EnderecoPedidoSerializer(required=False, allow_null=True)
    total = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    cliente = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False, allow_null=True
    )
    entregador = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False, allow_null=True
    )
    entregador_nome = serializers.SerializerMethodField()

    class Meta:
        model = Pedido
        fields = (
            'id',
            'status',
            'tipo_atendimento',
            'numero_mesa',
            'numero_comanda',
            'cliente',
            'entregador',
            'entregador_nome',
            'codigo_pin_entrega',
            'comprovante_entrega_url',
            'motivo_falha_entrega',
            'itens',
            'endereco',
            'taxa_entrega',
            'total',
            'payment_method',
            'valor_recebido',
            'troco',
            'confirmed_at',
            'cancelled_at',
            'cancelled_by',
            'cancellation_reason',
            'created_at',
            'updated_at',
        )
        read_only_fields = (
            'id',
            'taxa_entrega',
            'total',
            'confirmed_at',
            'cancelled_at',
            'cancelled_by',
            'created_at',
            'updated_at',
            'codigo_pin_entrega',
            'comprovante_entrega_url',
            'motivo_falha_entrega',
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # O PIN pertence ao cliente (e a loja): o entregador precisa recebe-lo do cliente, nunca da API
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        pode_ver = bool(user and user.is_authenticated and (is_equipe(user) or instance.cliente_id == user.id))
        if not pode_ver:
            data['codigo_pin_entrega'] = None
        return data

    def get_entregador_nome(self, obj):
        if obj.entregador:
            return f'{obj.entregador.first_name} {obj.entregador.last_name}'.strip() or obj.entregador.username
        return None

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
            if not produto.disponibilidade:
                raise serializers.ValidationError(
                    {'itens': f'Produto indisponivel: {produto.nome}.'}
                )
            ItemPedido.objects.create(
                pedido=pedido,
                produto=produto,
                quantidade=item['quantidade'],
                preco_unitario=produto.preco,
            )
        recalcular_total(pedido)

    def create(self, validated_data):
        itens_data = validated_data.pop('itens', [])
        endereco_data = validated_data.pop('endereco', None)
        request = self.context.get('request')
        cliente = validated_data.pop('cliente', None)
        if not cliente and request and hasattr(request, 'user') and request.user.is_authenticated:
            cliente = request.user

        if not validated_data.get('numero_comanda'):
            validated_data['numero_comanda'] = f"{random.randint(1000, 9999)}"

        tipo = validated_data.get('tipo_atendimento', 'mesa')
        if tipo == 'balcao' and not validated_data.get('numero_mesa'):
            validated_data['numero_mesa'] = 'Balcão'
        elif tipo == 'delivery':
            if not validated_data.get('numero_mesa'):
                validated_data['numero_mesa'] = 'Delivery'
            if not validated_data.get('codigo_pin_entrega'):
                validated_data['codigo_pin_entrega'] = f"{random.randint(1000, 9999):04d}"
            from core.services import obter_decimal_configuracao
            validated_data['taxa_entrega'] = obter_decimal_configuracao('taxa_entrega')
        elif tipo == 'retirada' and not validated_data.get('numero_mesa'):
            validated_data['numero_mesa'] = 'Retirada'

        if not itens_data:
            raise serializers.ValidationError(
                {'itens': 'Um pedido deve ter pelo menos um item.'}
            )

        with transaction.atomic():
            pedido = Pedido.objects.create(cliente=cliente, **validated_data)
            self._build_itens(pedido, itens_data)
            if endereco_data:
                EnderecoPedido.objects.create(pedido=pedido, **endereco_data)
        return pedido

    def update(self, instance, validated_data):
        itens_data = validated_data.pop('itens', None)
        endereco_data = validated_data.pop('endereco', None)

        with transaction.atomic():
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()

            if itens_data is not None:
                instance.itens.all().delete()
                self._build_itens(instance, itens_data)

            if endereco_data is not None:
                EnderecoPedido.objects.update_or_create(
                    pedido=instance, defaults=endereco_data
                )

        return instance