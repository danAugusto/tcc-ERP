"""Testes da fila FIFO de preparo."""

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase

from catalog.models import Product
from orders.models import Pedido

from .models import Preparo


class PreparoBaseTestCase(APITestCase):
    def _create_user(self, username, role='cliente'):
        user = User.objects.create_user(
            username=username, password='senha-segura-123'
        )
        user.perfil.role = role
        user.perfil.save(update_fields=['role'])
        return user

    def setUp(self):
        self.cozinheiro = self._create_user('cozinheiro_teste', role='cozinheiro')
        self.atendente = self._create_user('atendente_teste', role='atendente')
        self.cliente = self._create_user('cliente_teste')
        self.product = Product.objects.create(
            name='Pastel de carne', price='10.00'
        )

    def _pedido_payload(self, quantity=1):
        return {'itens': [{'produto': self.product.id, 'quantidade': quantity}]}

    def _confirmar_pedido(self, user=None):
        user = user or self.atendente
        self.client.force_authenticate(user=user)
        created = self.client.post(
            reverse('orders:pedido_list_create'),
            self._pedido_payload(),
            format='json',
        )
        pedido = Pedido.objects.get(id=created.data['id'])
        response = self.client.patch(
            reverse('orders:pedido_detail', kwargs={'pk': pedido.id}),
            {'status': 'confirmado'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        return pedido


class PreparoQueueTests(PreparoBaseTestCase):
    def test_pedido_confirmado_entra_na_fila(self):
        pedido = self._confirmar_pedido()

        preparo = Preparo.objects.get(pedido=pedido)
        self.assertEqual(preparo.status, 'pendente')

    def test_fila_ordena_por_entrada_fifo(self):
        first = self._confirmar_pedido()
        second = self._confirmar_pedido()

        self.client.force_authenticate(user=self.cozinheiro)
        response = self.client.get(reverse('preparation:preparo_queue'))

        self.assertEqual(response.status_code, 200)
        ids = [item['pedido_id'] for item in response.data['results']]
        self.assertEqual(ids, [first.id, second.id])

    def test_fila_nao_lista_cancelados(self):
        pedido = self._confirmar_pedido()

        self.client.force_authenticate(user=self.atendente)
        self.client.patch(
            reverse('orders:pedido_detail', kwargs={'pk': pedido.id}),
            {'status': 'cancelado', 'cancellation_reason': 'Falta de insumo'},
            format='json',
        )

        self.client.force_authenticate(user=self.cozinheiro)
        response = self.client.get(reverse('preparation:preparo_queue'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['results'], [])


class PreparoOperationsTests(PreparoBaseTestCase):
    def _autenticar_cozinheiro(self):
        self.client.force_authenticate(user=self.cozinheiro)

    def test_proximo_pedido_inicia_primeiro_da_fila(self):
        first = self._confirmar_pedido()
        second = self._confirmar_pedido()

        self._autenticar_cozinheiro()
        response = self.client.post(reverse('preparation:preparo_next'))

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['pedido_id'], first.id)
        self.assertEqual(response.data['status'], 'em_preparo')
        self.assertEqual(
            Pedido.objects.get(id=first.id).status, 'em_preparo'
        )

    def test_concluir_preparo_marca_pronto(self):
        pedido = self._confirmar_pedido()

        self._autenticar_cozinheiro()
        self.client.post(reverse('preparation:preparo_next'))
        preparo = Preparo.objects.get(pedido=pedido)

        response = self.client.post(
            reverse('preparation:preparo_complete', kwargs={'pk': preparo.id})
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'pronto')
        self.assertEqual(Pedido.objects.get(id=pedido.id).status, 'pronto')
        preparo.refresh_from_db()
        self.assertIsNotNone(preparo.finished_at)

    def test_proximo_pedido_com_fila_vazia_retorna_400(self):
        self._autenticar_cozinheiro()

        response = self.client.post(reverse('preparation:preparo_next'))

        self.assertEqual(response.status_code, 400)

    def test_apenas_cozinheiro_operaciona_fila(self):
        self._confirmar_pedido()

        self.client.force_authenticate(user=self.atendente)
        response = self.client.post(reverse('preparation:preparo_next'))

        self.assertEqual(response.status_code, 403)

    def test_atendente_visualiza_fila(self):
        self._confirmar_pedido()

        self.client.force_authenticate(user=self.atendente)
        response = self.client.get(reverse('preparation:preparo_queue'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 1)