from django.conf import settings
from django.db import models

TYPE_CHOICES = [
    ('receita', 'Receita'),
    ('despesa', 'Despesa'),
]

PAYMENT_CHOICES = [
    ('dinheiro', 'Dinheiro'),
    ('cartao_debito', 'Cartao de debito'),
    ('cartao_credito', 'Cartao de credito'),
    ('pix', 'Pix'),
    ('outros', 'Outros'),
]


class FinanceCategory(models.Model):
    """Categoria financeira que organiza lancamentos por tipo."""

    name = models.CharField(max_length=100, unique=True, verbose_name='nome')
    type = models.CharField(max_length=10, choices=TYPE_CHOICES, verbose_name='tipo')
    description = models.TextField(blank=True, verbose_name='descricao')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['type', 'name']
        verbose_name = 'categoria financeira'
        verbose_name_plural = 'categorias financeiras'

    def __str__(self):
        return f'{self.get_type_display()} - {self.name}'


class Lancamento(models.Model):
    """Lancamento financeiro de receita ou despesa."""

    type = models.CharField(max_length=10, choices=TYPE_CHOICES, verbose_name='tipo')
    value = models.DecimalField(
        max_digits=12, decimal_places=2, verbose_name='valor'
    )
    description = models.TextField(verbose_name='descricao')
    date = models.DateField(verbose_name='data')
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_CHOICES,
        blank=True,
        default='outros',
        verbose_name='forma de pagamento',
    )
    category = models.ForeignKey(
        FinanceCategory,
        on_delete=models.PROTECT,
        related_name='lancamentos',
        verbose_name='categoria',
    )
    responsible = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='lancamentos',
        verbose_name='responsavel',
    )
    pedido = models.OneToOneField(
        'orders.Pedido',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='lancamento_financeiro',
        verbose_name='pedido de origem',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-id']
        verbose_name = 'lancamento'
        verbose_name_plural = 'lancamentos'

    def __str__(self):
        return f'{self.get_type_display()} {self.value} - {self.date}'