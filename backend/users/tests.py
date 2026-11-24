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

    def test_me_returns_authenticated_user_role(self):
        user = User.objects.create_user(
            username='atendente_teste', password='senha-segura-123'
        )
        user.perfil.role = 'atendente'
        user.perfil.save(update_fields=['role'])
        self.client.force_authenticate(user=user)

        response = self.client.get('/api/users/me/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['username'], 'atendente_teste')
        self.assertEqual(response.data['role'], 'atendente')

    def test_me_requires_authentication(self):
        response = self.client.get('/api/users/me/')

        self.assertEqual(response.status_code, 401)


class RBACMatrixApiTests(APITestCase):
    def setUp(self):
        from .models import Permissao, RolePermissao
        self.admin = User.objects.create_user(username='admin_boss', password='senha-segura-123')
        self.admin.perfil.role = 'administrador'
        self.admin.perfil.save(update_fields=['role'])

        self.atendente = User.objects.create_user(username='atendente_balcao', password='senha-segura-123')
        self.atendente.perfil.role = 'atendente'
        self.atendente.perfil.save(update_fields=['role'])

        self.perm_cancelar = Permissao.objects.create(
            codigo='CANCELAR_PEDIDO', descricao='Cancelar pedido já confirmado', modulo='PEDIDOS'
        )
        self.perm_usuarios = Permissao.objects.create(
            codigo='GERENCIAR_USUARIOS', descricao='Criar, editar usuários', modulo='ADMINISTRACAO'
        )

        RolePermissao.objects.create(role_nome='administrador', permissao=self.perm_cancelar)
        RolePermissao.objects.create(role_nome='administrador', permissao=self.perm_usuarios)

    def test_rbac_matrix_forbidden_for_non_admin(self):
        self.client.force_authenticate(user=self.atendente)
        response = self.client.get('/api/users/rbac/matrix/')
        self.assertEqual(response.status_code, 403)

    def test_rbac_matrix_allowed_for_admin(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/users/rbac/matrix/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('roles', response.data)
        self.assertIn('modulos', response.data)

    def test_rbac_toggle_concede_e_revoga_permissao(self):
        from .models import RolePermissao
        self.client.force_authenticate(user=self.admin)

        # 1. Conceder CANCELAR_PEDIDO para atendente
        res_add = self.client.post('/api/users/rbac/toggle/', {
            'role': 'atendente',
            'permissao_codigo': 'CANCELAR_PEDIDO',
            'conceder': True,
        }, format='json')
        self.assertEqual(res_add.status_code, 200)
        self.assertTrue(res_add.data['ativo'])
        self.assertTrue(RolePermissao.objects.filter(role_nome='atendente', permissao=self.perm_cancelar).exists())

        # 2. Revogar CANCELAR_PEDIDO de atendente
        res_del = self.client.post('/api/users/rbac/toggle/', {
            'role': 'atendente',
            'permissao_codigo': 'CANCELAR_PEDIDO',
            'conceder': False,
        }, format='json')
        self.assertEqual(res_del.status_code, 200)
        self.assertFalse(res_del.data['ativo'])
        self.assertFalse(RolePermissao.objects.filter(role_nome='atendente', permissao=self.perm_cancelar).exists())

    def test_rbac_protects_admin_user_management(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post('/api/users/rbac/toggle/', {
            'role': 'administrador',
            'permissao_codigo': 'GERENCIAR_USUARIOS',
            'conceder': False,
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Não é permitido revogar', res.data['detail'])

    def test_me_returns_assigned_permissions(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/users/me/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('permissions', res.data)
        self.assertIn('CANCELAR_PEDIDO', res.data['permissions'])
        self.assertIn('GERENCIAR_USUARIOS', res.data['permissions'])
