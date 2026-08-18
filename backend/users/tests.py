from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from .models import Perfil


class AuthenticationApiTests(APITestCase):
    def test_register_creates_user_without_returning_password(self):
        response = self.client.post(
            '/api/users/register/',
            {
                'username': 'cliente_teste',
                'email': 'cliente@example.com',
                'password': 'senha-segura-123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(username='cliente_teste').exists())
        self.assertNotIn('password', response.data)

    def test_register_creates_default_cliente_profile(self):
        response = self.client.post(
            '/api/users/register/',
            {
                'username': 'novo_cliente',
                'email': 'novo@example.com',
                'password': 'senha-segura-123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username='novo_cliente')
        self.assertTrue(Perfil.objects.filter(user=user, role='cliente').exists())

    def test_login_returns_access_and_refresh_tokens(self):
        User.objects.create_user(
            username='usuario_teste',
            email='usuario@example.com',
            password='senha-segura-123',
        )

        response = self.client.post(
            '/api/users/login/',
            {'username': 'usuario_teste', 'password': 'senha-segura-123'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_login_rejects_invalid_password(self):
        User.objects.create_user(
            username='usuario_teste',
            password='senha-segura-123',
        )

        response = self.client.post(
            '/api/users/login/',
            {'username': 'usuario_teste', 'password': 'senha-incorreta'},
            format='json',
        )

        self.assertEqual(response.status_code, 401)
