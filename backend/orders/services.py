"""Regras de negocio do modulo de pedidos."""

from django.db import transaction
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


def validar_transicao(pedido, novo_status):
    if novo_status not in TRANSICOES_VALIDAS.get(pedido.status, set()):
        raise ValidationError(
            f'Transicao de status invalida de {pedido.get_status_display()} '
            f'para {dict(Pedido.STATUS_CHOICES)[novo_status]}.'
        )


def transicionar_status(pedido, novo_status, responsavel=None):
    """Altera o status do pedido e dispara a receita quando ele e entregue."""
    validar_transicao(pedido, novo_status)

    with transaction.atomic():
        pedido.status = novo_status
        pedido.save(update_fields=['status', 'updated_at'])

        if novo_status == 'entregue':
            from finance.services import criar_receita_para_pedido

            criar_receita_para_pedido(pedido, responsavel=responsavel)

    return pedido