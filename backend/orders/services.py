"""Regras de negocio do modulo de pedidos."""

import logging

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from preparation.models import Preparo

from .models import Pedido

logger = logging.getLogger(__name__)

TRANSICOES_VALIDAS = {
    'criado': {'confirmado', 'cancelado'},
    'confirmado': {'em_preparo', 'pronto', 'finalizado', 'cancelado'},
    'em_preparo': {'pronto', 'finalizado', 'cancelado'},
    'pronto': {'entregue', 'retornando_base', 'finalizado', 'cancelado'},
    'entregue': {'finalizado', 'cancelado'},
    'retornando_base': {'pronto', 'finalizado', 'cancelado'},
    'finalizado': {'arquivado'},
    'cancelado': {'arquivado'},
    'arquivado': set(),
}

STATUS_PREPARO = {
    'em_preparo': 'em_preparo',
    'pronto': 'pronto',
    'entregue': 'entregue',
    'finalizado': 'entregue',
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
    total = sum(item.subtotal for item in pedido.itens.all()) + (pedido.taxa_entrega or 0)
    pedido.total = total
    pedido.save(update_fields=['total', 'updated_at'])
    return pedido.total


from decimal import Decimal


def calcular_insumos(pedido):
    """Soma os insumos necessarios ao pedido conforme a ficha tecnica dos itens."""
    from collections import defaultdict

    total = defaultdict(Decimal)
    for item in pedido.itens.select_related('produto').all():
        for receita_item in item.produto.receita_itens.select_related('insumo').all():
            total[receita_item.insumo] += receita_item.quantidade_necessaria * item.quantidade
    return total


def verificar_estoque(pedido):
    """Verifica se ha estoque suficiente, bloqueando as linhas dos insumos.

    Deve ser chamada dentro de transaction.atomic(): o bloqueio impede que duas
    confirmacoes simultaneas consumam o mesmo saldo.
    """
    from inventory.models import Insumo

    necessarios = calcular_insumos(pedido)
    atuais = {
        i.pk: i for i in Insumo.objects.select_for_update().filter(pk__in=[i.pk for i in necessarios])
    }
    for insumo, qtd in necessarios.items():
        disponivel = atuais[insumo.pk].quantidade_atual
        if disponivel < qtd:
            raise ValidationError(
                f'Estoque insuficiente para o insumo: {insumo.nome}. '
                f'Necessario: {qtd}, Disponivel: {disponivel}'
            )

def debitar_estoque(pedido, responsavel=None):
    """Debita do estoque os insumos proporcionais a receita do pedido."""
    from inventory.models import Movimentacao

    insumos_necessarios = calcular_insumos(pedido)
            
    for insumo, qtd in insumos_necessarios.items():
        Movimentacao.objects.create(
            insumo=insumo,
            tipo=Movimentacao.Tipo.SAIDA,
            quantidade=qtd,
            motivo=Movimentacao.Motivo.BAIXA,
            responsavel=responsavel
        )


def devolver_estoque(pedido, responsavel=None):
    """Devolve/estorna ao estoque os insumos debitados do pedido cancelado."""
    from inventory.models import Movimentacao

    insumos_necessarios = calcular_insumos(pedido)

    for insumo, qtd in insumos_necessarios.items():
        Movimentacao.objects.create(
            insumo=insumo,
            tipo=Movimentacao.Tipo.ENTRADA,
            quantidade=qtd,
            motivo=Movimentacao.Motivo.DEVOLUCAO,
            responsavel=responsavel
        )


def transicionar_status(pedido, novo_status, responsavel=None, motivo=None, devolver_insumos=None):
    """Altera o status do pedido em uma unica transacao.

    Sincroniza a fila de preparo, registra timestamps de confirmacao e
    cancelamento e cria a receita financeira quando o pedido e finalizado (pago).

    No cancelamento, os insumos voltam ao estoque automaticamente se o preparo ainda
    nao comecou; depois disso so voltam se o operador informar devolver_insumos=True
    (ex.: ingredientes nao utilizados). Falha de entrega pode ser reenviada
    (retornando_base -> pronto), liberando o pedido para novo entregador.
    """
    validar_transicao(pedido, novo_status)

    status_anterior = pedido.status

    with transaction.atomic():
        if novo_status == 'confirmado':
            verificar_estoque(pedido)

        pedido.status = novo_status
        update_fields = ['status', 'updated_at']

        if status_anterior == 'retornando_base' and novo_status == 'pronto':
            # Reenvio apos falha: o pedido volta a espera de um novo entregador (PIN do cliente e mantido)
            pedido.entregador = None
            pedido.motivo_falha_entrega = None
            update_fields.extend(['entregador', 'motivo_falha_entrega'])

        if novo_status == 'confirmado' and pedido.confirmed_at is None:
            pedido.confirmed_at = timezone.now()
            update_fields.append('confirmed_at')
            debitar_estoque(pedido, responsavel)

        if novo_status == 'cancelado':
            pedido.cancelled_at = timezone.now()
            pedido.cancelled_by = responsavel
            pedido.cancellation_reason = motivo or ''
            update_fields.extend(['cancelled_at', 'cancelled_by', 'cancellation_reason'])

            # Antes do preparo: devolve automaticamente. Depois: considerado consumo/perda,
            # a menos que o operador marque explicitamente a devolucao.
            devolver = devolver_insumos if devolver_insumos is not None else status_anterior == 'confirmado'
            if devolver and pedido.confirmed_at is not None:
                devolver_estoque(pedido, responsavel)

            # Se houver lançamento financeiro gerado para este pedido, estorna removendo a receita
            if hasattr(pedido, 'lancamento_financeiro') and pedido.lancamento_financeiro:
                pedido.lancamento_financeiro.delete()

            try:
                from core.services import registrar_auditoria
                registrar_auditoria(
                    user=responsavel,
                    acao='CANCELOU_PEDIDO',
                    entidade='orders_pedido',
                    entidade_id=pedido.id,
                    detalhes=f'Pedido #{pedido.id} cancelado. Motivo: {motivo or "Não informado"}'
                )
            except Exception:
                logger.exception('Falha ao registrar auditoria do pedido #%s', pedido.id)

        pedido.save(update_fields=update_fields)

        if status_anterior == 'retornando_base' and novo_status == 'pronto':
            try:
                from core.services import registrar_auditoria
                registrar_auditoria(
                    user=responsavel,
                    acao='REENVIOU_ENTREGA',
                    entidade='orders_pedido',
                    entidade_id=pedido.id,
                    detalhes=f'Pedido #{pedido.id} liberado para nova tentativa de entrega',
                )
            except Exception:
                logger.exception('Falha ao registrar auditoria do pedido #%s', pedido.id)

        if novo_status == 'confirmado':
            Preparo.objects.get_or_create(
                pedido=pedido, defaults={'status': 'pendente'}
            )
        elif novo_status in STATUS_PREPARO:
            Preparo.objects.filter(pedido=pedido).update(status=STATUS_PREPARO[novo_status])

        # A receita nasce no pagamento (finalizado), atribuida a quem recebeu (caixa)
        if novo_status == 'finalizado':
            from finance.services import criar_receita_para_pedido

            criar_receita_para_pedido(pedido, responsavel=responsavel)

    logger.info(
        'Pedido #%s: %s -> %s por %s%s',
        pedido.id,
        status_anterior,
        novo_status,
        responsavel or 'sistema',
        f' (motivo: {motivo})' if motivo else '',
    )

    return pedido