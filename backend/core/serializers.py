from rest_framework import serializers
from .models import Turno, Auditoria, Configuracao


class TurnoSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')
    user_nome = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()
    duracao_minutos = serializers.SerializerMethodField()

    class Meta:
        model = Turno
        fields = [
            'id',
            'user',
            'username',
            'user_nome',
            'user_role',
            'inicio',
            'fim',
            'saldo_dinheiro',
            'acerto_confirmado',
            'duracao_minutos',
        ]
        read_only_fields = ['id', 'user', 'inicio', 'fim', 'saldo_dinheiro', 'acerto_confirmado']

    def get_user_nome(self, obj):
        full_name = f'{obj.user.first_name} {obj.user.last_name}'.strip()
        return full_name or obj.user.username

    def get_user_role(self, obj):
        if hasattr(obj.user, 'perfil'):
            return obj.user.perfil.role
        return 'funcionario'

    def get_duracao_minutos(self, obj):
        from django.utils import timezone
        fim = obj.fim or timezone.now()
        diff = fim - obj.inicio
        return int(diff.total_seconds() // 60)


class AuditoriaSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = Auditoria
        fields = [
            'id',
            'user',
            'username',
            'acao',
            'entidade',
            'entidade_id',
            'detalhes',
            'data',
        ]
        read_only_fields = (
            'id', 'user', 'username', 'acao', 'entidade',
            'entidade_id', 'detalhes', 'data',
        )


class ConfiguracaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Configuracao
        fields = ['chave', 'valor', 'descricao', 'atualizado_em']
        read_only_fields = ['chave', 'atualizado_em']
