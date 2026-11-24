"""CT-ROB: robustez a entradas invalidas (ISO/IEC 25010 - Confiabilidade/Tolerancia a falhas).

Requisito: nenhuma entrada do usuario pode provocar erro interno (HTTP 500); o sistema
deve responder 4xx com mensagem de validacao.
"""

from django.urls import reverse

from orders.test_fluxo_entrega import FluxoBase


class RobustezTests(FluxoBase):
    def setUp(self):
        super().setUp()
        self.client.raise_request_exception = False

    def _pedido_mesa(self):
        return self.novo_pedido(user=self.atendente, tipo='mesa')

    def test_rob01_adicionar_item_quantidade_texto(self):
        """CT-ROB-01: adicionar item com quantidade='abc' deve retornar 400."""
        pid = self._pedido_mesa()
        self.como(self.atendente)
        r = self.client.post(reverse('orders:pedido_add_item', kwargs={'pk': pid}),
                             {'produto': self.product.id, 'quantidade': 'abc'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_rob02_remover_item_id_texto(self):
        """CT-ROB-02: remover item com item_id='abc' deve retornar 400."""
        pid = self._pedido_mesa()
        self.como(self.atendente)
        r = self.client.post(reverse('orders:pedido_remove_item', kwargs={'pk': pid}),
                             {'item_id': 'abc'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_rob03_atribuir_entregador_id_texto(self):
        """CT-ROB-03: atribuir entregador com entregador_id='abc' deve retornar 400."""
        pid = self.novo_pedido()
        self.pronto(pid)
        self.como(self.atendente)
        r = self.client.post(f'/api/orders/{pid}/atribuir-entregador/', {'entregador_id': 'abc'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_rob04_filtro_de_turnos_com_data_invalida(self):
        """CT-ROB-04: filtro ?data=abc em turnos nao pode gerar erro interno."""
        self.como(self.atendente)
        r = self.client.get('/api/core/turnos/?data=abc')
        self.assertLess(r.status_code, 500)

    def test_rob05_pagamento_valor_texto(self):
        """CT-ROB-05: pagamento com valor_recebido='abc' retorna 400."""
        pid = self._pedido_mesa()
        self.como(self.atendente)
        r = self.client.post(reverse('orders:pedido_pay', kwargs={'pk': pid}),
                             {'payment_method': 'dinheiro', 'valor_recebido': 'abc'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_rob06_pagamento_valor_insuficiente(self):
        """CT-ROB-06: pagamento abaixo do total retorna 400."""
        pid = self._pedido_mesa()
        self.como(self.atendente)
        r = self.client.post(reverse('orders:pedido_pay', kwargs={'pk': pid}),
                             {'payment_method': 'dinheiro', 'valor_recebido': '1.00'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_rob07_quantidade_negativa(self):
        """CT-ROB-07: item com quantidade negativa e rejeitado (400)."""
        self.como(self.cliente)
        r = self.client.post(reverse('orders:pedido_list_create'),
                             self._pedido_payload(self.product, -1), format='json')
        self.assertEqual(r.status_code, 400)

    def test_rob08_transicao_invalida(self):
        """CT-ROB-08: transicao criado -> pronto e recusada (400)."""
        pid = self._pedido_mesa()
        self.assertEqual(self.status(pid, 'pronto').status_code, 400)

    def test_rob09_periodo_financeiro_invertido(self):
        """CT-ROB-09: periodo com inicio > fim e recusado (400)."""
        admin = self._create_user('admin_rob', role='administrador')
        self.como(admin)
        r = self.client.get('/api/finance/summary/?inicio=2026-08-31&fim=2026-08-01')
        self.assertEqual(r.status_code, 400)
