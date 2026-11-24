"""Serializers for catalog API input and output."""

from decimal import Decimal

from rest_framework import serializers

from .models import Categoria, Produto


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = (
            'id',
            'nome',
            'descricao',
            'status',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')


MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_FORMATS = {'JPEG', 'PNG', 'WEBP'}


class ProdutoSerializer(serializers.ModelSerializer):
    categoria_nome = serializers.CharField(source='categoria.nome', read_only=True)
    imagem = serializers.ImageField(write_only=True, required=False, allow_null=True)
    imagem_url = serializers.SerializerMethodField()
    remover_imagem = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = Produto
        fields = (
            'id',
            'nome',
            'descricao',
            'preco',
            'categoria',
            'categoria_nome',
            'disponibilidade',
            'imagem',
            'imagem_url',
            'remover_imagem',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'categoria_nome', 'created_at', 'updated_at')
        extra_kwargs = {
            'preco': {'min_value': Decimal('0.01')},
        }

    def get_imagem_url(self, obj):
        # URL relativa (/media/...): funciona atras do proxy reverso e em qualquer host
        return obj.imagem.url if obj.imagem else None

    def validate_imagem(self, imagem):
        if imagem is None:
            return imagem
        if imagem.size > MAX_IMAGE_BYTES:
            raise serializers.ValidationError('A imagem deve ter no máximo 5 MB.')
        formato = (getattr(getattr(imagem, 'image', None), 'format', '') or '').upper()
        if formato not in ALLOWED_IMAGE_FORMATS:
            raise serializers.ValidationError('Formato inválido. Use JPG, PNG ou WebP.')
        return imagem

    def create(self, validated_data):
        validated_data.pop('remover_imagem', None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        remover = validated_data.pop('remover_imagem', False)
        nova = validated_data.get('imagem')
        if (remover or nova) and instance.imagem:
            instance.imagem.delete(save=False)
        if remover and 'imagem' not in validated_data:
            validated_data['imagem'] = None
        return super().update(instance, validated_data)

    def validate_categoria(self, categoria):
        if not categoria.status:
            raise serializers.ValidationError(
                'Não é possível cadastrar ou alterar um produto em uma categoria inativa.'
            )
        return categoria
