"""Fila FIFO de preparo dos pedidos confirmados."""

from django.db import models


class Preparo(models.Model):
    """Registro de um pedido na fila de preparo da cozinha.

    A ordenacao FIFO usa entered_at (data de entrada na fila), que coincide
    com a confirmacao do pedido.
    """

    STATUS_CHOICES = [
        ('pendente', 'Pendente'),
        ('em_preparo', 'Em preparo'),
        ('pronto', 'Pronto'),
        ('cancelado', 'Cancelado'),
    ]

    pedido = models.OneToOneField(
        'orders.Pedido',
        on_delete=models.CASCADE,
        related_name='preparo',
        verbose_name='pedido',
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pendente',
        verbose_name='status',
    )
    entered_at = models.DateTimeField(auto_now_add=True, verbose_name='entrou na fila em')
    started_at = models.DateTimeField(null=True, blank=True, verbose_name='iniciado em')
    finished_at = models.DateTimeField(null=True, blank=True, verbose_name='concluido em')

    class Meta:
        ordering = ['entered_at', 'id']
        verbose_name = 'preparo'
        verbose_name_plural = 'preparos'

    def __str__(self):
        return f'Preparo do {self.pedido} - {self.get_status_display()}'