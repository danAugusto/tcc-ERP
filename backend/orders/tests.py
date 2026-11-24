"""Testes do modulo de pedidos e sua integracao com finance e preparo."""

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase

from catalog.models import Categoria, Produto
from finance.models import Lancamento
from preparation.models import Preparo

from .models import ItemPedido, Pedido


class PedidoBaseTestCase(APITestCase):
    def _create_user(self, username, role='cliente'):
        user = User.objects.create_user(
            username=username, password='senha-segura-123'
        )
        user.perfil.role = role
        user.perfil.save(update_fields=['role'])
        return user

    def _create_product(self, name='Pastel de carne', price='10.00', available=True):
        categoria, _ = Categoria.objects.get_or_create(nome='Salgados', defaults={'status': True})
        return Produto.objects.create(
            nome=name, preco=price, disponibilidade=available, categoria=categoria
        )

    def _pedido_payload(self, product, quantity=1):
        return {'itens': [{'produto': product.id, 'quantidade': quantity}]}

    def _pedido_url(self, pedido_id):
        return reverse('orders:pedido_detail', kwargs={'pk': pedido_id})


class PedidoCreateTests(PedidoBaseTestCase):
    def setUp(self):
        self.cliente = self._create_user('cliente_teste')
        self.product = self._create_product()
        self.client.force_authenticate(user=self.cliente)

    def test_create_pedido_with_items_computes_total(self):
        response = self.client.post(
            reverse('orders:pedido_list_create'),
            self._pedido_payload(self.product, quantity=2),
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'criado')
        self.assertEqual(response.data['total'], '20.00')
        self.assertEqual(response.data['cliente'], self.cliente.id)
        self.assertEqual(len(response.data['itens']), 1)
        self.assertEqual(response.data['itens'][0]['preco_unitario'], '10.00')
        self.assertEqual(response.data['itens'][0]['subtotal'], '20.00')

    def test_create_pedido_requires_at_least_one_item(self):
        response = self.client.post(
            reverse('orders:pedido_list_create'),
            {'itens': []},
            format='json',
        )

        self.assertEqual(response.status_code, 400)

    def test_create_pedido_rejects_zero_quantity(self):
        response = self.client.post(
            reverse('orders:pedido_list_create'),
            self._pedido_payload(self.product, quantity=0),
            format='json',
        )

        self.assertEqual(response.status_code, 400)

    def test_create_pedido_rejects_unavailable_product(self):
        unavailable = self._create_product(name='X-salada', available=False)

        response = self.client.post(
            reverse('orders:pedido_list_create'),
            self._pedido_payload(unavailable),
            format='json',
        )

        self.assertEqual(response.status_code, 400)

    def test_create_pedido_ignores_informado_status(self):
        payload = self._pedido_payload(self.product)
        payload['status'] = 'entregue'

        response = self.client.post(
            reverse('orders:pedido_list_create'),
            payload,
            format='json',
        )

        self.assertEqual(response.status_code, 400)

    def test_cliente_nao_pode_definir_outro_cliente(self):
        outro = self._create_user('outro_cliente')
        payload = self._pedido_payload(self.product)
        payload['cliente'] = outro.id

        response = self.client.post(
            reverse('orders:pedido_list_create'),
            payload,
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['cliente'], self.cliente.id)

    def test_create_pedido_registra_forma_de_pagamento(self):
        payload = self._pedido_payload(self.product)
        payload['payment_method'] = 'pix'

        response = self.client.post(
            reverse('orders:pedido_list_create'),
            payload,
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['payment_method'], 'pix')

    def test_equipe_cria_pedido_para_cliente(self):
        atendente = self._create_user('atendente_teste', role='atendente')
        self.client.force_authenticate(user=atendente)

        response = self.client.post(
            reverse('orders:pedido_list_create'),
            self._pedido_payload(self.product),
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['cliente'], atendente.id)


