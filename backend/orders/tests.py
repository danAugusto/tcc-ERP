from datetime import date

from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from finance.models import Lancamento
from .models import Pedido


class PedidoApiTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='atendente_teste',
            password='senha-segura-123',
        )
        self.client.force_authenticate(user=self.user)

    def _create_pedido(self, total='100.00'):
        return self.client.post(
            '/api/orders/',
            {'total': total},
            format='json',
        )


class PedidoApiTests(PedidoApiTestCase):
    def test_create_pedido(self):
        response = self._create_pedido()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'criado')

    def test_create_pedido_with_non_positive_total_rejected(self):
        response = self._create_pedido(total='0')

        self.assertEqual(response.status_code, 400)

    def test_list_pedidos(self):
        self._create_pedido()
        self._create_pedido(total='50.00')

        response = self.client.get('/api/orders/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_retrieve_pedido(self):
        created = self._create_pedido()

        response = self.client.get(f"/api/orders/{created.data['id']}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total'], '100.00')

    def test_update_status_valid_transition(self):
        created = self._create_pedido()

        response = self.client.patch(
            f"/api/orders/{created.data['id']}/",
            {'status': 'confirmado'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'confirmado')

    def test_update_status_invalid_transition_rejected(self):
        created = self._create_pedido()

        response = self.client.patch(
            f"/api/orders/{created.data['id']}/",
            {'status': 'entregue'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)

    def test_cancel_pedido_before_entregue(self):
        created = self._create_pedido()

        response = self.client.patch(
            f"/api/orders/{created.data['id']}/",
            {'status': 'cancelado'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'cancelado')
        self.assertFalse(Lancamento.objects.exists())

    def test_delete_pedido_criado(self):
        created = self._create_pedido()

        response = self.client.delete(f"/api/orders/{created.data['id']}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Pedido.objects.exists())

    def test_delete_pedido_entregue_rejected(self):
        created = self._create_pedido()
        pedido = Pedido.objects.get(id=created.data['id'])
        pedido.status = 'entregue'
        pedido.save(update_fields=['status'])

        response = self.client.delete(f"/api/orders/{created.data['id']}/")

        self.assertEqual(response.status_code, 400)


class PedidoFinanceIntegrationTests(PedidoApiTestCase):
    def _deliver_pedido(self, total='100.00'):
        created = self._create_pedido(total=total)
        pedido = Pedido.objects.get(id=created.data['id'])
        pedido.status = 'pronto'
        pedido.save(update_fields=['status'])
        response = self.client.patch(
            f"/api/orders/{created.data['id']}/",
            {'status': 'entregue'},
            format='json',
        )
        return created, response

    def test_delivered_pedido_creates_receita(self):
        created, response = self._deliver_pedido()

        self.assertEqual(response.status_code, 200)
        lancamento = Lancamento.objects.get()
        self.assertEqual(lancamento.type, 'receita')
        self.assertEqual(lancamento.value, 100.00)
        self.assertEqual(lancamento.pedido_id, created.data['id'])

    def test_receita_not_duplicated_on_repeated_transition(self):
        _, _ = self._deliver_pedido()
        pedido = Pedido.objects.get()

        from finance.services import criar_receita_para_pedido

        criar_receita_para_pedido(pedido, responsavel=self.user)
        criar_receita_para_pedido(pedido, responsavel=self.user)

        self.assertEqual(Lancamento.objects.count(), 1)

    def test_receita_reflects_on_finance_summary(self):
        admin = User.objects.create_user(
            username='admin_resumo',
            password='senha-segura-123',
        )
        admin.perfil.role = 'administrador'
        admin.perfil.save(update_fields=['role'])

        self._deliver_pedido(total='150.00')

        self.client.force_authenticate(user=admin)
        response = self.client.get('/api/finance/summary/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_receitas'], '150.00')
        self.assertEqual(response.data['saldo'], '150.00')