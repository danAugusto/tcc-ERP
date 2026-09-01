"""Serializers for inventory API input and output."""

from rest_framework import serializers

from .models import Insumo


class InsumoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Insumo
        fields = (
            'id',
            'nome',
            'unidade_medida',
            'quantidade_atual',
            'estoque_minimo',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')
