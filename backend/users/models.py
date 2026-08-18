from django.conf import settings
from django.db import models


class Perfil(models.Model):
    """Perfil de acesso do usuario: cliente, atendente, cozinheiro ou administrador."""

    ROLE_CHOICES = [
        ('cliente', 'Cliente'),
        ('atendente', 'Atendente'),
        ('cozinheiro', 'Cozinheiro'),
        ('administrador', 'Administrador'),
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'perfil de acesso'
        verbose_name_plural = 'perfis de acesso'

    def __str__(self):
        return f'{self.user.username} - {self.get_role_display()}'


def criar_perfil_para_usuario(sender, instance, created, **kwargs):
    """Cria automaticamente um perfil padrao quando um usuario e registrado."""
    if created:
        Perfil.objects.get_or_create(user=instance)