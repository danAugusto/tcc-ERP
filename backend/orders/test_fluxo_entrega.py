"""Cenarios de ponta a ponta do roteiro (3.7 a 3.14): entrega, falha, cancelamento, edicao e visibilidade."""

from django.urls import reverse

from core.models import Turno
from finance.models import Lancamento
from inventory.models import Insumo, ReceitaItem
from preparation.models import Preparo

from .models import Pedido
from .tests import PedidoBaseTestCase


class FluxoBase(PedidoBaseTestCase):
    def setUp(self):
        self.atendente = self._create_user('atend_fluxo', role='atendente')
        self.cozinheiro = self._create_user('coz_fluxo', role='cozinheiro')
        self.entregador = self._create_user('ent_fluxo', role='entregador')
        self.outro_entregador = self._create_user('ent2_fluxo', role='entregador')
        self.cliente = self._create_user('cli_fluxo', role='cliente')
        self.outro_cliente = self._create_user('cli2_fluxo', role='cliente')
        self.product = self._create_product(price='20.00')
        for ent in (self.entregador, self.outro_entregador):
            Turno.objects.create(user=ent)
            ent.perfil.is_online = True
            ent.perfil.save(update_fields=['is_online'])

    # --- helpers
    def como(self, user):
        self.client.force_authenticate(user=user)

    def novo_pedido(self, user=None, tipo='delivery', qty=1):
        self.como(user or self.cliente)
        payload = self._pedido_payload(self.product, qty)
        payload['tipo_atendimento'] = tipo
        if tipo == 'delivery':
            payload['endereco'] = {
                'cep': '01001-000', 'logradouro': 'Rua A', 'numero': '1',
                'bairro': 'Centro', 'cidade': 'SP', 'uf': 'SP',
            }
        res = self.client.post(reverse('orders:pedido_list_create'), payload, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        return res.data['id']

    def status(self, pid, novo, user=None, **extra):
        self.como(user or self.atendente)
        return self.client.patch(self._pedido_url(pid), {'status': novo, **extra}, format='json')

    def pronto(self, pid):
        self.assertEqual(self.status(pid, 'confirmado').status_code, 200)
        self.como(self.cozinheiro)
        preparo = Preparo.objects.get(pedido_id=pid)
        for acao in ('start', 'complete'):
            r = self.client.post(f'/api/preparation/{preparo.id}/{acao}/')
            self.assertEqual(r.status_code, 200, r.data)

    def atribuir(self, pid, ent=None, user=None):
        self.como(user or self.atendente)
        return self.client.post(
            f'/api/orders/{pid}/atribuir-entregador/', {'entregador_id': (ent or self.entregador).id}, format='json'
        )

    def pagar(self, pid, metodo='pix'):
        self.como(self.atendente)
        return self.client.post(f'/api/orders/{pid}/pay/', {'payment_method': metodo}, format='json')


class EntregaTests(FluxoBase):
    # 3.7
    def test_entregador_ve_corrida_atribuida_e_so_a_dele(self):
        pid = self.novo_pedido()
        self.pronto(pid)
        self.assertEqual(self.atribuir(pid).status_code, 200)

        self.como(self.entregador)
        ids = [p['id'] for p in self.client.get('/api/orders/minhas-entregas/').data['results']]
        self.assertIn(pid, ids)
        self.como(self.outro_entregador)
        ids = [p['id'] for p in self.client.get('/api/orders/minhas-entregas/').data['results']]
        self.assertNotIn(pid, ids)

    def test_atribuicao_exige_entregador_online_com_turno(self):
        pid = self.novo_pedido()
        self.pronto(pid)
        self.entregador.perfil.is_online = False
        self.entregador.perfil.save(update_fields=['is_online'])
        self.assertEqual(self.atribuir(pid).status_code, 400)

    def test_nao_atribui_entregador_a_pedido_que_nao_e_delivery(self):
        pid = self.novo_pedido(user=self.atendente, tipo='mesa')
        self.pronto(pid)
        self.assertEqual(self.atribuir(pid).status_code, 400)

    def test_nao_atribui_entregador_a_pedido_cancelado_ou_finalizado(self):
        pid = self.novo_pedido()
        self.status(pid, 'confirmado')
        self.status(pid, 'cancelado', cancellation_reason='teste')
        self.assertEqual(self.atribuir(pid).status_code, 400)

    def test_cliente_nao_atribui_entregador(self):
        pid = self.novo_pedido()
        self.assertEqual(self.atribuir(pid, user=self.cliente).status_code, 403)

    # 3.8
    def test_confirmar_entrega_com_pin(self):
        pid = self.novo_pedido()
        self.pronto(pid)
        self.atribuir(pid)
        pin = Pedido.objects.get(pk=pid).codigo_pin_entrega

        self.como(self.entregador)
        errado = self.client.post(f'/api/orders/{pid}/confirmar-entrega/', {'metodo_validacao': 'pin', 'pin': '0000'}, format='json')
        self.assertEqual(errado.status_code, 400)
        self.assertEqual(Pedido.objects.get(pk=pid).status, 'pronto')

        ok = self.client.post(f'/api/orders/{pid}/confirmar-entrega/', {'metodo_validacao': 'pin', 'pin': pin}, format='json')
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(Pedido.objects.get(pk=pid).status, 'entregue')
        self.assertEqual(Lancamento.objects.count(), 0)  # receita so no pagamento

    def test_outro_entregador_nao_confirma_entrega_alheia(self):
        pid = self.novo_pedido()
        self.pronto(pid)
        self.atribuir(pid)
        pin = Pedido.objects.get(pk=pid).codigo_pin_entrega
        self.como(self.outro_entregador)
        r = self.client.post(f'/api/orders/{pid}/confirmar-entrega/', {'pin': pin}, format='json')
        self.assertIn(r.status_code, (403, 404))

    def test_nao_confirma_entrega_de_pedido_ainda_em_preparo(self):
        pid = self.novo_pedido()
        self.status(pid, 'confirmado')
        self.atribuir(pid)
        pin = Pedido.objects.get(pk=pid).codigo_pin_entrega
        self.como(self.entregador)
        r = self.client.post(f'/api/orders/{pid}/confirmar-entrega/', {'pin': pin}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_pin_nao_e_exposto_ao_entregador(self):
        """O PIN e do cliente: se o entregador o enxerga na API, a validacao perde o sentido."""
        pid = self.novo_pedido()
        self.pronto(pid)
        self.atribuir(pid)
        self.como(self.entregador)
        lista = self.client.get('/api/orders/minhas-entregas/').data['results']
        self.assertFalse(lista[0].get('codigo_pin_entrega'))
        detalhe = self.client.get(self._pedido_url(pid))
        self.assertFalse(detalhe.data.get('codigo_pin_entrega') if detalhe.status_code == 200 else None)

    def test_cliente_ve_o_pin_do_proprio_pedido(self):
        pid = self.novo_pedido()
        self.pronto(pid)
        self.atribuir(pid)
        self.como(self.cliente)
        self.assertTrue(self.client.get(self._pedido_url(pid)).data['codigo_pin_entrega'])

    # 3.9
    def test_falha_de_entrega(self):
        pid = self.novo_pedido()
        self.pronto(pid)
        self.atribuir(pid)
        self.como(self.entregador)
        self.assertEqual(self.client.post(f'/api/orders/{pid}/falha-entrega/', {}, format='json').status_code, 400)
        r = self.client.post(f'/api/orders/{pid}/falha-entrega/', {'motivo': 'Cliente ausente'}, format='json')
        self.assertEqual(r.status_code, 200)
        p = Pedido.objects.get(pk=pid)
        self.assertEqual(p.status, 'retornando_base')
        self.assertEqual(p.motivo_falha_entrega, 'Cliente ausente')
        self.assertEqual(Lancamento.objects.count(), 0)

    def test_pedido_com_falha_pode_ser_cancelado_sem_receita(self):
        pid = self.novo_pedido()
        self.pronto(pid)
        self.atribuir(pid)
        self.como(self.entregador)
        self.client.post(f'/api/orders/{pid}/falha-entrega/', {'motivo': 'x'}, format='json')
        self.assertEqual(self.status(pid, 'cancelado', cancellation_reason='Cliente ausente').status_code, 200)
        self.assertEqual(Lancamento.objects.count(), 0)

    def test_reenvio_apos_falha_com_novo_entregador(self):
        from core.models import Auditoria
        pid = self.novo_pedido()
        self.pronto(pid)
        self.atribuir(pid)
        pin = Pedido.objects.get(pk=pid).codigo_pin_entrega
        self.como(self.entregador)
        self.client.post(f'/api/orders/{pid}/falha-entrega/', {'motivo': 'Cliente ausente'}, format='json')

        # cliente nao libera o reenvio; a equipe sim
        self.assertEqual(self.status(pid, 'pronto', user=self.cliente).status_code, 403)
        self.assertEqual(self.status(pid, 'pronto').status_code, 200)
        p = Pedido.objects.get(pk=pid)
        self.assertEqual(p.status, 'pronto')
        self.assertIsNone(p.entregador)
        self.assertFalse(p.motivo_falha_entrega)
        self.assertEqual(p.codigo_pin_entrega, pin)
        self.assertTrue(Auditoria.objects.filter(acao='REENVIOU_ENTREGA', entidade_id=pid).exists())

        # sai da lista do primeiro entregador e vai para o segundo
        self.como(self.entregador)
        self.assertEqual(self.client.get('/api/orders/minhas-entregas/').data['results'], [])
        self.assertEqual(self.atribuir(pid, ent=self.outro_entregador).status_code, 200)
        self.como(self.outro_entregador)
        ok = self.client.post(f'/api/orders/{pid}/confirmar-entrega/', {'metodo_validacao': 'pin', 'pin': pin}, format='json')
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(Pedido.objects.get(pk=pid).status, 'entregue')


class CancelamentoEdicaoTests(FluxoBase):
    def setUp(self):
        super().setUp()
        self.insumo = Insumo.objects.create(nome='Massa', unidade_medida='KG', quantidade_atual='10.000', estoque_minimo='1.000')
        ReceitaItem.objects.create(produto=self.product, insumo=self.insumo, quantidade_necessaria='1.000')

    def estoque(self):
        self.insumo.refresh_from_db()
        return float(self.insumo.quantidade_atual)

    # 3.10
    def test_cancelar_confirmado_devolve_estoque(self):
        pid = self.novo_pedido(user=self.atendente, tipo='mesa', qty=2)
        self.status(pid, 'confirmado')
        self.assertEqual(self.estoque(), 8.0)
        self.assertEqual(self.status(pid, 'cancelado', cancellation_reason='teste').status_code, 200)
        self.assertEqual(self.estoque(), 10.0)
        p = Pedido.objects.get(pk=pid)
        self.assertEqual(p.cancellation_reason, 'teste')
        self.assertEqual(p.cancelled_by, self.atendente)

    def test_cancelar_apos_inicio_do_preparo_nao_devolve_estoque(self):
        pid = self.novo_pedido(user=self.atendente, tipo='mesa')
        self.status(pid, 'confirmado')
        self.status(pid, 'em_preparo')
        self.status(pid, 'cancelado')
        self.assertEqual(self.estoque(), 9.0)

    def test_cancelar_apos_preparo_devolve_estoque_se_operador_marcar(self):
        pid = self.novo_pedido(user=self.atendente, tipo='mesa', qty=2)
        self.status(pid, 'confirmado')
        self.status(pid, 'em_preparo')
        r = self.status(pid, 'cancelado', cancellation_reason='erro de digitacao', devolver_insumos=True)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.estoque(), 10.0)

    def test_cancelar_antes_do_preparo_pode_optar_por_nao_devolver(self):
        pid = self.novo_pedido(user=self.atendente, tipo='mesa')
        self.status(pid, 'confirmado')
        self.status(pid, 'cancelado', cancellation_reason='x', devolver_insumos=False)
        self.assertEqual(self.estoque(), 9.0)

    def test_cancelamento_exige_motivo(self):
        pid = self.novo_pedido(user=self.atendente, tipo='mesa')
        self.status(pid, 'confirmado')
        self.assertEqual(self.status(pid, 'cancelado').status_code, 400)

    def test_cancelamento_tira_pedido_da_fila_da_cozinha(self):
        pid = self.novo_pedido(user=self.atendente, tipo='mesa')
        self.status(pid, 'confirmado')
        self.status(pid, 'cancelado', cancellation_reason='x')
        self.assertEqual(Preparo.objects.get(pedido_id=pid).status, 'cancelado')

    def test_nao_cancela_pedido_finalizado(self):
        pid = self.novo_pedido(user=self.atendente, tipo='mesa')
        self.status(pid, 'confirmado')
        self.pagar(pid)
        self.assertEqual(self.status(pid, 'cancelado', cancellation_reason='x').status_code, 400)

    def test_cliente_nao_cancela_pedido_pela_api_de_equipe(self):
        pid = self.novo_pedido()
        self.assertEqual(self.status(pid, 'cancelado', user=self.cliente).status_code, 403)

    # 3.11
    def test_editar_itens_recalcula_total_e_usa_preco_do_catalogo(self):
        pid = self.novo_pedido(user=self.atendente, tipo='mesa', qty=1)
        self.como(self.atendente)
        r = self.client.patch(
            self._pedido_url(pid),
            {'itens': [{'produto': self.product.id, 'quantidade': 3, 'preco_unitario': '0.01'}]},
            format='json',
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['total'], '60.00')
        self.assertEqual(len(r.data['itens']), 1)

    def test_nao_edita_itens_depois_de_confirmado(self):
        pid = self.novo_pedido(user=self.atendente, tipo='mesa')
        self.status(pid, 'confirmado')
        self.como(self.atendente)
        r = self.client.patch(self._pedido_url(pid), {'itens': [{'produto': self.product.id, 'quantidade': 9}]}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_cliente_nao_edita_pedido(self):
        pid = self.novo_pedido()
        self.como(self.cliente)
        r = self.client.patch(self._pedido_url(pid), {'itens': [{'produto': self.product.id, 'quantidade': 9}]}, format='json')
        self.assertEqual(r.status_code, 403)

    # 3.12 / 3.13
    def test_cozinha_nao_entrega_delivery_e_mesa_so_gera_receita_ao_pagar(self):
        delivery = self.novo_pedido()
        self.pronto(delivery)
        self.como(self.cozinheiro)
        pr = Preparo.objects.get(pedido_id=delivery)
        self.assertEqual(self.client.post(f'/api/preparation/{pr.id}/deliver/').status_code, 400)

        mesa = self.novo_pedido(user=self.atendente, tipo='mesa')
        self.pronto(mesa)
        self.como(self.cozinheiro)
        self.assertEqual(self.client.post(f'/api/preparation/{Preparo.objects.get(pedido_id=mesa).id}/deliver/').status_code, 200)
        self.assertEqual(Lancamento.objects.count(), 0)
        self.pagar(mesa, 'dinheiro')
        l = Lancamento.objects.get()
        self.assertEqual((l.payment_method, l.responsible), ('dinheiro', self.atendente))

    def test_pagar_duas_vezes_nao_duplica_receita(self):
        pid = self.novo_pedido(user=self.atendente, tipo='mesa')
        self.status(pid, 'confirmado')
        self.assertEqual(self.pagar(pid).status_code, 200)
        self.assertEqual(self.pagar(pid).status_code, 400)
        self.assertEqual(Lancamento.objects.count(), 1)


class VisibilidadeTests(FluxoBase):
    # 3.14
    def test_cliente_so_ve_os_proprios_pedidos(self):
        meu = self.novo_pedido(user=self.cliente)
        alheio = self.novo_pedido(user=self.outro_cliente)
        self.como(self.cliente)
        ids = [p['id'] for p in self.client.get(reverse('orders:pedido_list_create')).data['results']]
        self.assertEqual(ids, [meu])
        self.assertEqual(self.client.get(self._pedido_url(alheio)).status_code, 404)

    def test_equipe_ve_todos_os_pedidos(self):
        a = self.novo_pedido(user=self.cliente)
        b = self.novo_pedido(user=self.outro_cliente)
        self.como(self.atendente)
        ids = {p['id'] for p in self.client.get(reverse('orders:pedido_list_create')).data['results']}
        self.assertTrue({a, b} <= ids)


class RegrasDaLojaTests(FluxoBase):
    def configurar(self, **valores):
        from core.models import Configuracao
        from core.services import ESTABELECIMENTO_CAMPOS
        for campo, valor in valores.items():
            Configuracao.objects.update_or_create(chave=ESTABELECIMENTO_CAMPOS[campo][0], defaults={'valor': valor})

    def test_taxa_de_entrega_entra_no_total_do_delivery(self):
        self.configurar(taxa_entrega='6.50')
        pid = self.novo_pedido(qty=2)  # 2 x 20,00
        p = Pedido.objects.get(pk=pid)
        self.assertEqual(str(p.taxa_entrega), '6.50')
        self.assertEqual(str(p.total), '46.50')
        mesa = self.novo_pedido(user=self.atendente, tipo='mesa')
        self.assertEqual(str(Pedido.objects.get(pk=mesa).total), '20.00')

    def test_loja_fechada_recusa_pedido_do_app_mas_nao_do_balcao(self):
        self.configurar(aceita_pedidos_online='false')
        self.como(self.cliente)
        payload = self._pedido_payload(self.product, 1)
        r = self.client.post(reverse('orders:pedido_list_create'), payload, format='json')
        self.assertEqual(r.status_code, 400)
        self.novo_pedido(user=self.atendente, tipo='mesa')

    def test_pedido_minimo_no_app(self):
        self.configurar(pedido_minimo='50.00')
        self.como(self.cliente)
        r = self.client.post(reverse('orders:pedido_list_create'), self._pedido_payload(self.product, 2), format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('mínimo', str(r.data))
        ok = self.client.post(reverse('orders:pedido_list_create'), self._pedido_payload(self.product, 3), format='json')
        self.assertEqual(ok.status_code, 201)
