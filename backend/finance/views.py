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


class CategoryListCreateView(generics.ListCreateAPIView):
    """Lista ou cria categorias financeiras, opcionalmente por tipo."""

    serializer_class = FinanceCategorySerializer
    queryset = FinanceCategory.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        tipo = self.request.query_params.get('tipo')
        if tipo:
            queryset = queryset.filter(type=tipo)
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
    """Lista ou cria lancamentos financeiros, opcionalmente por tipo."""

    serializer_class = LancamentoSerializer
    queryset = Lancamento.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        tipo = self.request.query_params.get('tipo')
        if tipo:
            queryset = queryset.filter(type=tipo)
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
        inicio = self._parse_date(request.query_params.get('inicio'), 'inicio')
        fim = self._parse_date(request.query_params.get('fim'), 'fim')
        resumo = resumo_financeiro(inicio=inicio, fim=fim)
        serializer = self.serializer_class(resumo)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def _parse_date(self, value, name):
        if value is None:
            return None
        try:
            return date.fromisoformat(value)
        except ValueError:
            raise ValidationError({name: 'Data invalida. Use o formato AAAA-MM-DD.'})