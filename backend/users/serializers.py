import secrets

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(required=False, allow_blank=True, default='')

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'password')
        read_only_fields = ('id',)

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class MeSerializer(serializers.ModelSerializer):
    """Serializer do usuario autenticado com seu perfil de acesso."""

    role = serializers.SerializerMethodField()
    is_online = serializers.BooleanField(source='perfil.is_online', read_only=True)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'role', 'is_online', 'permissions')
        read_only_fields = fields

    def get_role(self, obj):
        if hasattr(obj, 'perfil') and obj.perfil and obj.perfil.role == 'superadmin':
            return 'superadmin'
        if obj.is_superuser or getattr(obj, 'is_staff', False):
            return 'administrador'
        if hasattr(obj, 'perfil') and obj.perfil:
            return obj.perfil.role
        return 'cliente'

    def get_permissions(self, obj):
        role = self.get_role(obj)
        if role in ('administrador', 'superadmin') or obj.is_superuser or getattr(obj, 'is_staff', False):
            from .models import Permissao
            return list(Permissao.objects.values_list('codigo', flat=True))
        if hasattr(obj, 'perfil') and obj.perfil:
            from .models import RolePermissao
            perms = RolePermissao.objects.filter(role_nome=obj.perfil.role).values_list('permissao__codigo', flat=True)
            return list(perms)
        return []



class FuncionarioSerializer(serializers.ModelSerializer):
    """Serializer para CRUD administrativo de funcionários com controle de perfis."""

    role = serializers.ChoiceField(
        choices=['administrador', 'atendente', 'cozinheiro', 'entregador'],
        default='atendente',
    )
    is_online = serializers.BooleanField(source='perfil.is_online', read_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'first_name',
            'last_name',
            'email',
            'role',
            'is_online',
            'is_active',
            'password',
            'date_joined',
        ]
        read_only_fields = ['id', 'is_online', 'date_joined']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if hasattr(instance, 'perfil'):
            ret['role'] = instance.perfil.role
            ret['is_online'] = instance.perfil.is_online
        return ret

    def create(self, validated_data):
        role = validated_data.pop('role', 'atendente')
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            # Sem senha informada: gera uma aleatoria; o administrador deve definir outra
            user.set_password(secrets.token_urlsafe(12))
        user.save()

        # Configurar perfil
        perfil = getattr(user, 'perfil', None)
        if perfil:
            perfil.role = role
            perfil.save()
        else:
            from .models import Perfil
            Perfil.objects.create(user=user, role=role)
        return user

    def update(self, instance, validated_data):
        role = validated_data.pop('role', None)
        password = validated_data.pop('password', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)
        instance.save()

        if role and hasattr(instance, 'perfil'):
            instance.perfil.role = role
            instance.perfil.save()

        return instance

