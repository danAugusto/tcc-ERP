"""Entidades do catalogo de produtos.

Product e uma fundacao minima necessaria para os itens de pedido. O modulo
completo de catalogo (categorias, CRUD, cardapio publico) pertence ao epic
Estoque e Produtos.
"""

from django.db import models


class Product(models.Model):
    """Produto disponivel para venda no cardapio."""

    name = models.CharField(max_length=100, unique=True, verbose_name='nome')
    price = models.DecimalField(
        max_digits=12, decimal_places=2, verbose_name='preco'
    )
    is_available = models.BooleanField(
        default=True, verbose_name='disponivel'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'produto'
        verbose_name_plural = 'produtos'

    def __str__(self):
        return f'{self.name} - R$ {self.price}'