from datetime import date

from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from .models import FinanceCategory, Lancamento


class FinanceApiTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='admin_teste',
            password='senha-segura-123',
        )
        self.client.force_authenticate(user=self.user)


class CategoryApiTests(FinanceApiTestCase):
    def test_create_category(self):
        response = self.client.post(
            '/api/finance/categories/',
            {'name': 'Vendas online', 'type': 'receita', 'description': 'Vendas pela internet'},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(FinanceCategory.objects.filter(name='Vendas online').exists())

    def test_list_categories_filters_by_type(self):
        FinanceCategory.objects.create(name='Bonus', type='receita')
        FinanceCategory.objects.create(name='Impostos', type='despesa')

        response = self.client.get('/api/finance/categories/?tipo=despesa')

        self.assertEqual(response.status_code, 200)
        names = [item['name'] for item in response.data]
        self.assertIn('Impostos', names)
        self.assertNotIn('Bonus', names)
        for item in response.data:
            self.assertEqual(item['type'], 'despesa')

    def test_update_category(self):
        category = FinanceCategory.objects.create(name='Bonus', type='receita')

        response = self.client.patch(
            f'/api/finance/categories/{category.id}/',
            {'description': 'Atualizado'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        category.refresh_from_db()
        self.assertEqual(category.description, 'Atualizado')

    def test_delete_category_without_lancamentos(self):
        category = FinanceCategory.objects.create(name='Bonus', type='receita')

        response = self.client.delete(f'/api/finance/categories/{category.id}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(FinanceCategory.objects.filter(id=category.id).exists())

    def test_duplicate_category_name_rejected(self):
        FinanceCategory.objects.create(name='Bonus', type='receita')

        response = self.client.post(
            '/api/finance/categories/',
            {'name': 'Bonus', 'type': 'receita'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)

    def test_invalid_category_type_rejected(self):
        response = self.client.post(
            '/api/finance/categories/',
            {'name': 'Outros', 'type': 'invalido'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)

    def test_delete_category_in_use_rejected(self):
        category = FinanceCategory.objects.create(name='Bonus', type='receita')
        Lancamento.objects.create(
            type='receita',
            value='100.00',
            description='Venda do dia',
            date=date(2026, 8, 18),
            category=category,
            responsible=self.user,
        )

        response = self.client.delete(f'/api/finance/categories/{category.id}/')

        self.assertEqual(response.status_code, 400)
        self.assertTrue(FinanceCategory.objects.filter(id=category.id).exists())

    def test_category_endpoints_require_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get('/api/finance/categories/')

        self.assertEqual(response.status_code, 401)


class LancamentoApiTests(FinanceApiTestCase):
    def setUp(self):
        super().setUp()
        self.receita = FinanceCategory.objects.create(name='Bonus', type='receita')
        self.despesa = FinanceCategory.objects.create(name='Impostos', type='despesa')

    def test_create_lancamento(self):
        response = self.client.post(
            '/api/finance/lancamentos/',
            {
                'type': 'receita',
                'value': '150.00',
                'description': 'Venda do dia',
                'date': '2026-08-18',
                'category': self.receita.id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        lancamento = Lancamento.objects.get()
        self.assertEqual(lancamento.responsible, self.user)

    def test_lancamento_with_non_positive_value_rejected(self):
        response = self.client.post(
            '/api/finance/lancamentos/',
            {
                'type': 'receita',
                'value': '0',
                'description': 'Invalido',
                'date': '2026-08-18',
                'category': self.receita.id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)

    def test_lancamento_with_wrong_category_type_rejected(self):
        response = self.client.post(
            '/api/finance/lancamentos/',
            {
                'type': 'receita',
                'value': '50.00',
                'description': 'Categoria errada',
                'date': '2026-08-18',
                'category': self.despesa.id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)


class FinanceSummaryApiTests(FinanceApiTestCase):
    def setUp(self):
        super().setUp()
        self.receita = FinanceCategory.objects.create(name='Bonus', type='receita')
        self.despesa = FinanceCategory.objects.create(name='Impostos', type='despesa')

    def _create_lancamento(self, category, value, lancamento_date):
        return Lancamento.objects.create(
            type=category.type,
            value=value,
            description='Lancamento',
            date=lancamento_date,
            category=category,
            responsible=self.user,
        )

    def test_summary_with_receitas_and_despesas(self):
        self._create_lancamento(self.receita, '200.00', date(2026, 8, 1))
        self._create_lancamento(self.receita, '50.00', date(2026, 8, 10))
        self._create_lancamento(self.despesa, '80.00', date(2026, 8, 5))

        response = self.client.get('/api/finance/summary/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_receitas'], '250.00')
        self.assertEqual(response.data['total_despesas'], '80.00')
        self.assertEqual(response.data['saldo'], '170.00')

    def test_summary_with_only_despesas(self):
        self._create_lancamento(self.despesa, '80.00', date(2026, 8, 5))

        response = self.client.get('/api/finance/summary/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_receitas'], '0.00')
        self.assertEqual(response.data['total_despesas'], '80.00')
        self.assertEqual(response.data['saldo'], '-80.00')

    def test_summary_empty(self):
        response = self.client.get('/api/finance/summary/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_receitas'], '0.00')
        self.assertEqual(response.data['total_despesas'], '0.00')
        self.assertEqual(response.data['saldo'], '0.00')

    def test_summary_filters_by_period(self):
        self._create_lancamento(self.receita, '200.00', date(2026, 7, 1))
        self._create_lancamento(self.receita, '50.00', date(2026, 8, 1))

        response = self.client.get(
            '/api/finance/summary/?inicio=2026-08-01&fim=2026-08-31'
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_receitas'], '50.00')
        self.assertEqual(response.data['saldo'], '50.00')

    def test_summary_rejects_invalid_date(self):
        response = self.client.get('/api/finance/summary/?inicio=invalido')

        self.assertEqual(response.status_code, 400)

    def test_summary_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get('/api/finance/summary/')

        self.assertEqual(response.status_code, 401)