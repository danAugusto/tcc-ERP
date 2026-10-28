"""Entidades do modulo de pedidos."""

from django.conf import settings
from django.db import models

from finance.models import PAYMENT_CHOICES


class Pedido(models.Model):
    """Pedido com fluxo de status que integra ao financeiro e a fila de preparo."""

    STATUS_CHOICES = [
        ('criado', 'Criado'),
        ('confirmado', 'Confirmado'),
        ('em_preparo', 'Em preparo'),
        ('pronto', 'Pronto'),
        ('entregue', 'Entregue'),
        ('finalizado', 'Finalizado'),
        ('arquivado', 'Arquivado'),
        ('retornando_base', 'Retornando à base'),
        ('cancelado', 'Cancelado'),
    ]

    TIPO_ATENDIMENTO_CHOICES = [
        ('mesa', 'Mesa'),
        ('balcao', 'Balcão'),
        ('delivery', 'Delivery'),
        ('retirada', 'Retirada'),
    ]

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='criado',
        verbose_name='status',
    )
    tipo_atendimento = models.CharField(
        max_length=20,
        choices=TIPO_ATENDIMENTO_CHOICES,
        default='mesa',
        verbose_name='tipo de atendimento',
    )
    numero_mesa = models.CharField(
        max_length=50,
        blank=True,
        default='',
        verbose_name='número da mesa',
    )
    numero_comanda = models.CharField(
        max_length=10,
        blank=True,
        default='',
        verbose_name='número da comanda',
    )
    cliente = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pedidos',
        verbose_name='cliente',
    )
    entregador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='entregas',
        verbose_name='entregador',
    )
    codigo_pin_entrega = models.CharField(
        max_length=4,
        null=True,
        blank=True,
        verbose_name='código PIN de entrega',
    )
    comprovante_entrega_url = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name='comprovante de entrega',
    )
    motivo_falha_entrega = models.TextField(
        null=True,
        blank=True,
        verbose_name='motivo da falha de entrega',
    )
    total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='total',
    )
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_CHOICES,
        blank=True,
        default='outros',
        verbose_name='forma de pagamento',
    )
    taxa_entrega = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=0,
        verbose_name='taxa de entrega',
    )
    valor_recebido = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        default=0.00,
        verbose_name='valor recebido',
    )
    troco = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        default=0.00,
        verbose_name='troco',
    )
    confirmed_at = models.DateTimeField(
        null=True, blank=True, verbose_name='confirmado em'
    )
    cancelled_at = models.DateTimeField(
        null=True, blank=True, verbose_name='cancelado em'
    )
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pedidos_cancelados',
        verbose_name='cancelado por',
    )
    cancellation_reason = models.TextField(
        blank=True, verbose_name='motivo do cancelamento'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']
        verbose_name = 'pedido'
        verbose_name_plural = 'pedidos'

    def __str__(self):
        return f'Pedido #{self.id} - {self.get_status_display()}'


class EnderecoPedido(models.Model):
    """Endereco de entrega vinculado a pedidos do tipo delivery."""

    pedido = models.OneToOneField(
        Pedido,
        on_delete=models.CASCADE,
        related_name='endereco',
        verbose_name='pedido',
    )
    cep = models.CharField(max_length=10, verbose_name='CEP')
    logradouro = models.CharField(max_length=150, verbose_name='logradouro / rua')
    numero = models.CharField(max_length=20, verbose_name='número')
    complemento = models.CharField(
        max_length=100, blank=True, default='', verbose_name='complemento'
    )
    bairro = models.CharField(max_length=100, verbose_name='bairro')
    cidade = models.CharField(max_length=100, verbose_name='cidade')
    uf = models.CharField(max_length=2, verbose_name='UF')

    class Meta:
        verbose_name = 'endereço do pedido'
        verbose_name_plural = 'endereços dos pedidos'

    def __str__(self):
        return f'{self.logradouro}, {self.numero} - {self.bairro}, {self.cidade}/{self.uf}'


class ItemPedido(models.Model):
    """Item de um pedido, com preco registrado no momento da venda."""

    pedido = models.ForeignKey(
        Pedido,
        on_delete=models.CASCADE,
        related_name='itens',
        verbose_name='pedido',
    )
    produto = models.ForeignKey(
        'catalog.Produto',
        on_delete=models.PROTECT,
        related_name='itens_pedido',
        verbose_name='produto',
    )
    quantidade = models.PositiveIntegerField(default=1, verbose_name='quantidade')
    preco_unitario = models.DecimalField(
        max_digits=12, decimal_places=2, verbose_name='preco unitario'
    )

    class Meta:
        ordering = ['id']
        verbose_name = 'item do pedido'
        verbose_name_plural = 'itens do pedido'

    @property
    def subtotal(self):
        return self.preco_unitario * self.quantidade

    def __str__(self):
        return f'{self.produto.nome} x{self.quantidade}'