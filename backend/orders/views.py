"""Views do modulo de pedidos."""

from decimal import Decimal
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import generics
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .models import Pedido
from .permissions import PodeOperarPedidos, is_equipe
from .serializers import PedidoSerializer
from .services import transicionar_status
from users.permissions import tem_permissao


def inteiro_positivo(valor, campo, padrao=None):
    """Converte valor de request.data em inteiro, respondendo 400 se invalido."""
    if valor in (None, ''):
        if padrao is not None:
            return padrao
        raise ValidationError({campo: 'Campo obrigatorio.'})
    try:
        numero = int(str(valor))
    except ValueError:
        raise ValidationError({campo: 'Informe um numero inteiro valido.'})
    return numero


class PedidoListCreateView(generics.ListCreateAPIView):
    """Lista ou cria pedidos, respeitando a visibilidade por perfil."""

    serializer_class = PedidoSerializer
    queryset = Pedido.objects.select_related('cliente', 'entregador', 'endereco', 'cancelled_by').prefetch_related('itens__produto')

    def get_queryset(self):
        queryset = super().get_queryset()
        if not is_equipe(self.request.user):
            queryset = queryset.filter(cliente=self.request.user)
        return queryset

    def perform_create(self, serializer):
        if is_equipe(self.request.user):
            serializer.save()
            return
        # Pedido feito pelo app do cliente: respeita as regras definidas em Configurações
        from core.services import dados_estabelecimento, obter_decimal_configuracao
        if not dados_estabelecimento()['aceita_pedidos_online']:
            raise ValidationError('A loja não está recebendo pedidos pelo aplicativo agora. Tente mais tarde.')
        minimo = obter_decimal_configuracao('pedido_minimo')
        subtotal = sum(
            (item['produto'].preco * item['quantidade'] for item in serializer.validated_data.get('itens', [])),
            Decimal('0'),
        )
        if minimo > 0 and subtotal < minimo:
            raise ValidationError(f'O pedido mínimo é de R$ {minimo:.2f}'.replace('.', ',') + '.')
        serializer.save(
            cliente=self.request.user, entregador=None,
            valor_recebido=0, troco=0,
        )


class PedidoDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Consulta, altera ou exclui um pedido."""

    serializer_class = PedidoSerializer
    queryset = Pedido.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        if not is_equipe(self.request.user):
            queryset = queryset.filter(cliente=self.request.user)
        return queryset

    def _devolver_insumos(self):
        valor = self.request.data.get('devolver_insumos')
        if valor is None:
            return None
        return str(valor).strip().lower() in ('true', '1', 'yes')

    def perform_update(self, serializer):
        if not is_equipe(self.request.user):
            raise PermissionDenied('Apenas a equipe pode alterar pedidos.')

        novo_status = serializer.validated_data.get('status')
        if novo_status and novo_status != serializer.instance.status:
            if novo_status == 'cancelado' and not tem_permissao(self.request.user, 'CANCELAR_PEDIDO'):
                raise PermissionDenied('Você não possui permissão para cancelar pedidos.')
            if novo_status == 'cancelado' and not (serializer.validated_data.get('cancellation_reason') or '').strip():
                raise ValidationError({'cancellation_reason': 'Informe o motivo do cancelamento.'})
            transicionar_status(
                serializer.instance,
                novo_status,
                responsavel=self.request.user,
                motivo=serializer.validated_data.get('cancellation_reason'),
                devolver_insumos=self._devolver_insumos(),
            )
        else:
            serializer.save()

    def perform_destroy(self, instance):
        if not is_equipe(self.request.user):
            raise PermissionDenied('Apenas a equipe pode excluir pedidos.')
        if not tem_permissao(self.request.user, 'CANCELAR_PEDIDO'):
            raise PermissionDenied('Você não possui permissão para excluir pedidos.')

        if instance.status in ('entregue', 'finalizado'):
            raise ValidationError(
                'Nao e possivel excluir um pedido finalizado/entregue, pois ele ja gerou receita.'
            )
        instance.delete()


class OrderPayView(generics.GenericAPIView):
    """Registra a simulacao de pagamento e finaliza o pedido."""

    queryset = Pedido.objects.all()
    serializer_class = PedidoSerializer

    def post(self, request, *args, **kwargs):
        if not is_equipe(request.user):
            raise PermissionDenied('Apenas a equipe pode registrar pagamentos.')

        pedido = self.get_object()
        if pedido.status in ('finalizado', 'cancelado', 'arquivado'):
            raise ValidationError(
                f'Nao e possivel realizar o pagamento de um pedido com status {pedido.get_status_display()}.'
            )

        from decimal import Decimal, InvalidOperation
        from finance.models import PAYMENT_CHOICES

        # Validar forma de pagamento
        payment_method = request.data.get('payment_method', pedido.payment_method)
        metodos_validos = [c[0] for c in PAYMENT_CHOICES]
        if payment_method not in metodos_validos:
            raise ValidationError(
                {'payment_method': f'Metodo invalido. Use: {metodos_validos}'}
            )

        # Validar valor recebido
        try:
            valor_recebido = Decimal(str(request.data.get('valor_recebido', pedido.total)))
        except (InvalidOperation, TypeError, ValueError):
            raise ValidationError({'valor_recebido': 'Valor recebido invalido.'})

        if valor_recebido < 0:
            raise ValidationError({'valor_recebido': 'O valor recebido nao pode ser negativo.'})
        if valor_recebido < pedido.total:
            raise ValidationError(
                {'valor_recebido': f'Valor insuficiente. Total do pedido: R$ {pedido.total}'}
            )

        # Troco calculado no servidor — nunca aceitar do cliente
        troco = valor_recebido - pedido.total

        pedido.payment_method = payment_method
        pedido.valor_recebido = valor_recebido
        pedido.troco = troco
        pedido.save(update_fields=['payment_method', 'valor_recebido', 'troco', 'updated_at'])

        # Se ainda estava criado, confirma primeiro para debitar estoque se necessario
        if pedido.status == 'criado':
            transicionar_status(pedido, 'confirmado', responsavel=request.user)

        # Transiciona para finalizado, criando automaticamente a receita financeira
        transicionar_status(pedido, 'finalizado', responsavel=request.user)

        serializer = self.get_serializer(pedido)
        return Response(serializer.data, status=200)


class CloseShiftView(generics.GenericAPIView):
    """Encerra o expediente, arquivando pedidos finalizados e cancelados."""

    def post(self, request, *args, **kwargs):
        if not is_equipe(request.user):
            raise PermissionDenied('Apenas a equipe pode encerrar o expediente.')
        if not tem_permissao(request.user, 'FECHAR_CAIXA'):
            raise PermissionDenied('Você não possui permissão para encerrar o expediente / fechar caixa.')

        total_arquivados = Pedido.objects.filter(status__in=['finalizado', 'cancelado']).update(
            status='arquivado', updated_at=timezone.now()
        )

        return Response({
            'arquivados': total_arquivados,
            'message': f'Expediente encerrado com sucesso. {total_arquivados} pedido(s) arquivado(s).'
        }, status=200)


class OrderAddItemView(generics.GenericAPIView):
    """Adiciona um item a uma comanda ou pedido em andamento (permitido antes do preparo)."""

    queryset = Pedido.objects.all()
    serializer_class = PedidoSerializer

    def post(self, request, *args, **kwargs):
        if not is_equipe(request.user):
            raise PermissionDenied('Apenas a equipe pode alterar itens do pedido.')

        pedido = self.get_object()
        if pedido.status not in ('criado', 'confirmado'):
            raise ValidationError(
                'Itens não podem ser alterados após o início do preparo do pedido.'
            )

        produto_id = request.data.get('produto')
        quantidade = inteiro_positivo(request.data.get('quantidade'), 'quantidade', padrao=1)

        if not produto_id:
            raise ValidationError({'produto': 'O ID do produto e obrigatorio.'})
        if quantidade <= 0:
            raise ValidationError({'quantidade': 'A quantidade deve ser maior que zero.'})

        from decimal import Decimal
        from django.db import transaction
        from catalog.models import Produto
        from inventory.models import Movimentacao
        from .models import ItemPedido
        from .services import recalcular_total

        try:
            produto = Produto.objects.get(id=produto_id)
        except Produto.DoesNotExist:
            raise ValidationError({'produto': 'Produto nao encontrado.'})

        if not produto.disponibilidade:
            raise ValidationError({'produto': f'Produto indisponivel: {produto.nome}.'})

        with transaction.atomic():
            # Se o pedido já está confirmado, verificar e debitar estoque para o novo item
            if pedido.status == 'confirmado':
                for rec_item in produto.receita_itens.select_related('insumo').all():
                    qtd_nec = rec_item.quantidade_necessaria * Decimal(quantidade)
                    if rec_item.insumo.quantidade_atual < qtd_nec:
                        raise ValidationError(
                            f'Estoque insuficiente para {rec_item.insumo.nome}. '
                            f'Necessário: {qtd_nec}, Disponível: {rec_item.insumo.quantidade_atual}'
                        )
                    Movimentacao.objects.create(
                        insumo=rec_item.insumo,
                        tipo=Movimentacao.Tipo.SAIDA,
                        quantidade=qtd_nec,
                        motivo=Movimentacao.Motivo.BAIXA,
                        responsavel=request.user
                    )

            # Se ja existe o item no pedido, incrementa a quantidade
            item_existente = pedido.itens.filter(produto=produto).first()
            if item_existente:
                item_existente.quantidade += quantidade
                item_existente.save(update_fields=['quantidade'])
            else:
                ItemPedido.objects.create(
                    pedido=pedido,
                    produto=produto,
                    quantidade=quantidade,
                    preco_unitario=produto.preco,
                )

            recalcular_total(pedido)

        serializer = self.get_serializer(pedido)
        return Response(serializer.data, status=200)


class OrderRemoveItemView(generics.GenericAPIView):
    """Remove um item de um pedido em andamento (permitido antes do preparo)."""

    queryset = Pedido.objects.all()
    serializer_class = PedidoSerializer

    def post(self, request, *args, **kwargs):
        if not is_equipe(request.user):
            raise PermissionDenied('Apenas a equipe pode alterar itens do pedido.')

        pedido = self.get_object()
        if pedido.status not in ('criado', 'confirmado'):
            raise ValidationError(
                'Itens não podem ser removidos após o início do preparo do pedido.'
            )

        item_id = inteiro_positivo(request.data.get('item_id'), 'item_id')

        item = pedido.itens.filter(id=item_id).first()
        if not item:
            raise ValidationError({'item_id': 'Item nao encontrado no pedido.'})

        if pedido.itens.count() <= 1:
            raise ValidationError('Um pedido deve ter pelo menos um item. Cancele o pedido se desejar.')

        from decimal import Decimal
        from django.db import transaction
        from inventory.models import Movimentacao
        from .services import recalcular_total

        with transaction.atomic():
            # Se o pedido já havia sido confirmado, devolve os insumos do item removido ao estoque
            if pedido.status == 'confirmado':
                for rec_item in item.produto.receita_itens.select_related('insumo').all():
                    qtd_ret = rec_item.quantidade_necessaria * Decimal(item.quantidade)
                    Movimentacao.objects.create(
                        insumo=rec_item.insumo,
                        tipo=Movimentacao.Tipo.ENTRADA,
                        quantidade=qtd_ret,
                        motivo=Movimentacao.Motivo.DEVOLUCAO,
                        responsavel=request.user
                    )

            item.delete()
            recalcular_total(pedido)

        serializer = self.get_serializer(pedido)
        return Response(serializer.data, status=200)


import hmac
import secrets
from django.contrib.auth import get_user_model
from core.models import Configuracao

User = get_user_model()


class MinhasEntregasView(generics.ListAPIView):
    """Retorna os pedidos atribuídos ao entregador autenticado."""

    serializer_class = PedidoSerializer

    def get_queryset(self):
        return Pedido.objects.filter(entregador=self.request.user).exclude(
            status__in=['finalizado', 'arquivado', 'cancelado']
        ).order_by('-created_at')


class AtribuirEntregadorView(generics.GenericAPIView):
    """Atribui um entregador a um pedido respeitando regras de disponibilidade e limite máximo."""

    queryset = Pedido.objects.all()
    serializer_class = PedidoSerializer

    def post(self, request, *args, **kwargs):
        if not is_equipe(request.user):
            raise PermissionDenied('Apenas atendentes/gerentes podem atribuir entregadores.')

        pedido = self.get_object()
        if pedido.tipo_atendimento != 'delivery':
            raise ValidationError('Somente pedidos de delivery podem ter entregador.')
        if pedido.status not in ('confirmado', 'em_preparo', 'pronto', 'retornando_base'):
            raise ValidationError(
                f'Nao e possivel atribuir entregador a um pedido {pedido.get_status_display().lower()}.'
            )
        entregador_id = inteiro_positivo(request.data.get('entregador_id'), 'entregador_id')

        try:
            entregador = User.objects.select_related('perfil').get(id=entregador_id)
        except User.DoesNotExist:
            raise ValidationError({'entregador_id': 'Entregador não encontrado.'})

        if not hasattr(entregador, 'perfil') or entregador.perfil.role != 'entregador':
            raise ValidationError({'entregador_id': 'O usuário selecionado não é um entregador.'})

        if not entregador.perfil.is_online:
            raise ValidationError({'entregador_id': 'Este entregador está indisponível/offline no momento.'})

        # Verifica limite máximo de pedidos simultâneos
        cfg_limite = Configuracao.objects.filter(chave='LIMITE_PEDIDOS_ENTREGADOR').first()
        limite = int(cfg_limite.valor) if cfg_limite and cfg_limite.valor.isdigit() else 4

        entregas_ativas = Pedido.objects.filter(
            entregador=entregador,
            status__in=['confirmado', 'em_preparo', 'pronto', 'retornando_base']
        ).count()

        if entregas_ativas >= limite:
            raise ValidationError({
                'entregador_id': f'Entregador atingiu o limite máximo de entregas simultâneas ({limite}).'
            })

        # Atribui entregador e gera PIN de entrega se não existir
        pedido.entregador = entregador
        if not pedido.codigo_pin_entrega:
            pedido.codigo_pin_entrega = f'{secrets.randbelow(10000):04d}'
        pedido.save(update_fields=['entregador', 'codigo_pin_entrega', 'updated_at'])

        return Response(self.get_serializer(pedido).data, status=200)


MAX_TENTATIVAS_PIN = 5


class ConfirmarEntregaView(generics.GenericAPIView):
    """Finaliza a entrega exigindo método de validação (PIN, Foto ou Assinatura)."""

    queryset = Pedido.objects.all()
    serializer_class = PedidoSerializer

    def post(self, request, *args, **kwargs):
        pedido = self.get_object()
        if pedido.entregador != request.user and not is_equipe(request.user):
            raise PermissionDenied('Apenas o entregador responsável ou a loja pode confirmar esta entrega.')

        METODOS_VALIDOS = ('pin', 'foto', 'assinatura')
        metodo = request.data.get('metodo_validacao', 'pin')
        if metodo not in METODOS_VALIDOS:
            raise ValidationError(
                {'metodo_validacao': f'Metodo invalido. Use: {METODOS_VALIDOS}'}
            )
        pin_informado = str(request.data.get('pin', '')).strip()
        comprovante_url = request.data.get('comprovante_url')

        if metodo == 'pin':
            if pedido.tentativas_pin >= MAX_TENTATIVAS_PIN:
                raise PermissionDenied('PIN bloqueado por excesso de tentativas. Procure a loja.')
            if not pin_informado or not hmac.compare_digest(pin_informado, pedido.codigo_pin_entrega or ''):
                pedido.tentativas_pin += 1
                pedido.save(update_fields=['tentativas_pin'])
                raise ValidationError({'pin': 'Código PIN incorreto.'})
        elif metodo in ('foto', 'assinatura'):
            if not comprovante_url:
                raise ValidationError({'comprovante_url': 'O comprovante de entrega é obrigatório.'})
            pedido.comprovante_entrega_url = comprovante_url
            pedido.save(update_fields=['comprovante_entrega_url'])

        # Transiciona status para entregue
        transicionar_status(pedido, 'entregue', responsavel=request.user)

        return Response(self.get_serializer(pedido).data, status=200)


class FalhaEntregaView(generics.GenericAPIView):
    """Registra insucesso na entrega (cliente ausente, etc.) e muda para retornando_base."""

    queryset = Pedido.objects.all()
    serializer_class = PedidoSerializer

    def post(self, request, *args, **kwargs):
        pedido = self.get_object()
        if pedido.entregador != request.user and not is_equipe(request.user):
            raise PermissionDenied('Apenas o entregador responsável ou a loja pode reportar falha.')

        motivo = request.data.get('motivo')
        if not motivo:
            raise ValidationError({'motivo': 'O motivo da falha é obrigatório.'})

        pedido.motivo_falha_entrega = motivo
        pedido.save(update_fields=['motivo_falha_entrega'])

        transicionar_status(pedido, 'retornando_base', responsavel=request.user, motivo=motivo)

        return Response(self.get_serializer(pedido).data, status=200)


class EntregadoresDisponiveisView(generics.GenericAPIView):
    """Lista entregadores disponíveis para despacho com contagem de pedidos ativos."""

    permission_classes = [PodeOperarPedidos]

    def get(self, request, *args, **kwargs):
        cfg_limite = Configuracao.objects.filter(chave='LIMITE_PEDIDOS_ENTREGADOR').first()
        limite = int(cfg_limite.valor) if cfg_limite and cfg_limite.valor.isdigit() else 4

        ativos = Q(entregas__status__in=['confirmado', 'em_preparo', 'pronto', 'retornando_base'])
        entregadores = (
            User.objects.filter(perfil__role='entregador')
            .select_related('perfil')
            .annotate(ativas=Count('entregas', filter=ativos))
        )
        data = []
        for ent in entregadores:
            ativas = ent.ativas
            data.append({
                'id': ent.id,
                'nome': f'{ent.first_name} {ent.last_name}'.strip() or ent.username,
                'username': ent.username,
                'is_online': ent.perfil.is_online,
                'entregas_ativas': ativas,
                'limite_maximo': limite,
                'disponivel_para_atribuir': ent.perfil.is_online and ativas < limite,
            })
        return Response(data, status=200)