class PedidoVisibilityTests(PedidoBaseTestCase):
    def setUp(self):
        self.cliente_a = self._create_user('cliente_a')
        self.cliente_b = self._create_user('cliente_b')
        self.product = self._create_product()

    def _create_pedido_como(self, user, quantity=1):
        self.client.force_authenticate(user=user)
        return self.client.post(
            reverse('orders:pedido_list_create'),
            self._pedido_payload(self.product, quantity=quantity),
            format='json',
        )

    def test_cliente_ve_apenas_proprios_pedidos(self):
        self._create_pedido_como(self.cliente_a)
        self._create_pedido_como(self.cliente_b)

        self.client.force_authenticate(user=self.cliente_a)
        response = self.client.get(reverse('orders:pedido_list_create'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 1)

    def test_equipe_ve_todos_os_pedidos(self):
        self._create_pedido_como(self.cliente_a)
        self._create_pedido_como(self.cliente_b)

        atendente = self._create_user('atendente_teste', role='atendente')
        self.client.force_authenticate(user=atendente)
        response = self.client.get(reverse('orders:pedido_list_create'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 2)

    def test_cliente_nao_acessa_pedido_de_outro(self):
        created = self._create_pedido_como(self.cliente_a)

        self.client.force_authenticate(user=self.cliente_b)
        response = self.client.get(self._pedido_url(created.data['id']))

        self.assertEqual(response.status_code, 404)


class PedidoPermissionTests(PedidoBaseTestCase):
    def setUp(self):
        self.cliente = self._create_user('cliente_teste')
        self.product = self._create_product()
        self.client.force_authenticate(user=self.cliente)
        created = self.client.post(
            reverse('orders:pedido_list_create'),
            self._pedido_payload(self.product),
            format='json',
        )
        self.pedido_id = created.data['id']

    def test_cliente_nao_pode_alterar_status(self):
        response = self.client.patch(
            self._pedido_url(self.pedido_id),
            {'status': 'confirmado'},
            format='json',
        )

        self.assertEqual(response.status_code, 403)

    def test_cliente_nao_pode_excluir_pedido(self):
        response = self.client.delete(self._pedido_url(self.pedido_id))

        self.assertEqual(response.status_code, 403)


class PedidoTransitionTests(PedidoBaseTestCase):
    def setUp(self):
        self.atendente = self._create_user('atendente_teste', role='atendente')
        self.product = self._create_product()
        self.client.force_authenticate(user=self.atendente)
        created = self.client.post(
            reverse('orders:pedido_list_create'),
            self._pedido_payload(self.product),
            format='json',
        )
        self.pedido = Pedido.objects.get(id=created.data['id'])

    def _patch_status(self, status, motivo=None):
        payload = {'status': status}
        if motivo:
            payload['cancellation_reason'] = motivo
        return self.client.patch(
            self._pedido_url(self.pedido.id), payload, format='json'
        )

    def test_confirmado_registra_confirmed_at_e_entra_na_fila(self):
        response = self._patch_status('confirmado')

        self.assertEqual(response.status_code, 200)
        self.pedido.refresh_from_db()
        self.assertIsNotNone(self.pedido.confirmed_at)
        preparo = Preparo.objects.get(pedido=self.pedido)
        self.assertEqual(preparo.status, 'pendente')

    def test_transicao_invalida_rejeitada(self):
        response = self._patch_status('entregue')

        self.assertEqual(response.status_code, 400)

    def test_cancelamento_registra_motivo_e_atualiza_fila(self):
        self._patch_status('confirmado')
        response = self._patch_status('cancelado', motivo='Cliente desistiu')

        self.assertEqual(response.status_code, 200)
        self.pedido.refresh_from_db()
        self.assertIsNotNone(self.pedido.cancelled_at)
        self.assertEqual(self.pedido.cancelled_by, self.atendente)
        self.assertEqual(self.pedido.cancellation_reason, 'Cliente desistiu')
        preparo = Preparo.objects.get(pedido=self.pedido)
        self.assertEqual(preparo.status, 'cancelado')
        self.assertFalse(Lancamento.objects.exists())

    def test_excluir_pedido_criado(self):
        response = self.client.delete(self._pedido_url(self.pedido.id))

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Pedido.objects.exists())

    def test_excluir_pedido_entregue_rejeitado(self):
        self.pedido.status = 'entregue'
        self.pedido.save(update_fields=['status'])

        response = self.client.delete(self._pedido_url(self.pedido.id))

        self.assertEqual(response.status_code, 400)

    def test_itens_nao_mudam_apos_confirmacao(self):
        self._patch_status('confirmado')
        outro = self._create_product(name='Pastel de queijo')

        response = self.client.patch(
            self._pedido_url(self.pedido.id),
            self._pedido_payload(outro),
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.pedido.itens.count(), 1)


class PedidoFinanceIntegrationTests(PedidoBaseTestCase):
    def setUp(self):
        self.atendente = self._create_user('atendente_teste', role='atendente')
        self.product = self._create_product(price='15.00')
        self.client.force_authenticate(user=self.atendente)

    def _entregar_pedido(self, quantity=1, payload_extra=None):
        payload = self._pedido_payload(self.product, quantity=quantity)
        payload.update(payload_extra or {})
        created = self.client.post(reverse('orders:pedido_list_create'), payload, format='json')
        pedido = Pedido.objects.get(id=created.data['id'])
        for status in ('confirmado', 'em_preparo', 'pronto', 'entregue'):
            response = self.client.patch(
                self._pedido_url(pedido.id), {'status': status}, format='json'
            )
            self.assertEqual(response.status_code, 200)
        return created, response

    def _pagar(self, pedido_id, metodo='dinheiro', valor=None, user=None):
        if user:
            self.client.force_authenticate(user=user)
        body = {'payment_method': metodo}
        if valor is not None:
            body['valor_recebido'] = valor
        return self.client.post(f'/api/orders/{pedido_id}/pay/', body, format='json')

    def test_pedido_entregue_ainda_nao_gera_receita(self):
        self._entregar_pedido()

        self.assertEqual(Lancamento.objects.count(), 0)

    def test_pagamento_cria_receita_com_forma_e_responsavel_do_caixa(self):
        created, _ = self._entregar_pedido(quantity=2)
        caixa = self._create_user('caixa_teste', role='atendente')

        response = self._pagar(created.data['id'], metodo='cartao_credito', user=caixa)

        self.assertEqual(response.status_code, 200)
        lancamento = Lancamento.objects.get()
        self.assertEqual(lancamento.type, 'receita')
        self.assertEqual(lancamento.value, 30.00)
        self.assertEqual(lancamento.pedido_id, created.data['id'])
        self.assertEqual(lancamento.payment_method, 'cartao_credito')
        self.assertEqual(lancamento.responsible, caixa)

    def test_cancelar_pedido_entregue_nao_paga_nao_deixa_receita(self):
        created, _ = self._entregar_pedido()
        response = self.client.patch(
            self._pedido_url(created.data['id']),
            {'status': 'cancelado', 'cancellation_reason': 'teste'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Lancamento.objects.count(), 0)

    def test_receita_nao_duplica(self):
        created, _ = self._entregar_pedido()
        self._pagar(created.data['id'])

        from finance.services import criar_receita_para_pedido

        pedido = Pedido.objects.get()
        criar_receita_para_pedido(pedido, responsavel=self.atendente)
        criar_receita_para_pedido(pedido, responsavel=self.atendente)

        self.assertEqual(Lancamento.objects.count(), 1)

    def test_receita_aparece_no_resumo_financeiro(self):
        admin = self._create_user('admin_resumo', role='administrador')

        created, _ = self._entregar_pedido()
        self._pagar(created.data['id'])

        self.client.force_authenticate(user=admin)
        response = self.client.get(reverse('finance_summary'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_receitas'], '15.00')
        self.assertEqual(response.data['saldo'], '15.00')


class PedidoEstoqueIntegrationTests(PedidoBaseTestCase):
    def setUp(self):
        from inventory.models import Insumo, ReceitaItem
        
        self.atendente = self._create_user('atendente_teste', role='atendente')
        self.product = self._create_product(price='15.00')
        self.client.force_authenticate(user=self.atendente)
        
        # Setup Insumo and Receita
        self.insumo = Insumo.objects.create(
            nome='Queijo',
            unidade_medida='KG',
            quantidade_atual='2.000',
            estoque_minimo='1.000',
        )
        self.receita_item = ReceitaItem.objects.create(
            produto=self.product,
            insumo=self.insumo,
            quantidade_necessaria='0.500',
        )
        
        created = self.client.post(
            reverse('orders:pedido_list_create'),
            self._pedido_payload(self.product, quantity=2),
            format='json',
        )
        self.pedido_id = created.data['id']

    def test_confirmar_pedido_debita_estoque(self):
        response = self.client.patch(
            self._pedido_url(self.pedido_id),
            {'status': 'confirmado'},
            format='json',
        )
        
        self.assertEqual(response.status_code, 200)
        self.insumo.refresh_from_db()
        # 2 quantities * 0.500 = 1.000 used. Started with 2.000. Left: 1.000
        self.assertEqual(self.insumo.quantidade_atual, 1.000)

    def test_confirmar_pedido_sem_estoque_falha(self):
        # We try to order 5 units (5 * 0.500 = 2.500 required, but we only have 2.000)
        created = self.client.post(
            reverse('orders:pedido_list_create'),
            self._pedido_payload(self.product, quantity=5),
            format='json',
        )
        pedido_id_2 = created.data['id']
        
        response = self.client.patch(
            self._pedido_url(pedido_id_2),
            {'status': 'confirmado'},
            format='json',
        )
        
        self.assertEqual(response.status_code, 400)
        self.assertIn('Estoque insuficiente', str(response.data))
        
        self.insumo.refresh_from_db()
        # Ensure stock wasn't partially debited
        self.assertEqual(self.insumo.quantidade_atual, 2.000)


class PedidoNovasFeaturesTests(PedidoBaseTestCase):
    def setUp(self):
        self.atendente = self._create_user('atendente_novas_features', role='atendente')
        self.product1 = self._create_product(name='X-Salada', price='20.00')
        self.product2 = self._create_product(name='Refrigerante', price='7.00')
        self.client.force_authenticate(user=self.atendente)

    def test_criar_pedido_delivery_com_endereco(self):
        payload = {
            'tipo_atendimento': 'delivery',
            'payment_method': 'dinheiro',
            'itens': [{'produto': self.product1.id, 'quantidade': 1}],
            'endereco': {
                'cep': '13083-852',
                'logradouro': 'Avenida Albert Einstein',
                'numero': '400',
                'complemento': 'Bloco B',
                'bairro': 'Barão Geraldo',
                'cidade': 'Campinas',
                'uf': 'SP',
            }
        }
        response = self.client.post(reverse('orders:pedido_list_create'), payload, format='json')
        self.assertEqual(response.status_code, 201)
        data = response.data
        self.assertEqual(data['tipo_atendimento'], 'delivery')
        self.assertEqual(data['numero_mesa'], 'Delivery')
        self.assertIsNotNone(data['endereco'])
        self.assertEqual(data['endereco']['cep'], '13083-852')
        self.assertEqual(data['endereco']['numero'], '400')

    def test_simulacao_pagamento_dinheiro_com_troco(self):
        # Cria pedido de R$ 20.00
        created = self.client.post(
            reverse('orders:pedido_list_create'),
            {'payment_method': 'dinheiro', 'itens': [{'produto': self.product1.id, 'quantidade': 1}]},
            format='json',
        )
        pedido_id = created.data['id']

        # Simula pagamento com R$ 50.00 (troco R$ 30.00)
        pay_url = reverse('orders:pedido_pay', kwargs={'pk': pedido_id})
        pay_res = self.client.post(pay_url, {
            'payment_method': 'dinheiro',
            'valor_recebido': '50.00',
            'troco': '30.00',
        }, format='json')

        self.assertEqual(pay_res.status_code, 200)
        self.assertEqual(pay_res.data['status'], 'finalizado')
        self.assertEqual(float(pay_res.data['valor_recebido']), 50.00)
        self.assertEqual(float(pay_res.data['troco']), 30.00)

        # Verifica criacao automatica de receita financeira
        from finance.models import Lancamento
        lancamento = Lancamento.objects.filter(pedido_id=pedido_id).first()
        self.assertIsNotNone(lancamento)
        self.assertEqual(lancamento.type, 'receita')
        self.assertEqual(lancamento.value, 20.00)
        self.assertEqual(lancamento.payment_method, 'dinheiro')

    def test_adicionar_e_remover_itens_pedido(self):
        created = self.client.post(
            reverse('orders:pedido_list_create'),
            {'itens': [{'produto': self.product1.id, 'quantidade': 1}]},
            format='json',
        )
        pedido_id = created.data['id']
        self.assertEqual(float(created.data['total']), 20.00)

        # Adiciona refrigerante (+ R$ 7.00)
        add_url = reverse('orders:pedido_add_item', kwargs={'pk': pedido_id})
        res_add = self.client.post(add_url, {'produto': self.product2.id, 'quantidade': 1}, format='json')
        self.assertEqual(res_add.status_code, 200)
        self.assertEqual(float(res_add.data['total']), 27.00)
        self.assertEqual(len(res_add.data['itens']), 2)

        # Remove o refrigerante
        item_refri = [i for i in res_add.data['itens'] if i['produto'] == self.product2.id][0]
        rem_url = reverse('orders:pedido_remove_item', kwargs={'pk': pedido_id})
        res_rem = self.client.post(rem_url, {'item_id': item_refri['id']}, format='json')
        self.assertEqual(res_rem.status_code, 200)
        self.assertEqual(float(res_rem.data['total']), 20.00)

    def test_encerrar_expediente(self):
        # Cria pedido e finaliza
        created = self.client.post(
            reverse('orders:pedido_list_create'),
            {'itens': [{'produto': self.product1.id, 'quantidade': 1}]},
            format='json',
        )
        pedido_id = created.data['id']
        self.client.post(reverse('orders:pedido_pay', kwargs={'pk': pedido_id}), {'payment_method': 'pix'})

        # Encerra expediente
        close_res = self.client.post(reverse('orders:orders_close_shift'), format='json')
        self.assertEqual(close_res.status_code, 200)
        self.assertGreaterEqual(close_res.data['arquivados'], 1)

        # Pedido deve estar com status 'arquivado'
        detail_res = self.client.get(reverse('orders:pedido_detail', kwargs={'pk': pedido_id}))
        self.assertEqual(detail_res.data['status'], 'arquivado')

    def test_cancelar_pedido_confirmado_estorna_estoque(self):
        from decimal import Decimal
        from inventory.models import Insumo, ReceitaItem, Movimentacao

        insumo = Insumo.objects.create(
            nome='Carne de Pastel Teste',
            unidade_medida='KG',
            quantidade_atual=Decimal('10.000'),
            estoque_minimo=Decimal('1.000'),
        )
        ReceitaItem.objects.create(
            produto=self.product1,
            insumo=insumo,
            quantidade_necessaria=Decimal('0.100'),
        )

        # Cria e confirma pedido com 2 pastéis (deve baixar 0.200 do estoque)
        created = self.client.post(
            reverse('orders:pedido_list_create'),
            {'itens': [{'produto': self.product1.id, 'quantidade': 2}]},
            format='json',
        )
        pedido_id = created.data['id']
        self.client.patch(
            reverse('orders:pedido_detail', kwargs={'pk': pedido_id}),
            {'status': 'confirmado'},
            format='json',
        )

        insumo.refresh_from_db()
        self.assertEqual(insumo.quantidade_atual, Decimal('9.800'))

        # Cancela o pedido (deve estornar/devolver 0.200 automaticamente ao estoque)
        self.client.patch(
            reverse('orders:pedido_detail', kwargs={'pk': pedido_id}),
            {'status': 'cancelado', 'cancellation_reason': 'Desistência do cliente'},
            format='json',
        )

        insumo.refresh_from_db()
        self.assertEqual(insumo.quantidade_atual, Decimal('10.000'))
        self.assertTrue(
            Movimentacao.objects.filter(
                insumo=insumo,
                tipo=Movimentacao.Tipo.ENTRADA,
                motivo=Movimentacao.Motivo.DEVOLUCAO,
            ).exists()
        )

    def test_cancelar_pedido_apos_inicio_preparo_nao_devolve_estoque(self):
        from decimal import Decimal
        from inventory.models import Insumo, ReceitaItem, Movimentacao

        insumo = Insumo.objects.create(
            nome='Frango Teste Perda',
            unidade_medida='KG',
            quantidade_atual=Decimal('10.000'),
            estoque_minimo=Decimal('1.000'),
        )
        ReceitaItem.objects.create(
            produto=self.product1,
            insumo=insumo,
            quantidade_necessaria=Decimal('0.100'),
        )

        # 1. Cria e confirma pedido (baixa de 0.200 do estoque -> 9.800)
        created = self.client.post(
            reverse('orders:pedido_list_create'),
            {'itens': [{'produto': self.product1.id, 'quantidade': 2}]},
            format='json',
        )
        pedido_id = created.data['id']
        self.client.patch(
            reverse('orders:pedido_detail', kwargs={'pk': pedido_id}),
            {'status': 'confirmado'},
            format='json',
        )
        insumo.refresh_from_db()
        self.assertEqual(insumo.quantidade_atual, Decimal('9.800'))

        # 2. Inicia o preparo (status 'em_preparo')
        self.client.patch(
            reverse('orders:pedido_detail', kwargs={'pk': pedido_id}),
            {'status': 'em_preparo'},
            format='json',
        )

        # 3. Cancela o pedido após início do preparo
        self.client.patch(
            reverse('orders:pedido_detail', kwargs={'pk': pedido_id}),
            {'status': 'cancelado', 'cancellation_reason': 'Cliente desistiu após início da fritura'},
            format='json',
        )

        # Como já havia iniciado o preparo, os insumos NÃO devem ser devolvidos (perda/consumidos)
        insumo.refresh_from_db()
        self.assertEqual(insumo.quantidade_atual, Decimal('9.800'))
        self.assertFalse(
            Movimentacao.objects.filter(
                insumo=insumo,
                tipo=Movimentacao.Tipo.ENTRADA,
                motivo=Movimentacao.Motivo.DEVOLUCAO,
            ).exists()
        )

    def test_editar_itens_pos_confirmacao_e_bloqueio_no_preparo(self):
        from decimal import Decimal
        from inventory.models import Insumo, ReceitaItem

        insumo = Insumo.objects.create(
            nome='Queijo Teste Edicao',
            unidade_medida='KG',
            quantidade_atual=Decimal('5.000'),
            estoque_minimo=Decimal('0.500'),
        )
        ReceitaItem.objects.create(
            produto=self.product1,
            insumo=insumo,
            quantidade_necessaria=Decimal('0.100'),
        )

        # 1. Cria e confirma pedido com 1 pastel (baixa 0.100 -> saldo 4.900)
        created = self.client.post(
            reverse('orders:pedido_list_create'),
            {'itens': [{'produto': self.product1.id, 'quantidade': 1}]},
            format='json',
        )
        pedido_id = created.data['id']
        self.client.patch(
            reverse('orders:pedido_detail', kwargs={'pk': pedido_id}),
            {'status': 'confirmado'},
            format='json',
        )
        insumo.refresh_from_db()
        self.assertEqual(insumo.quantidade_atual, Decimal('4.900'))

        # 2. Ainda em 'confirmado' (antes do preparo): pode adicionar item e debita estoque
        add_url = reverse('orders:pedido_add_item', kwargs={'pk': pedido_id})
        res_add = self.client.post(add_url, {'produto': self.product1.id, 'quantidade': 1}, format='json')
        self.assertEqual(res_add.status_code, 200)
        insumo.refresh_from_db()
        self.assertEqual(insumo.quantidade_atual, Decimal('4.800'))

        # 3. Avança para 'em_preparo': agora deve ser bloqueado adicionar ou remover itens
        self.client.patch(
            reverse('orders:pedido_detail', kwargs={'pk': pedido_id}),
            {'status': 'em_preparo'},
            format='json',
        )

        res_block_add = self.client.post(add_url, {'produto': self.product1.id, 'quantidade': 1}, format='json')
        self.assertEqual(res_block_add.status_code, 400)
        self.assertIn('preparo', str(res_block_add.data).lower())

        rem_url = reverse('orders:pedido_remove_item', kwargs={'pk': pedido_id})
        item_id = res_add.data['itens'][0]['id']
        res_block_rem = self.client.post(rem_url, {'item_id': item_id}, format='json')
        self.assertEqual(res_block_rem.status_code, 400)
