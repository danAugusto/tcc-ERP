from django.db import models


class Pedido(models.Model):
    """Pedido com fluxo de status que integra ao financeiro quando entregue."""

    STATUS_CHOICES = [
        ('criado', 'Criado'),
        ('confirmado', 'Confirmado'),
        ('em_preparo', 'Em preparo'),
        ('pronto', 'Pronto'),
        ('entregue', 'Entregue'),
        ('cancelado', 'Cancelado'),
    ]

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='criado',
        verbose_name='status',
    )
    total = models.DecimalField(
        max_digits=12, decimal_places=2, verbose_name='total'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'pedido'
        verbose_name_plural = 'pedidos'

    def __str__(self):
        return f'Pedido #{self.id} - {self.get_status_display()}'