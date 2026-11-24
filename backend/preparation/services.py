"""Servicos da fila de preparo."""

import logging

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from orders.services import transicionar_status

from .models import Preparo

logger = logging.getLogger(__name__)


def proximo_pedido(responsavel):
    """Seleciona e inicia o proximo pedido pendente da fila (FIFO)."""
    with transaction.atomic():
        preparo = (
            Preparo.objects.select_for_update()
            .select_related('pedido')
            .filter(status='pendente')
            .order_by('entered_at', 'id')
            .first()
        )
        if preparo is None:
            raise ValidationError('Nao ha pedidos pendentes na fila.')

        transicionar_status(preparo.pedido, 'em_preparo', responsavel=responsavel)
        preparo.status = 'em_preparo'
        preparo.started_at = timezone.now()
        preparo.save(update_fields=['status', 'started_at'])

    logger.info(
        'Preparo #%s (pedido #%s) iniciado por %s',
        preparo.id,
        preparo.pedido_id,
        responsavel,
    )

    return preparo


def iniciar_preparo_especifico(preparo, responsavel):
    """Inicia um preparo específico da fila respeitando a ordem FIFO estrita."""
    if preparo.status != 'pendente':
        raise ValidationError('Apenas preparos pendentes podem ser iniciados.')

    from django.db.models import Q
    ha_anteriores = Preparo.objects.filter(
        status='pendente'
    ).filter(
        Q(entered_at__lt=preparo.entered_at) |
        Q(entered_at=preparo.entered_at, id__lt=preparo.id)
    ).exists()

    if ha_anteriores:
        raise ValidationError(
            'Não é permitido iniciar este pedido fora da ordem. '
            'Existem pedidos anteriores aguardando preparo na fila (FIFO).'
        )

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
        if preparo.status == 'pendente':
            # Se ainda estava pendente, avança primeiro para em_preparo
            transicionar_status(preparo.pedido, 'em_preparo', responsavel=responsavel)
        transicionar_status(preparo.pedido, 'pronto', responsavel=responsavel)
        preparo.status = 'pronto'
        preparo.finished_at = timezone.now()
        preparo.save(update_fields=['status', 'finished_at'])

    logger.info(
        'Preparo #%s (pedido #%s) concluido por %s',
        preparo.id,
        preparo.pedido_id,
        responsavel,
    )

    return preparo


def entregar_preparo(preparo, responsavel):
    """Marca um pedido pronto como entregue ao cliente."""
    if preparo.status not in ('pronto', 'em_preparo', 'pendente'):
        raise ValidationError('Preparo cancelado ou ja entregue.')
    if preparo.pedido.tipo_atendimento == 'delivery':
        raise ValidationError(
            'Pedidos de delivery sao entregues pelo entregador (confirmacao por PIN); '
            'a cozinha encerra o fluxo em "Pronto".'
        )

    with transaction.atomic():
        if preparo.pedido.status == 'pendente' or preparo.pedido.status == 'confirmado':
            transicionar_status(preparo.pedido, 'em_preparo', responsavel=responsavel)
        if preparo.pedido.status == 'em_preparo':
            transicionar_status(preparo.pedido, 'pronto', responsavel=responsavel)
        transicionar_status(preparo.pedido, 'entregue', responsavel=responsavel)
        preparo.status = 'entregue'
        preparo.save(update_fields=['status'])

    logger.info(
        'Preparo #%s (pedido #%s) entregue por %s',
        preparo.id,
        preparo.pedido_id,
        responsavel,
    )

    return preparo