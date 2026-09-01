from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models


class Insumo(models.Model):
    """A raw material used by the restaurant operation."""

    class UnidadeMedida(models.TextChoices):
        KG = 'KG', 'Quilograma'
        G = 'G', 'Grama'
        L = 'L', 'Litro'
        ML = 'ML', 'Mililitro'
        UN = 'UN', 'Unidade'

    nome = models.CharField(max_length=255, unique=True)
    unidade_medida = models.CharField(max_length=2, choices=UnidadeMedida.choices)
    quantidade_atual = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        validators=[MinValueValidator(Decimal('0'))],
    )
    estoque_minimo = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        validators=[MinValueValidator(Decimal('0'))],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['nome']
        verbose_name = 'insumo'
        verbose_name_plural = 'insumos'

    def __str__(self):
        return self.nome
