"""Logo do estabelecimento: validacao do upload e geracao de logo, favicon e icones do PWA."""

import io
import time
from pathlib import Path

from django.conf import settings
from PIL import Image, ImageOps

from .models import Configuracao

LOGO_VERSAO_CHAVE = 'LOGO_VERSAO'
MAX_BYTES = 2 * 1024 * 1024
MAX_LADO = 4000
FORMATOS = {'PNG', 'JPEG', 'WEBP'}
COR_ICONE = (255, 210, 31, 255)  # amarelo da marca (fundo dos icones do PWA)

PASTA = 'branding'
ARQUIVOS = ('logo.png', 'logo-bw.png', 'favicon.png', 'icon-192.png', 'icon-512.png')
LARGURA_CUPOM = 384  # pontos de uma impressora termica de 58 mm (a de 80 mm apenas amplia)


class LogoInvalida(ValueError):
    pass


def _pasta() -> Path:
    return Path(settings.MEDIA_ROOT) / PASTA


def _abrir(arquivo) -> Image.Image:
    if arquivo.size > MAX_BYTES:
        raise LogoInvalida('A imagem deve ter no máximo 2 MB.')
    try:
        img = Image.open(arquivo)
        formato = (img.format or '').upper()
        img.load()
    except Exception:
        raise LogoInvalida('Arquivo inválido. Envie uma imagem PNG, JPG ou WebP.')
    if formato not in FORMATOS:
        raise LogoInvalida('Formato inválido. Use PNG, JPG ou WebP.')
    if max(img.size) > MAX_LADO:
        raise LogoInvalida(f'A imagem é muito grande (máximo {MAX_LADO}px por lado).')
    return ImageOps.exif_transpose(img).convert('RGBA')


def _icone(logo: Image.Image, lado: int) -> Image.Image:
    """Logo centralizada sobre quadrado amarelo, com margem (compativel com icones 'maskable')."""
    fundo = Image.new('RGBA', (lado, lado), COR_ICONE)
    area = int(lado * 0.84)
    miniatura = ImageOps.contain(logo, (area, area), Image.LANCZOS)
    fundo.alpha_composite(miniatura, ((lado - miniatura.width) // 2, (lado - miniatura.height) // 2))
    return fundo


def _logo_cupom(logo: Image.Image) -> Image.Image:
    """Logo em 1 bit (preto e branco com pontilhado) para a impressora termica; transparencia vira branco."""
    fundo = Image.new('RGBA', logo.size, (255, 255, 255, 255))
    fundo.alpha_composite(logo)
    cinza = ImageOps.autocontrast(fundo.convert('L'), cutoff=2)  # logos claras/coloridas ganham contraste
    miniatura = ImageOps.contain(cinza, (LARGURA_CUPOM, LARGURA_CUPOM // 2), Image.LANCZOS)
    return miniatura.convert('1')  # Floyd-Steinberg


def _aparar(logo: Image.Image) -> Image.Image:
    """Remove a margem transparente da imagem enviada, para a logo ocupar o quadrado inteiro."""
    caixa = logo.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    return logo.crop(caixa) if caixa else logo


def salvar_logo(arquivo) -> str:
    logo = _aparar(_abrir(arquivo))
    pasta = _pasta()
    pasta.mkdir(parents=True, exist_ok=True)

    saidas = {
        'logo.png': ImageOps.contain(logo, (256, 256), Image.LANCZOS),
        'logo-bw.png': _logo_cupom(logo),
        'favicon.png': _icone(logo, 64),
        'icon-192.png': _icone(logo, 192),
        'icon-512.png': _icone(logo, 512),
    }
    # Grava tudo em memoria antes de tocar o disco: falha parcial nao deixa estado inconsistente
    buffers = {}
    for nome, img in saidas.items():
        buf = io.BytesIO()
        img.save(buf, 'PNG', optimize=True)
        buffers[nome] = buf.getvalue()
    for nome, dados in buffers.items():
        (pasta / nome).write_bytes(dados)

    versao = str(int(time.time()))
    Configuracao.objects.update_or_create(
        chave=LOGO_VERSAO_CHAVE,
        defaults={'valor': versao, 'descricao': 'Versão da logo enviada (invalida o cache do navegador)'},
    )
    return versao


def remover_logo() -> None:
    for nome in ARQUIVOS:
        (_pasta() / nome).unlink(missing_ok=True)
    Configuracao.objects.update_or_create(
        chave=LOGO_VERSAO_CHAVE,
        defaults={'valor': '', 'descricao': 'Versão da logo enviada (invalida o cache do navegador)'},
    )


def urls_logo():
    """Retorna as URLs da logo atual ou None quando vale o icone padrao."""
    cfg = Configuracao.objects.filter(chave=LOGO_VERSAO_CHAVE).first()
    if not cfg or not cfg.valor or not (_pasta() / 'logo.png').exists():
        return None
    base = f'{settings.MEDIA_URL}{PASTA}'
    v = cfg.valor
    return {
        'logo': f'{base}/logo.png?v={v}',
        'logo_bw': f'{base}/logo-bw.png?v={v}',
        'favicon': f'{base}/favicon.png?v={v}',
        'icon_192': f'{base}/icon-192.png?v={v}',
        'icon_512': f'{base}/icon-512.png?v={v}',
    }
