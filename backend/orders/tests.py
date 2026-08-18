"""Testes do modulo de pedidos e sua integracao com finance e preparo."""

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase

from catalog.models import Product
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
        return Product.objects.create(
            name=name, price=price, is_available=available
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
        self.assertEqual(len(response.data), 1)

    def test_equipe_ve_todos_os_pedidos(self):
        self._create_pedido_como(self.cliente_a)
        self._create_pedido_como(self.cliente_b)

        atendente = self._create_user('atendente_teste', role='atendente')
        self.client.force_authenticate(user=atendente)
        response = self.client.get(reverse('orders:pedido_list_create'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

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

    def _entregar_pedido(self, quantity=1):
        created = self.client.post(
            reverse('orders:pedido_list_create'),
            self._pedido_payload(self.product, quantity=quantity),
            format='json',
        )
        pedido = Pedido.objects.get(id=created.data['id'])
        for status in ('confirmado', 'em_preparo', 'pronto', 'entregue'):
            response = self.client.patch(
                self._pedido_url(pedido.id),
                {'status': status},
                format='json',
            )
            if status != 'entregue':
                self.assertEqual(response.status_code, 200)
        return created, response

    def test_pedido_entregue_cria_receita(self):
        created, response = self._entregar_pedido(quantity=2)

        self.assertEqual(response.status_code, 200)
        lancamento = Lancamento.objects.get()
        self.assertEqual(lancamento.type, 'receita')
        self.assertEqual(lancamento.value, 30.00)
        self.assertEqual(lancamento.pedido_id, created.data['id'])

    def test_receita_nao_duplica(self):
        self._entregar_pedido()

        from finance.services import criar_receita_para_pedido

        pedido = Pedido.objects.get()
        criar_receita_para_pedido(pedido, responsavel=self.atendente)
        criar_receita_para_pedido(pedido, responsavel=self.atendente)

        self.assertEqual(Lancamento.objects.count(), 1)

    def test_receita_aparece_no_resumo_financeiro(self):
        admin = self._create_user('admin_resumo', role='administrador')

        self._entregar_pedido()

        self.client.force_authenticate(user=admin)
        response = self.client.get(reverse('finance_summary'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_receitas'], '15.00')
        self.assertEqual(response.data['saldo'], '15.00')