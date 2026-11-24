from decimal import Decimal
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Sum, Count, Avg
from rest_framework.views import APIView
from rest_framework.response import Response

from orders.models import Pedido
from .models import Configuracao
from users.permissions import IsAdministrador


class MetricasAnaliticasView(APIView):
    """Calcula e retorna métricas analíticas operacionais e de faturamento."""

    permission_classes = [IsAdministrador]

    def get(self, request):
        periodo = request.query_params.get('periodo', 'mes_atual')
        agora = timezone.now()

        # Definição das datas do filtro
        if periodo == 'hoje':
            inicio = agora.replace(hour=0, minute=0, second=0, microsecond=0)
            fim = agora.replace(hour=23, minute=59, second=59, microsecond=999999)
        elif periodo == '7dias':
            inicio = (agora - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
            fim = agora
        elif periodo == 'mes_passado':
            primeiro_dia_mes_atual = agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            ultimo_dia_mes_passado = primeiro_dia_mes_atual - timedelta(seconds=1)
            inicio = ultimo_dia_mes_passado.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            fim = ultimo_dia_mes_passado
        else:  # mes_atual (padrão)
            inicio = agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            fim = agora

        # Faturamento considera apenas pedidos que efetivamente geraram receita
        ESTADOS_FATURAMENTO = ('entregue', 'finalizado')
        pedidos_validos = Pedido.objects.filter(status__in=ESTADOS_FATURAMENTO)
        pedidos_periodo = pedidos_validos.filter(created_at__gte=inicio, created_at__lte=fim)

        # Totais
        agg = pedidos_periodo.aggregate(
            total_faturamento=Sum('total'),
            total_pedidos=Count('id'),
            ticket_medio=Avg('total'),
        )

        total_faturamento = agg['total_faturamento'] or Decimal('0.00')
        total_pedidos = agg['total_pedidos'] or 0
        ticket_medio = agg['ticket_medio'] or Decimal('0.00')

        # Meta de faturamento mensal
        cfg_meta = Configuracao.objects.filter(chave='META_FATURAMENTO_MENSAL').first()
        meta_valor = Decimal(cfg_meta.valor if cfg_meta else '10000.00')

        # Faturamento do mês corrente para a meta
        inicio_mes = agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        faturamento_mes_atual = pedidos_validos.filter(created_at__gte=inicio_mes).aggregate(
            total=Sum('total')
        )['total'] or Decimal('0.00')

        progresso_meta = min(100.0, float((faturamento_mes_atual / meta_valor) * 100)) if meta_valor > 0 else 0.0

        # Vendas por canal / tipo de atendimento
        por_canal = (
            pedidos_periodo.values('tipo_atendimento')
            .annotate(quantidade=Count('id'), total=Sum('total'))
            .order_by('-total')
        )

        # Vendas por método de pagamento
        por_pagamento = (
            pedidos_periodo.values('payment_method')
            .annotate(quantidade=Count('id'), total=Sum('total'))
            .order_by('-total')
        )

        # Série temporal (diária)
        serie_temporal = []
        dias_total = (fim.date() - inicio.date()).days + 1
        dias_total = max(1, min(dias_total, 31))

        for i in range(dias_total):
            dia_ref = inicio.date() + timedelta(days=i)
            dia_inicio = timezone.make_aware(datetime.combine(dia_ref, datetime.min.time()))
            dia_fim = timezone.make_aware(datetime.combine(dia_ref, datetime.max.time()))

            dia_agg = pedidos_validos.filter(created_at__gte=dia_inicio, created_at__lte=dia_fim).aggregate(
                total=Sum('total'),
                qtd=Count('id')
            )
            serie_temporal.append({
                'data': dia_ref.strftime('%d/%m'),
                'total': float(dia_agg['total'] or 0),
                'pedidos': dia_agg['qtd'] or 0,
            })

        return Response({
            'periodo': periodo,
            'inicio': inicio.isoformat(),
            'fim': fim.isoformat(),
            'total_faturamento': float(total_faturamento),
            'total_pedidos': total_pedidos,
            'ticket_medio': float(ticket_medio),
            'meta_faturamento': float(meta_valor),
            'faturamento_mes_atual': float(faturamento_mes_atual),
            'progresso_meta_percentual': round(progresso_meta, 1),
            'vendas_por_canal': list(por_canal),
            'vendas_por_pagamento': list(por_pagamento),
            'serie_temporal': serie_temporal,
        })
