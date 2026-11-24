"""Infraestrutura comum da suite da APS (coleta de metricas de desempenho)."""

import json
import os
import statistics
import time

from django.db import connection
from django.test.utils import CaptureQueriesContext

RESULTADOS = {}
PASTA = os.path.join(os.path.dirname(__file__), 'resultados')
ARQUIVO = os.path.join(PASTA, 'resultados_desempenho.json')


def registrar(chave, **valores):
    RESULTADOS.setdefault(chave, {}).update(valores)
    try:
        os.makedirs(PASTA, exist_ok=True)
        anteriores = {}
        if os.path.exists(ARQUIVO):
            with open(ARQUIVO, encoding='utf-8') as fh:
                anteriores = json.load(fh)
        anteriores.update(RESULTADOS)
        with open(ARQUIVO, 'w', encoding='utf-8') as fh:
            json.dump(anteriores, fh, indent=2, ensure_ascii=False)
    except OSError:
        pass


def medir(client, metodo, url, repeticoes=5, **kwargs):
    """Executa a requisicao N vezes; devolve (resposta, n_queries, tempos_ms)."""
    tempos = []
    resposta = None
    n_queries = None
    for i in range(repeticoes):
        with CaptureQueriesContext(connection) as ctx:
            inicio = time.perf_counter()
            resposta = getattr(client, metodo)(url, **kwargs)
            tempos.append((time.perf_counter() - inicio) * 1000)
        if i == 0:
            n_queries = len(ctx.captured_queries)
    return resposta, n_queries, tempos


def resumo(tempos):
    ordenados = sorted(tempos)
    p95 = ordenados[max(0, int(round(0.95 * len(ordenados))) - 1)]
    return {
        'media_ms': round(statistics.mean(tempos), 1),
        'mediana_ms': round(statistics.median(tempos), 1),
        'p95_ms': round(p95, 1),
        'max_ms': round(max(tempos), 1),
        'amostras': len(tempos),
    }
