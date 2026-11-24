from rest_framework import serializers

from .models import FinanceCategory, Lancamento


class FinanceCategorySerializer(serializers.ModelSerializer):
    """Serializer de categorias financeiras com validacao de nome e tipo."""

    class Meta:
        model = FinanceCategory
        fields = ('id', 'name', 'type', 'description', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')


class LancamentoSerializer(serializers.ModelSerializer):
    """Serializer de lancamentos financeiros com validacao de valor e categoria."""

    category_name = serializers.CharField(source='category.name', read_only=True)
    responsible_name = serializers.SerializerMethodField()

    def get_responsible_name(self, obj):
        return obj.responsible.get_username() if obj.responsible else None

    class Meta:
        model = Lancamento
        fields = (
            'id',
            'type',
            'value',
            'description',
            'date',
            'payment_method',
            'category',
            'category_name',
            'responsible',
            'responsible_name',
            'pedido',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at', 'responsible', 'pedido')

    def validate_value(self, value):
        if value <= 0:
            raise serializers.ValidationError('O valor deve ser maior que zero.')
        return value

    def validate(self, attrs):
        category = attrs.get('category') or getattr(self.instance, 'category', None)
        lancamento_type = attrs.get('type') or getattr(self.instance, 'type', None)
        if category and lancamento_type and category.type != lancamento_type:
            raise serializers.ValidationError(
                'A categoria deve ser do mesmo tipo do lancamento.'
            )
        return attrs


class ResumoFinanceiroSerializer(serializers.Serializer):
    """Serializer da resposta do resumo financeiro."""

    total_receitas = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_despesas = serializers.DecimalField(max_digits=14, decimal_places=2)
    saldo = serializers.DecimalField(max_digits=14, decimal_places=2)