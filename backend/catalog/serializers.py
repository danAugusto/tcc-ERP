"""Serializers do catalogo."""

from rest_framework import serializers

from .models import Product


class ProductSerializer(serializers.ModelSerializer):
    """Serializer de produtos do cardapio."""

    class Meta:
        model = Product
        fields = (
            'id',
            'name',
            'price',
            'is_available',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError('O preco deve ser maior que zero.')
        return value