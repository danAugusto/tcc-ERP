"""Regras de negocio e operacoes transacionais do modulo finance."""

from django.db.models import Sum

from .models import Lancamento


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