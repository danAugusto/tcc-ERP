from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from .models import Turno, Auditoria, Configuracao


def registrar_auditoria(user, acao: str, entidade: str, entidade_id: int, detalhes: str = None) -> Auditoria:
    """Registra uma ação de auditoria para rastreabilidade de eventos críticos."""
    if not user or not user.is_authenticated:
        return None
    return Auditoria.objects.create(
        user=user,
        acao=acao,
        entidade=entidade,
        entidade_id=entidade_id,
        detalhes=detalhes or '',
    )


@transaction.atomic
def iniciar_turno(user) -> Turno:
    """Inicia um turno de trabalho para o usuário logado."""
    turno_aberto = Turno.objects.filter(user=user, fim__isnull=True).first()
    if turno_aberto:
        return turno_aberto

    novo_turno = Turno.objects.create(user=user)

    # Se for entregador, coloca disponível
    if hasattr(user, 'perfil') and user.perfil.role == 'entregador':
        user.perfil.is_online = True
        user.perfil.save(update_fields=['is_online'])

    registrar_auditoria(
        user=user,
        acao='INICIOU_TURNO',
        entidade='rh_turno',
        entidade_id=novo_turno.id,
        detalhes=f'Turno iniciado às {novo_turno.inicio:%H:%M:%S}'
    )
    return novo_turno


@transaction.atomic
def encerrar_turno(user) -> Turno:
    """Encerra o turno de trabalho ativo do usuário."""
    turno_aberto = Turno.objects.filter(user=user, fim__isnull=True).first()
    if not turno_aberto:
        raise ValueError('Nenhum turno em aberto encontrado para este usuário.')

    agora = timezone.now()
    turno_aberto.fim = agora

    # Para entregadores: calcular o valor total de pedidos entregues recebidos em dinheiro
    if hasattr(user, 'perfil') and user.perfil.role == 'entregador':
        from orders.models import Pedido
        pedidos_dinheiro = Pedido.objects.filter(
            entregador=user,
            status='entregue',
            payment_method='dinheiro',
            created_at__gte=turno_aberto.inicio,
            created_at__lte=agora,
        )
        total_dinheiro = sum((p.total for p in pedidos_dinheiro), Decimal('0.00'))
        turno_aberto.saldo_dinheiro = total_dinheiro
        user.perfil.is_online = False
        user.perfil.save(update_fields=['is_online'])

    turno_aberto.save()

    registrar_auditoria(
        user=user,
        acao='ENCERROU_TURNO',
        entidade='rh_turno',
        entidade_id=turno_aberto.id,
        detalhes=f'Turno encerrado. Saldo dinheiro: R$ {turno_aberto.saldo_dinheiro:.2f}'
    )
    return turno_aberto


@transaction.atomic
def confirmar_acerto_caixa(turno_id: int, gerente_user) -> Turno:
    """Confirma o acerto de contas em dinheiro do turno de um entregador."""
    turno = Turno.objects.get(id=turno_id)
    turno.acerto_confirmado = True
    turno.save(update_fields=['acerto_confirmado'])

    registrar_auditoria(
        user=gerente_user,
        acao='CONFIRMOU_ACERTO_CAIXA',
        entidade='rh_turno',
        entidade_id=turno.id,
        detalhes=f'Gerente {gerente_user.username} confirmou acerto de R$ {turno.saldo_dinheiro:.2f} do funcionário {turno.user.username}'
    )
    return turno


NOME_ESTABELECIMENTO_CHAVE = 'NOME_ESTABELECIMENTO'
NOME_ESTABELECIMENTO_PADRAO = 'PL Lanchonete & Pastelaria'


# Dados operacionais do estabelecimento (todos editáveis em Configurações e lidos pelo cardápio/cupom)
ESTABELECIMENTO_CAMPOS = {
    'telefone': ('TELEFONE', ''),
    'endereco': ('ENDERECO', ''),
    'cnpj': ('CNPJ', ''),
    'taxa_entrega': ('TAXA_ENTREGA', '0.00'),
    'tempo_entrega': ('TEMPO_ENTREGA', ''),
    'tempo_retirada': ('TEMPO_RETIRADA', ''),
    'pedido_minimo': ('PEDIDO_MINIMO', '0.00'),
    'aceita_pedidos_online': ('ACEITA_PEDIDOS_ONLINE', 'true'),
}


def dados_estabelecimento() -> dict:
    valores = {campo: obter_configuracao(chave, padrao) for campo, (chave, padrao) in ESTABELECIMENTO_CAMPOS.items()}
    valores['aceita_pedidos_online'] = valores['aceita_pedidos_online'].strip().lower() == 'true'
    return valores


def obter_decimal_configuracao(campo: str) -> Decimal:
    chave, padrao = ESTABELECIMENTO_CAMPOS[campo]
    try:
        return Decimal(obter_configuracao(chave, padrao) or '0')
    except Exception:
        return Decimal('0')


def obter_nome_estabelecimento() -> str:
    return obter_configuracao(NOME_ESTABELECIMENTO_CHAVE, NOME_ESTABELECIMENTO_PADRAO)


def obter_configuracao(chave: str, valor_padrao: str = '') -> str:
    """Busca valor de configuração do sistema ou cria se não existir."""
    cfg, _ = Configuracao.objects.get_or_create(
        chave=chave,
        defaults={'valor': valor_padrao}
    )
    return cfg.valor


