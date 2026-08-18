"""Servicos da fila de preparo."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from orders.services import transicionar_status

from .models import Preparo


def proximo_pedido(responsavel):
    """Seleciona e inicia o proximo pedido pendente da fila (FIFO)."""
    preparo = (
        Preparo.objects.select_related('pedido')
        .filter(status='pendente')
        .order_by('entered_at', 'id')
        .first()
    )
    if preparo is None:
        raise ValidationError('Nao ha pedidos pendentes na fila.')

    with transaction.atomic():
        transicionar_status(preparo.pedido, 'em_preparo', responsavel=responsavel)
        preparo.status = 'em_preparo'
        preparo.started_at = timezone.now()
        preparo.save(update_fields=['status', 'started_at'])

    return preparo


def concluir_preparo(preparo, responsavel):
    """Marca um pedido como pronto, encerrando sua passagem pela cozinha."""
    if preparo.status == 'cancelado':
        raise ValidationError('Preparo cancelado nao pode ser concluido.')

    with transaction.atomic():
        transicionar_status(preparo.pedido, 'pronto', responsavel=responsavel)
        preparo.status = 'pronto'
        preparo.finished_at = timezone.now()
        preparo.save(update_fields=['status', 'finished_at'])

    return preparo