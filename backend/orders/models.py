"""Entidades do modulo de pedidos."""

from django.conf import settings
from django.db import models


class Pedido(models.Model):
    """Pedido com fluxo de status que integra ao financeiro e a fila de preparo."""

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
    cliente = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pedidos',
        verbose_name='cliente',
    )
    total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='total',
    )
    confirmed_at = models.DateTimeField(
        null=True, blank=True, verbose_name='confirmado em'
    )
    cancelled_at = models.DateTimeField(
        null=True, blank=True, verbose_name='cancelado em'
    )
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pedidos_cancelados',
        verbose_name='cancelado por',
    )
    cancellation_reason = models.TextField(
        blank=True, verbose_name='motivo do cancelamento'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'pedido'
        verbose_name_plural = 'pedidos'

    def __str__(self):
        return f'Pedido #{self.id} - {self.get_status_display()}'


class ItemPedido(models.Model):
    """Item de um pedido, com preco registrado no momento da venda."""

    pedido = models.ForeignKey(
        Pedido,
        on_delete=models.CASCADE,
        related_name='itens',
        verbose_name='pedido',
    )
    produto = models.ForeignKey(
        'catalog.Product',
        on_delete=models.PROTECT,
        related_name='itens_pedido',
        verbose_name='produto',
    )
    quantidade = models.PositiveIntegerField(default=1, verbose_name='quantidade')
    preco_unitario = models.DecimalField(
        max_digits=12, decimal_places=2, verbose_name='preco unitario'
    )

    class Meta:
        ordering = ['id']
        verbose_name = 'item do pedido'
        verbose_name_plural = 'itens do pedido'

    @property
    def subtotal(self):
        return self.preco_unitario * self.quantidade

    def __str__(self):
        return f'{self.produto.name} x{self.quantidade}'