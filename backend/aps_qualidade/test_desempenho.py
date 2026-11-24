"""CT-DES: eficiencia de desempenho (ISO/IEC 25010 - Comportamento em relacao ao tempo e utilizacao de recursos).

Mede tempo de resposta e numero de consultas SQL por requisicao. Requisito adotado: o numero de
consultas de uma listagem nao deve crescer com o numero de registros (ausencia de N+1).
Os valores medidos sao gravados em aps_qualidade/resultados/resultados_desempenho.json.
"""

from decimal import Decimal

from catalog.models import Categoria, Produto
from core.models import Turno
from orders.models import ItemPedido, Pedido
from orders.test_fluxo_entrega import FluxoBase

from .base import medir, registrar, resumo


class DesempenhoTests(FluxoBase):
    def _criar_pedidos(self, n, status='criado'):
        outro = self._create_product(name=f'Coxinha {n}', price='7.50')
        for i in range(n):
            p = Pedido.objects.create(status=status, tipo_atendimento='mesa', numero_mesa=str(i % 20),
                                      cliente=self.cliente, total=Decimal('27.50'))
            ItemPedido.objects.create(pedido=p, produto=self.product, quantidade=1, preco_unitario=Decimal('20.00'))
            ItemPedido.objects.create(pedido=p, produto=outro, quantidade=1, preco_unitario=Decimal('7.50'))

    def test_des01_listagem_de_pedidos_sem_n_mais_1(self):
        """CT-DES-01: GET /api/orders/ - consultas nao crescem com o volume (5 x 50 pedidos)."""
        self.como(self.atendente)
        self._criar_pedidos(5)
        _, q5, t5 = medir(self.client, 'get', '/api/orders/')
        self._criar_pedidos(45)
        _, q50, t50 = medir(self.client, 'get', '/api/orders/')
        registrar('DES-01 listagem de pedidos', consultas_5=q5, consultas_50=q50,
                  tempo_5=resumo(t5), tempo_50=resumo(t50))
        self.assertLessEqual(q50, q5 + 5, f'{q5} consultas com 5 pedidos e {q50} com 50 (N+1)')

    def test_des02_tempo_listagem_200_pedidos(self):
        """CT-DES-02: GET /api/orders/ com 200 pedidos responde em menos de 1 s (mediana)."""
        self.como(self.atendente)
        self._criar_pedidos(200)
        r, q, t = medir(self.client, 'get', '/api/orders/', repeticoes=10)
        registrar('DES-02 listagem 200 pedidos', consultas=q, tempo=resumo(t), status=r.status_code)
        self.assertEqual(r.status_code, 200)
        self.assertLess(resumo(t)['mediana_ms'], 1000)

    def test_des03_entregadores_disponiveis_sem_n_mais_1(self):
        """CT-DES-03: entregadores disponiveis - consultas nao crescem (2 x 15 entregadores)."""
        self.como(self.atendente)
        _, q2, _ = medir(self.client, 'get', '/api/orders/entregadores-disponiveis/', repeticoes=1)
        for i in range(13):
            u = self._create_user(f'ent_des_{i}', role='entregador')
            Turno.objects.create(user=u)
        _, q15, t15 = medir(self.client, 'get', '/api/orders/entregadores-disponiveis/')
        registrar('DES-03 entregadores disponiveis', consultas_2=q2, consultas_15=q15, tempo_15=resumo(t15))
        self.assertLessEqual(q15, q2 + 3, f'{q2} consultas com 2 entregadores e {q15} com 15')

    def test_des04_encerrar_expediente_em_lote(self):
        """CT-DES-04: encerrar expediente com 100 pedidos usa atualizacao em lote (<= 10 consultas)."""
        self._criar_pedidos(100, status='finalizado')
        self.como(self.atendente)
        r, q, t = medir(self.client, 'post', '/api/orders/close-shift/', repeticoes=1)
        registrar('DES-04 encerrar expediente 100 pedidos', consultas=q, tempo=resumo(t), status=r.status_code)
        self.assertEqual(r.status_code, 200)
        self.assertLessEqual(q, 10, f'{q} consultas para arquivar 100 pedidos')

    def test_des05_cardapio_100_produtos(self):
        """CT-DES-05: GET /api/catalog/produtos/ com 100 produtos - sem N+1 e < 500 ms."""
        cats = [Categoria.objects.create(nome=f'Cat APS {i}') for i in range(5)]
        for i in range(100):
            Produto.objects.create(nome=f'Produto APS {i}', preco=Decimal('9.90'), categoria=cats[i % 5])
        self.como(self.cliente)
        r, q, t = medir(self.client, 'get', '/api/catalog/produtos/', repeticoes=10)
        registrar('DES-05 cardapio 100 produtos', consultas=q, tempo=resumo(t), status=r.status_code)
        self.assertEqual(r.status_code, 200)
        self.assertLessEqual(q, 10, f'{q} consultas para 100 produtos')
        self.assertLess(resumo(t)['mediana_ms'], 500)

    def test_des06_criacao_de_pedido(self):
        """CT-DES-06: POST de pedido (2 itens) responde em menos de 300 ms (mediana de 20)."""
        self.como(self.atendente)
        payload = {'tipo_atendimento': 'mesa', 'numero_mesa': '5',
                   'itens': [{'produto': self.product.id, 'quantidade': 2}]}
        r, q, t = medir(self.client, 'post', '/api/orders/', repeticoes=20, data=payload, format='json')
        registrar('DES-06 criacao de pedido', consultas=q, tempo=resumo(t), status=r.status_code)
        self.assertEqual(r.status_code, 201)
        self.assertLess(resumo(t)['mediana_ms'], 300)

    def test_des07_login(self):
        """CT-DES-07: login (hash de senha PBKDF2) responde em menos de 1 s."""
        self.client.force_authenticate(user=None)
        r, q, t = medir(self.client, 'post', '/api/users/login/', repeticoes=5,
                        data={'username': 'atend_fluxo', 'password': 'senha-segura-123'}, format='json')
        registrar('DES-07 login', consultas=q, tempo=resumo(t), status=r.status_code)
        self.assertEqual(r.status_code, 200)
        self.assertLess(resumo(t)['mediana_ms'], 1000)
