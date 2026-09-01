from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Categoria, Produto


class CategoriaApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='administrador', password='senha-segura-123'
        )
        self.client.force_authenticate(self.user)

    def test_authenticated_user_can_create_category(self):
        response = self.client.post(
            '/api/catalog/categorias/',
            {'nome': 'Pastéis', 'descricao': 'Pastéis salgados e doces', 'status': True},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['nome'], 'Pastéis')
        self.assertTrue(Categoria.objects.filter(nome='Pastéis').exists())

    def test_authenticated_user_can_list_categories_in_name_order(self):
        Categoria.objects.create(nome='Salgados')
        Categoria.objects.create(nome='Bebidas')

        response = self.client.get('/api/catalog/categorias/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['nome'] for item in response.data], ['Bebidas', 'Salgados'])

    def test_authenticated_user_can_retrieve_and_update_category(self):
        categoria = Categoria.objects.create(nome='Lanches', status=True)

        retrieve_response = self.client.get(f'/api/catalog/categorias/{categoria.id}/')
        update_response = self.client.put(
            f'/api/catalog/categorias/{categoria.id}/',
            {'nome': 'Lanches especiais', 'descricao': '', 'status': False},
            format='json',
        )

        categoria.refresh_from_db()
        self.assertEqual(retrieve_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(categoria.nome, 'Lanches especiais')
        self.assertFalse(categoria.status)

    def test_authenticated_user_can_delete_category(self):
        categoria = Categoria.objects.create(nome='Sobremesas')

        response = self.client.delete(f'/api/catalog/categorias/{categoria.id}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Categoria.objects.filter(id=categoria.id).exists())

    def test_unauthenticated_user_cannot_access_categories(self):
        self.client.force_authenticate(user=None)

        response = self.client.get('/api/catalog/categorias/')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_category_name_must_be_unique(self):
        Categoria.objects.create(nome='Bebidas')

        response = self.client.post(
            '/api/catalog/categorias/', {'nome': 'Bebidas'}, format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('nome', response.data)


class ProdutoApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='administrador_produtos', password='senha-segura-123'
        )
        self.client.force_authenticate(self.user)
        self.categoria = Categoria.objects.create(nome='Lanches', status=True)

    def product_payload(self, **overrides):
        payload = {
            'nome': 'X-Salada',
            'descricao': 'Hambúrguer, salada e queijo',
            'preco': '18.50',
            'categoria': self.categoria.id,
            'disponibilidade': True,
        }
        payload.update(overrides)
        return payload

    def test_authenticated_user_can_create_product(self):
        response = self.client.post(
            '/api/catalog/produtos/', self.product_payload(), format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['preco'], '18.50')
        self.assertEqual(response.data['categoria'], self.categoria.id)
        self.assertTrue(Produto.objects.filter(nome='X-Salada').exists())

    def test_authenticated_user_can_list_retrieve_update_and_delete_product(self):
        produto = Produto.objects.create(
            nome='Coxinha', preco='8.00', categoria=self.categoria
        )

        list_response = self.client.get('/api/catalog/produtos/')
        retrieve_response = self.client.get(f'/api/catalog/produtos/{produto.id}/')
        update_response = self.client.put(
            f'/api/catalog/produtos/{produto.id}/',
            self.product_payload(nome='Coxinha especial', preco='10.00'),
            format='json',
        )
        delete_response = self.client.delete(f'/api/catalog/produtos/{produto.id}/')

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(retrieve_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Produto.objects.filter(id=produto.id).exists())

    def test_product_price_must_be_greater_than_zero(self):
        for invalid_price in ('0.00', '-1.00'):
            with self.subTest(preco=invalid_price):
                response = self.client.post(
                    '/api/catalog/produtos/',
                    self.product_payload(nome=f'Produto {invalid_price}', preco=invalid_price),
                    format='json',
                )

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn('preco', response.data)

    def test_product_name_must_be_unique(self):
        Produto.objects.create(nome='X-Bacon', preco='20.00', categoria=self.categoria)

        response = self.client.post(
            '/api/catalog/produtos/',
            self.product_payload(nome='X-Bacon'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('nome', response.data)

    def test_product_requires_an_existing_active_category(self):
        inactive_category = Categoria.objects.create(nome='Descontinuados', status=False)

        inactive_response = self.client.post(
            '/api/catalog/produtos/',
            self.product_payload(categoria=inactive_category.id),
            format='json',
        )
        missing_response = self.client.post(
            '/api/catalog/produtos/',
            self.product_payload(nome='Produto inexistente', categoria=99999),
            format='json',
        )

        self.assertEqual(inactive_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('categoria', inactive_response.data)
        self.assertEqual(missing_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('categoria', missing_response.data)

    def test_unauthenticated_user_cannot_access_products(self):
        self.client.force_authenticate(user=None)

        response = self.client.get('/api/catalog/produtos/')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
