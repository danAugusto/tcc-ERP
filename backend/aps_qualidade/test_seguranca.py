"""CT-SEG: requisitos de seguranca e controle de acesso (ISO/IEC 25010 - Seguranca)."""

from django.contrib.auth import get_user_model
from django.urls import reverse

from core.models import Turno
from orders.models import Pedido
from orders.test_fluxo_entrega import FluxoBase

User = get_user_model()


def _lista(data):
    return data['results'] if isinstance(data, dict) and 'results' in data else data


class ControleDeAcessoTests(FluxoBase):
    def test_seg01_cliente_nao_lista_entregadores(self):
        """CT-SEG-01: cliente nao pode listar entregadores (nomes, usuarios e status)."""
        self.como(self.cliente)
        r = self.client.get('/api/orders/entregadores-disponiveis/')
        self.assertIn(r.status_code, (401, 403), f'retornou {r.status_code}: dados de entregadores expostos ao cliente')

    def test_seg02_entregador_nao_exclui_turno_de_outro_funcionario(self):
        """CT-SEG-02: entregador nao pode excluir o turno (ponto/caixa) de outro funcionario."""
        turno = Turno.objects.create(user=self.atendente)
        self.como(self.entregador)
        r = self.client.delete(f'/api/core/turnos/{turno.id}/')
        self.assertIn(r.status_code, (403, 404, 405), f'retornou {r.status_code}')
        self.assertTrue(Turno.objects.filter(pk=turno.pk).exists(), 'turno de outro funcionario foi excluido')

    def test_seg03_entregador_nao_lista_turnos_de_todos(self):
        """CT-SEG-03: entregador so deve ver os proprios turnos."""
        Turno.objects.create(user=self.atendente)
        self.como(self.entregador)
        r = self.client.get('/api/core/turnos/')
        self.assertEqual(r.status_code, 200)
        donos = {t['user'] for t in _lista(r.data)}
        self.assertTrue(donos <= {self.entregador.id}, f'entregador viu turnos dos usuarios {sorted(donos)}')

    def test_seg04_cliente_nao_escolhe_entregador_ao_criar_pedido(self):
        """CT-SEG-04: cliente nao pode pre-atribuir um entregador ao criar o pedido."""
        self.como(self.cliente)
        payload = self._pedido_payload(self.product, 1)
        payload.update({
            'tipo_atendimento': 'delivery',
            'entregador': self.entregador.id,
            'endereco': {'cep': '13000-000', 'logradouro': 'Rua B', 'numero': '2',
                         'bairro': 'Centro', 'cidade': 'Campinas', 'uf': 'SP'},
        })
        r = self.client.post(reverse('orders:pedido_list_create'), payload, format='json')
        if r.status_code == 201:
            self.assertIsNone(Pedido.objects.get(pk=r.data['id']).entregador_id,
                              'entregador gravado a partir do payload do cliente')

    def test_seg05_pin_de_entrega_limita_tentativas(self):
        """CT-SEG-05: confirmacao por PIN deve bloquear apos 10 tentativas erradas (forca bruta)."""
        pid = self.novo_pedido()
        self.pronto(pid)
        self.assertEqual(self.atribuir(pid).status_code, 200)
        correto = Pedido.objects.get(pk=pid).codigo_pin_entrega
        errados = [f'{n:04d}' for n in range(1000, 1100) if f'{n:04d}' != correto][:11]
        self.como(self.entregador)
        url = f'/api/orders/{pid}/confirmar-entrega/'
        codigos = [self.client.post(url, {'metodo_validacao': 'pin', 'pin': p}, format='json').status_code
                   for p in errados]
        self.assertIn(codigos[-1], (403, 429), f'11a tentativa errada ainda aceita para validacao (codigos={codigos})')

    def test_seg06_cadastro_rejeita_senha_fraca(self):
        """CT-SEG-06: cadastro publico deve aplicar a politica de senhas (rejeitar '12345678')."""
        self.client.force_authenticate(user=None)
        r = self.client.post('/api/users/register/',
                             {'username': 'aps_fraca', 'email': 'a@a.com', 'password': '12345678'}, format='json')
        self.assertEqual(r.status_code, 400, f'retornou {r.status_code}: senha fraca aceita')

    def test_seg07_funcionario_sem_senha_nao_recebe_senha_padrao(self):
        """CT-SEG-07: funcionario criado sem senha nao pode entrar com a senha padrao '12345678'."""
        admin = self._create_user('admin_aps', role='administrador')
        self.como(admin)
        r = self.client.post('/api/users/funcionarios/',
                             {'username': 'func_aps', 'role': 'atendente', 'password': ''}, format='json')
        self.client.force_authenticate(user=None)
        if r.status_code == 201:
            login = self.client.post('/api/users/login/',
                                     {'username': 'func_aps', 'password': '12345678'}, format='json')
            self.assertNotEqual(login.status_code, 200, 'login com senha padrao conhecida foi aceito')

    def test_seg08_nome_de_usuario_nao_define_perfil(self):
        """CT-SEG-08: registrar-se como 'superadmin' nao pode conceder o perfil superadmin."""
        self.client.force_authenticate(user=None)
        r = self.client.post('/api/users/register/',
                             {'username': 'superadmin', 'email': 's@s.com', 'password': 'Xq9!fraseLonga-2026'},
                             format='json')
        if r.status_code != 201:
            self.skipTest(f'cadastro retornou {r.status_code}')
        self.como(User.objects.get(username='superadmin'))
        me = self.client.get('/api/users/me/')
        self.assertEqual(me.data['role'], 'cliente', f"perfil informado: {me.data['role']}")

    # ---- controles que devem continuar funcionando (regressao)
    def test_seg09_anonimo_nao_lista_pedidos(self):
        """CT-SEG-09: usuario anonimo nao acessa pedidos (401)."""
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(reverse('orders:pedido_list_create')).status_code, 401)

    def test_seg10_cliente_nao_acessa_financeiro(self):
        """CT-SEG-10: cliente nao acessa o resumo financeiro (403)."""
        self.como(self.cliente)
        self.assertEqual(self.client.get('/api/finance/summary/').status_code, 403)

    def test_seg11_cliente_nao_ve_pedido_de_outro(self):
        """CT-SEG-11: cliente nao consulta pedido de outro cliente (404)."""
        pid = self.novo_pedido(user=self.outro_cliente)
        self.como(self.cliente)
        self.assertEqual(self.client.get(self._pedido_url(pid)).status_code, 404)

    def test_seg12_entregador_nao_acessa_auditoria(self):
        """CT-SEG-12: somente administrador consulta a trilha de auditoria."""
        self.como(self.entregador)
        self.assertEqual(self.client.get('/api/core/auditoria/').status_code, 403)
