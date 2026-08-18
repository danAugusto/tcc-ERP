from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password')
        read_only_fields = ('id',)

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class MeSerializer(serializers.ModelSerializer):
    """Serializer do usuario autenticado com seu perfil de acesso."""

    role = serializers.CharField(source='perfil.role', read_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role')
        read_only_fields = fields
