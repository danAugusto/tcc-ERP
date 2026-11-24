from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Categoria, Produto


class CategoriaApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='administrador', password='senha-segura-123'
        )
        self.user.perfil.role = 'administrador'
        self.user.perfil.save()
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
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        self.assertEqual([item['nome'] for item in results], ['Bebidas', 'Salgados'])

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

    def test_unauthenticated_user_can_view_public_catalog_but_cannot_create(self):
        self.client.force_authenticate(user=None)

        # Rota publica para consulta
        get_response = self.client.get('/api/catalog/categorias/')
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)

        # Criacao exige autenticacao
        post_response = self.client.post(
            '/api/catalog/categorias/', {'nome': 'Tentativa Invalida'}, format='json'
        )
        self.assertEqual(post_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cliente_cannot_create_category(self):
        cliente_user = User.objects.create_user(
            username='cliente_comum', password='senha-segura-123'
        )
        # Por padrao perfil.role = 'cliente'
        self.client.force_authenticate(user=cliente_user)

        response = self.client.post(
            '/api/catalog/categorias/', {'nome': 'Hacker Cat'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

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
        self.user.perfil.role = 'administrador'
        self.user.perfil.save()
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

    def test_unauthenticated_user_can_view_public_products_but_cannot_create(self):
        self.client.force_authenticate(user=None)

        # Consulta de catalogo e publica
        get_response = self.client.get('/api/catalog/produtos/')
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)

        # Criacao exige login de equipe
        post_response = self.client.post(
            '/api/catalog/produtos/', self.product_payload(), format='json'
        )
        self.assertEqual(post_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cliente_cannot_create_product(self):
        cliente = User.objects.create_user(username='cliente_prod', password='123')
        self.client.force_authenticate(user=cliente)

        response = self.client.post(
            '/api/catalog/produtos/', self.product_payload(), format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ProdutoImagemTests(APITestCase):
    def setUp(self):
        import tempfile
        from django.test import override_settings
        self._media = tempfile.TemporaryDirectory()
        self._override = override_settings(MEDIA_ROOT=self._media.name)
        self._override.enable()
        self.addCleanup(self._override.disable)
        self.addCleanup(self._media.cleanup)

        self.user = User.objects.create_user(username='adm_img', password='senha-segura-123')
        self.user.perfil.role = 'administrador'
        self.user.perfil.save()
        self.client.force_authenticate(self.user)
        self.categoria = Categoria.objects.create(nome='Pasteis', status=True)

    def make_image(self, name='foto.png', fmt='PNG'):
        import io
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile
        buf = io.BytesIO()
        Image.new('RGB', (20, 20), 'red').save(buf, fmt)
        return SimpleUploadedFile(name, buf.getvalue(), content_type='image/png')

    def payload(self, **extra):
        data = {'nome': 'Pastel', 'preco': '8.00', 'categoria': self.categoria.id, 'disponibilidade': 'true'}
        data.update(extra)
        return data

    def test_upload_na_criacao_retorna_url(self):
        res = self.client.post('/api/catalog/produtos/', self.payload(imagem=self.make_image()), format='multipart')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data['imagem_url'].startswith('/media/produtos/'))
        self.assertNotIn('imagem', res.data)

    def test_produto_sem_imagem_tem_url_nula(self):
        res = self.client.post('/api/catalog/produtos/', self.payload(), format='multipart')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(res.data['imagem_url'])

    def test_arquivo_que_nao_e_imagem_e_rejeitado(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        fake = SimpleUploadedFile('x.png', b'nao sou imagem', content_type='image/png')
        res = self.client.post('/api/catalog/produtos/', self.payload(imagem=fake), format='multipart')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_formato_nao_permitido_e_rejeitado(self):
        res = self.client.post(
            '/api/catalog/produtos/', self.payload(imagem=self.make_image('a.gif', 'GIF')), format='multipart'
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_substituir_e_remover_imagem(self):
        res = self.client.post('/api/catalog/produtos/', self.payload(imagem=self.make_image()), format='multipart')
        pid = res.data['id']
        primeira = Produto.objects.get(pk=pid).imagem.path
        res = self.client.put(
            f'/api/catalog/produtos/{pid}/', self.payload(imagem=self.make_image('b.png')), format='multipart'
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        import os
        self.assertFalse(os.path.exists(primeira))
        res = self.client.put(
            f'/api/catalog/produtos/{pid}/', self.payload(remover_imagem='true'), format='multipart'
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsNone(res.data['imagem_url'])

    def test_put_sem_imagem_preserva_a_existente(self):
        res = self.client.post('/api/catalog/produtos/', self.payload(imagem=self.make_image()), format='multipart')
        pid = res.data['id']
        res = self.client.put(f'/api/catalog/produtos/{pid}/', self.payload(nome='Pastel 2'), format='multipart')
        self.assertTrue(res.data['imagem_url'])
