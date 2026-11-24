"""Regras de negocio e operacoes transacionais do modulo finance."""

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import FinanceCategory, Lancamento


def criar_receita_para_pedido(pedido, responsavel=None):
    """Cria a receita de um pedido entregue, sem duplicar lancamentos."""
    if hasattr(pedido, 'lancamento_financeiro'):
        return pedido.lancamento_financeiro

    with transaction.atomic():
        categoria, _ = FinanceCategory.objects.get_or_create(
            name='Vendas',
            defaults={
                'type': 'receita',
                'description': 'Vendas de produtos e servicos.',
            },
        )
        return Lancamento.objects.create(
            type='receita',
            value=pedido.total,
            description=f'Venda - Pedido #{pedido.id}',
            date=timezone.localdate(),
            category=categoria,
            pedido=pedido,
            responsible=responsavel,
            payment_method=pedido.payment_method,
        )


def resumo_financeiro(inicio=None, fim=None):
    """Calcula total de receitas, despesas e saldo no periodo informado.

    Retorna um dicionario com total_receitas, total_despesas e saldo.
    Sem periodo, considera todos os lancamentos.
    """
    lancamentos = Lancamento.objects.all()

    if inicio is not None:
        lancamentos = lancamentos.filter(date__gte=inicio)
    if fim is not None:
        lancamentos = lancamentos.filter(date__lte=fim)

    total_receitas = (
        lancamentos.filter(type='receita').aggregate(total=Sum('value'))['total'] or 0
    )
    total_despesas = (
        lancamentos.filter(type='despesa').aggregate(total=Sum('value'))['total'] or 0
    )

    return {
        'total_receitas': total_receitas,
        'total_despesas': total_despesas,
        'saldo': total_receitas - total_despesas,
    }