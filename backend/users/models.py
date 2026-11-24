from django.conf import settings
from django.db import models


class Perfil(models.Model):
    """Perfil de acesso do usuario: cliente, atendente, cozinheiro ou administrador."""

    ROLE_CHOICES = [
        ('cliente', 'Cliente'),
        ('atendente', 'Atendente'),
        ('cozinheiro', 'Cozinheiro'),
        ('entregador', 'Entregador'),
        ('administrador', 'Administrador'),
        ('superadmin', 'Superadmin (DevMode)'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='perfil',
        verbose_name='usuario',
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='cliente',
        verbose_name='perfil',
    )
    is_online = models.BooleanField(
        default=False,
        verbose_name='disponível / online',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'perfil de acesso'
        verbose_name_plural = 'perfis de acesso'

    def __str__(self):
        return f'{self.user.username} - {self.get_role_display()}'


def criar_perfil_para_usuario(sender, instance, created, **kwargs):
    """Cria automaticamente um perfil padrão quando um usuário é registrado."""
    if created:
        role = 'administrador' if (instance.is_superuser or getattr(instance, 'is_staff', False)) else 'cliente'
        Perfil.objects.get_or_create(user=instance, defaults={'role': role})


class Permissao(models.Model):
    """Permissão granular para o sistema (ex: CANCELAR_PEDIDO)."""
    
    codigo = models.CharField(max_length=50, unique=True, verbose_name="código")
    descricao = models.CharField(max_length=100, verbose_name="descrição")
    modulo = models.CharField(max_length=50, verbose_name="módulo")

    class Meta:
        verbose_name = "permissão"
        verbose_name_plural = "permissões"
        ordering = ['modulo', 'codigo']

    def __str__(self):
        return f"{self.codigo} ({self.modulo})"


class RolePermissao(models.Model):
    """Relacionamento que define quais Perfis (Roles) possuem quais Permissões."""
    
    role_nome = models.CharField(
        max_length=20,
        choices=Perfil.ROLE_CHOICES,
        verbose_name="perfil"
    )
    permissao = models.ForeignKey(
        Permissao,
        on_delete=models.CASCADE,
        related_name="roles"
    )

    class Meta:
        verbose_name = "permissão de perfil"
        verbose_name_plural = "permissões de perfis"
        unique_together = ('role_nome', 'permissao')

    def __str__(self):
        return f"{self.get_role_nome_display()} - {self.permissao.codigo}"