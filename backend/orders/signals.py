"""Sinais do modulo de pedidos."""

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import ItemPedido
from .services import recalcular_total


@receiver(post_save, sender=ItemPedido)
def recalcular_total_apos_salvar(sender, instance, **kwargs):
    """Mantem o total do pedido consistente apos salvar um item."""
    recalcular_total(instance.pedido)


@receiver(post_delete, sender=ItemPedido)
def recalcular_total_apos_excluir(sender, instance, **kwargs):
    """Mantem o total do pedido consistente apos excluir um item."""
    recalcular_total(instance.pedido)