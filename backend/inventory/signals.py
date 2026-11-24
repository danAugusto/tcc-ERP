from django.db.models import F
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Insumo, Movimentacao


@receiver(post_save, sender=Movimentacao)
def update_insumo_quantidade(sender, instance, created, **kwargs):
    """
    Atualiza a quantidade do insumo sempre que uma nova movimentação é criada.
    Usa F() expressions para atualização atômica, evitando condições de corrida.
    Movimentações não devem ser editadas ou excluídas por regra de negócio.
    """
    if created:
        if instance.tipo == Movimentacao.Tipo.ENTRADA:
            Insumo.objects.filter(pk=instance.insumo_id).update(
                quantidade_atual=F('quantidade_atual') + instance.quantidade
            )
        elif instance.tipo == Movimentacao.Tipo.SAIDA:
            Insumo.objects.filter(pk=instance.insumo_id).update(
                quantidade_atual=F('quantidade_atual') - instance.quantidade
            )
        # Refresh para que o objeto em memória reflita o valor atualizado
        instance.insumo.refresh_from_db()
