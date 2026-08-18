from datetime import date

from django.db.models.deletion import ProtectedError
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import FinanceCategory, Lancamento
from .serializers import (
    FinanceCategorySerializer,
    LancamentoSerializer,
    ResumoFinanceiroSerializer,
)
from .services import resumo_financeiro

TIPO_CHOICES = dict(Lancamento.TYPE_CHOICES)


def _validate_tipo(tipo):
    if tipo not in TIPO_CHOICES:
        raise ValidationError({'tipo': 'Tipo invalido. Use receita ou despesa.'})
    return tipo


def _parse_date(value, name):
    if value is None:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError({name: 'Data invalida. Use o formato AAAA-MM-DD.'})


def _parse_categoria(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValidationError({'categoria': 'Categoria invalida.'})


class CategoryListCreateView(generics.ListCreateAPIView):
    """Lista ou cria categorias financeiras, opcionalmente por tipo."""

    serializer_class = FinanceCategorySerializer
    queryset = FinanceCategory.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        tipo = self.request.query_params.get('tipo')
        if tipo:
            queryset = queryset.filter(type=_validate_tipo(tipo))
        return queryset


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Consulta, altera ou exclui uma categoria financeira."""

    serializer_class = FinanceCategorySerializer
    queryset = FinanceCategory.objects.all()

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError(
                'Nao e possivel excluir uma categoria que possui lancamentos.'
            )


class LancamentoListCreateView(generics.ListCreateAPIView):
    """Lista ou cria lancamentos financeiros, com filtros por periodo e categoria."""

    serializer_class = LancamentoSerializer
    queryset = Lancamento.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()

        tipo = self.request.query_params.get('tipo')
        if tipo:
            queryset = queryset.filter(type=_validate_tipo(tipo))

        categoria = self.request.query_params.get('categoria')
        if categoria:
            queryset = queryset.filter(category_id=_parse_categoria(categoria))

        inicio = _parse_date(self.request.query_params.get('inicio'), 'inicio')
        fim = _parse_date(self.request.query_params.get('fim'), 'fim')
        if inicio and fim and fim < inicio:
            raise ValidationError(
                {'fim': 'A data final deve ser maior ou igual a data inicial.'}
            )
        if inicio:
            queryset = queryset.filter(date__gte=inicio)
        if fim:
            queryset = queryset.filter(date__lte=fim)

        return queryset

    def perform_create(self, serializer):
        serializer.save(responsible=self.request.user)


class LancamentoDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Consulta, altera ou exclui um lancamento financeiro."""

    serializer_class = LancamentoSerializer
    queryset = Lancamento.objects.all()


class FinanceSummaryView(APIView):
    """Resumo financeiro com totais de receitas, despesas e saldo do periodo."""

    serializer_class = ResumoFinanceiroSerializer

    def get(self, request):
        inicio = _parse_date(request.query_params.get('inicio'), 'inicio')
        fim = _parse_date(request.query_params.get('fim'), 'fim')
        if inicio and fim and fim < inicio:
            raise ValidationError(
                {'fim': 'A data final deve ser maior ou igual a data inicial.'}
            )
        resumo = resumo_financeiro(inicio=inicio, fim=fim)
        serializer = self.serializer_class(resumo)
        return Response(serializer.data, status=status.HTTP_200_OK)