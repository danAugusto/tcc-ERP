"""Tratamento centralizado de excecoes da API."""

import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def erp_exception_handler(exc, context):
    """Converte erros de entrada nao tratados em HTTP 400 em vez de 500."""
    if isinstance(exc, (ValueError, TypeError, DjangoValidationError)):
        logger.warning('Entrada invalida em %s: %s', context['view'].__class__.__name__, exc)
        exc = ValidationError('Dados invalidos.')
    return exception_handler(exc, context)
