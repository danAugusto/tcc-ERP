"""CT-FUN: cenarios funcionais de endpoints sem cobertura na suite original."""

from django.urls import reverse

from core.models import Auditoria
from orders.test_fluxo_entrega import FluxoBase


def _lista(data):
    return data['results'] if isinstance(data, dict) and 'results' in data else data


class FuncionalTests(FluxoBase):
    def setUp(self):
        super().setUp()
        self.admin = self._create_user('admin_fun', role='administrador')

    def test_fun01_health_check(self):
        """CT-FUN-01: /api/health/ responde 200 com status ok."""
        self.client.force_authenticate(user=None)
        r = self.client.get('/api/health/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['status'], 'ok')

    def test_fun02_admin_lista_funcionarios_sem_clientes(self):
        """CT-FUN-02: administrador lista a equipe e clientes nao aparecem."""
        self.como(self.admin)
        r = self.client.get('/api/users/funcionarios/')
        self.assertEqual(r.status_code, 200)
        nomes = {u['username'] for u in _lista(r.data)}
        self.assertIn('atend_fluxo', nomes)
        self.assertNotIn('cli_fluxo', nomes)

    def test_fun03_atendente_nao_gerencia_funcionarios(self):
        """CT-FUN-03: atendente nao acessa o CRUD de funcionarios (403)."""
        self.como(self.atendente)
        self.assertEqual(self.client.get('/api/users/funcionarios/').status_code, 403)

    def test_fun04_cancelamento_gera_auditoria(self):
        """CT-FUN-04: cancelar pedido registra CANCELOU_PEDIDO na auditoria."""
        pid = self.novo_pedido(user=self.atendente, tipo='mesa')
        self.assertEqual(self.status(pid, 'confirmado').status_code, 200)
        r = self.status(pid, 'cancelado', cancellation_reason='cliente desistiu')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(Auditoria.objects.filter(acao='CANCELOU_PEDIDO', entidade_id=pid).exists())

    def test_fun05_refresh_token(self):
        """CT-FUN-05: o refresh token gera novo access token."""
        self.client.force_authenticate(user=None)
        login = self.client.post('/api/users/login/',
                                 {'username': 'atend_fluxo', 'password': 'senha-segura-123'}, format='json')
        self.assertEqual(login.status_code, 200)
        r = self.client.post('/api/users/token/refresh/', {'refresh': login.data['refresh']}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertIn('access', r.data)

    def test_fun06_metricas_somente_admin(self):
        """CT-FUN-06: metricas analiticas: admin 200, atendente 403."""
        self.como(self.admin)
        self.assertEqual(self.client.get('/api/core/metricas/').status_code, 200)
        self.como(self.atendente)
        self.assertEqual(self.client.get('/api/core/metricas/').status_code, 403)

    def test_fun07_configuracoes_somente_admin(self):
        """CT-FUN-07: configuracoes do sistema: atendente 403."""
        self.como(self.atendente)
        self.assertEqual(self.client.get('/api/core/configuracoes/').status_code, 403)

    def test_fun08_fluxo_balcao_completo(self):
        """CT-FUN-08: fluxo balcao criar -> confirmar -> preparar -> pagar finaliza o pedido."""
        pid = self.novo_pedido(user=self.atendente, tipo='balcao')
        self.pronto(pid)
        r = self.pagar(pid, metodo='dinheiro')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['status'], 'finalizado')
