from django.conf import settings
from django.db import models


class Turno(models.Model):
    """Registro de ponto e turnos de trabalho dos funcionários."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='turnos',
        verbose_name='usuário',
    )
    inicio = models.DateTimeField(auto_now_add=True, verbose_name='início do turno')
    fim = models.DateTimeField(null=True, blank=True, verbose_name='fim do turno')
    saldo_dinheiro = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='saldo em dinheiro a repassar',
    )
    acerto_confirmado = models.BooleanField(
        default=False,
        verbose_name='acerto de caixa confirmado',
    )

    class Meta:
        db_table = 'rh_turno'
        ordering = ['-inicio']
        verbose_name = 'turno'
        verbose_name_plural = 'turnos'

    def __str__(self):
        status = 'Ativo' if not self.fim else 'Encerrado'
        return f'Turno #{self.id} - {self.user.username} ({status})'


class Auditoria(models.Model):
    """Trilha de auditoria para rastreabilidade de ações críticas no ERP."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='auditorias',
        verbose_name='usuário',
    )
    acao = models.CharField(max_length=50, verbose_name='ação executada')
    entidade = models.CharField(max_length=50, verbose_name='entidade afetada')
    entidade_id = models.BigIntegerField(verbose_name='ID da entidade')
    detalhes = models.TextField(null=True, blank=True, verbose_name='detalhes do evento')
    data = models.DateTimeField(auto_now_add=True, verbose_name='data e hora')

    class Meta:
        db_table = 'rh_auditoria'
        ordering = ['-data']
        verbose_name = 'registro de auditoria'
        verbose_name_plural = 'registros de auditoria'

    def __str__(self):
        return f'[{self.data:%d/%m/%Y %H:%M}] {self.user.username} - {self.acao} em {self.entidade}#{self.entidade_id}'


class Configuracao(models.Model):
    """Configurações operacionais e metas globais do sistema."""

    chave = models.CharField(max_length=50, primary_key=True, verbose_name='chave da configuração')
    valor = models.TextField(verbose_name='valor')
    descricao = models.CharField(max_length=255, null=True, blank=True, verbose_name='descrição')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='atualizado em')

    class Meta:
        db_table = 'sys_configuracao'
        ordering = ['chave']
        verbose_name = 'configuração do sistema'
        verbose_name_plural = 'configurações do sistema'

    def __str__(self):
        return f'{self.chave}: {self.valor}'