# ---------------------------------------------------------------------------
# Automacoes RPA
# ---------------------------------------------------------------------------

RPA_TASKS = ('rpa-01', 'rpa-02', 'rpa-03')


def _rpa_sincronizar_pedidos(user) -> dict:
    """rpa-01: garante que todo pedido em andamento tenha registro FIFO em Preparo."""
    from orders.models import Pedido
    from preparation.models import Preparo

    status_map = {'confirmado': 'pendente', 'em_preparo': 'em_preparo', 'pronto': 'pronto'}
    pedidos = Pedido.objects.filter(status__in=status_map.keys())
    auditados = pedidos.count()
    corrigidos = []
    for pedido in pedidos.filter(preparo__isnull=True):
        Preparo.objects.create(pedido=pedido, status=status_map[pedido.status])
        corrigidos.append(pedido.id)

    detalhes = (
        f'{auditados} pedidos auditados; {len(corrigidos)} sem preparo corrigidos'
        + (f' (pedidos: {", ".join(f"#{i}" for i in corrigidos)})' if corrigidos else '')
    )
    registrar_auditoria(user, 'RPA_SINCRONIZACAO_PEDIDOS', 'orders_pedido', 0, detalhes)
    return {
        'itens_auditados': auditados,
        'alertas': len(corrigidos),
        'mensagem': f'{auditados} pedidos auditados, {len(corrigidos)} corrigidos',
    }


def _rpa_estoque_critico(user) -> dict:
    """rpa-02: varre insumos e consolida os itens com estoque no minimo ou abaixo."""
    from inventory.models import Insumo

    insumos = list(Insumo.objects.all())
    criticos = [i for i in insumos if i.quantidade_atual <= i.estoque_minimo]
    lista = '; '.join(
        f'{i.nome} ({i.quantidade_atual} {i.unidade_medida} / min {i.estoque_minimo})' for i in criticos
    )
    detalhes = f'{len(insumos)} insumos auditados; {len(criticos)} críticos' + (f': {lista}' if criticos else '')
    registrar_auditoria(user, 'RPA_ALERTA_ESTOQUE', 'inventory_insumo', 0, detalhes)
    return {
        'itens_auditados': len(insumos),
        'alertas': len(criticos),
        'insumos_criticos': [i.nome for i in criticos],
        'mensagem': f'{len(insumos)} insumos auditados, {len(criticos)} críticos identificados',
    }


def _rpa_conciliacao_caixa(user) -> dict:
    """rpa-03: totaliza lancamentos do dia por forma de pagamento e concilia o dinheiro dos turnos."""
    from finance.models import Lancamento

    hoje = timezone.localdate()
    lancamentos = list(Lancamento.objects.filter(date=hoje))
    por_forma = {}
    receitas = despesas = Decimal('0.00')
    for l in lancamentos:
        bucket = por_forma.setdefault(l.payment_method, Decimal('0.00'))
        if l.type == 'receita':
            receitas += l.value
            por_forma[l.payment_method] = bucket + l.value
        else:
            despesas += l.value

    dinheiro_lancado = por_forma.get('dinheiro', Decimal('0.00'))
    turnos = Turno.objects.filter(inicio__date=hoje)
    dinheiro_turnos = sum((t.saldo_dinheiro for t in turnos), Decimal('0.00'))
    divergencia = dinheiro_lancado - dinheiro_turnos
    alertas = 1 if divergencia != 0 else 0

    formas = ', '.join(f'{k}: R$ {v:.2f}' for k, v in sorted(por_forma.items())) or 'sem receitas'
    detalhes = (
        f'Receitas R$ {receitas:.2f} | Despesas R$ {despesas:.2f} | Saldo R$ {receitas - despesas:.2f} | '
        f'Por forma de pagamento -> {formas} | Dinheiro em turnos R$ {dinheiro_turnos:.2f} | '
        f'Divergência R$ {divergencia:.2f}'
    )
    registrar_auditoria(user, 'RPA_CONCILIACAO_CAIXA', 'finance_lancamento', 0, detalhes)
    return {
        'itens_auditados': len(lancamentos),
        'alertas': alertas,
        'receitas': str(receitas),
        'despesas': str(despesas),
        'divergencia_dinheiro': str(divergencia),
        'mensagem': (
            f'{len(lancamentos)} lançamentos conciliados, saldo R$ {receitas - despesas:.2f}, '
            f'divergência em dinheiro R$ {divergencia:.2f}'
        ),
    }


def executar_rpa(task_id: str, user) -> dict:
    """Executa uma rotina RPA, grava evidencia em Auditoria e devolve o resumo."""
    import time

    handlers = {
        'rpa-01': _rpa_sincronizar_pedidos,
        'rpa-02': _rpa_estoque_critico,
        'rpa-03': _rpa_conciliacao_caixa,
    }
    if task_id not in handlers:
        raise ValueError(f'Rotina RPA desconhecida: {task_id}')
    inicio = time.monotonic()
    with transaction.atomic():
        resultado = handlers[task_id](user)
    resultado['task_id'] = task_id
    resultado['tempo_ms'] = round((time.monotonic() - inicio) * 1000)
    return resultado
