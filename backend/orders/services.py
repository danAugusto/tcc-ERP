"""Regras de negocio do modulo de pedidos."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Pedido

TRANSICOES_VALIDAS = {
    'criado': {'confirmado', 'cancelado'},
    'confirmado': {'em_preparo', 'cancelado'},
    'em_preparo': {'pronto', 'cancelado'},
    'pronto': {'entregue', 'cancelado'},
    'entregue': set(),
    'cancelado': set(),
}

STATUS_PREPARO = {
    'em_preparo': 'em_preparo',
    'pronto': 'pronto',
    'entregue': 'pronto',
    'cancelado': 'cancelado',
}


def validar_transicao(pedido, novo_status):
    if novo_status not in TRANSICOES_VALIDAS.get(pedido.status, set()):
        raise ValidationError(
            f'Transicao de status invalida de {pedido.get_status_display()} '
            f'para {dict(Pedido.STATUS_CHOICES)[novo_status]}.'
        )


def recalcular_total(pedido):
    """Recalcula o total do pedido a partir dos itens e persiste."""
    total = sum(item.subtotal for item in pedido.itens.all())
    pedido.total = total
    pedido.save(update_fields=['total', 'updated_at'])
    return pedido.total


def transicionar_status(pedido, novo_status, responsavel=None, motivo=None):
    """Altera o status do pedido em uma unica transacao.

    Sincroniza a fila de preparo, registra timestamps de confirmacao e
    cancelamento e cria a receita financeira quando o pedido e entregue.
    """
    validar_transicao(pedido, novo_status)

    with transaction.atomic():
        pedido.status = novo_status
        update_fields = ['status', 'updated_at']

        if novo_status == 'confirmado' and pedido.confirmed_at is None:
            pedido.confirmed_at = timezone.now()
            update_fields.append('confirmed_at')

        if novo_status == 'cancelado':
            pedido.cancelled_at = timezone.now()
            pedido.cancelled_by = responsavel
            pedido.cancellation_reason = motivo or ''
            update_fields.extend(['cancelled_at', 'cancelled_by', 'cancellation_reason'])

        pedido.save(update_fields=update_fields)

        from preparation.models import Preparo

        if novo_status == 'confirmado':
            Preparo.objects.get_or_create(
                pedido=pedido, defaults={'status': 'pendente'}
            )
        elif novo_status in STATUS_PREPARO:
            Preparo.objects.filter(pedido=pedido).update(status=STATUS_PREPARO[novo_status])

        if novo_status == 'entregue':
            from finance.services import criar_receita_para_pedido

            criar_receita_para_pedido(pedido, responsavel=responsavel)

    return pedido