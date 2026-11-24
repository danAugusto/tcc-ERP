from django.core.management.base import BaseCommand
from users.models import Permissao, RolePermissao

class Command(BaseCommand):
    help = 'Cria as permissões padrão do sistema'

    def handle(self, *args, **kwargs):
        permissoes_iniciais = [
            # ('codigo', 'descricao', 'modulo')
            ('VER_METRICAS', 'Visualizar dashboard de faturamento', 'FINANCEIRO'),
            ('CANCELAR_PEDIDO', 'Cancelar pedido já confirmado', 'PEDIDOS'),
            ('FECHAR_CAIXA', 'Realizar acerto e fechamento de caixa', 'FINANCEIRO'),
            ('EDITAR_ESTOQUE', 'Editar quantidade de insumos em estoque', 'INVENTARIO'),
            ('GERENCIAR_USUARIOS', 'Criar, editar ou remover usuários', 'ADMINISTRACAO'),
        ]

        roles_permissoes = {
            'administrador': ['VER_METRICAS', 'CANCELAR_PEDIDO', 'FECHAR_CAIXA', 'EDITAR_ESTOQUE', 'GERENCIAR_USUARIOS'],
            'atendente': ['CANCELAR_PEDIDO', 'FECHAR_CAIXA'],
            'cozinheiro': ['EDITAR_ESTOQUE'],
            # Entregador e cliente não recebem essas permissões default
        }

        # 1. Inserir Permissões
        for codigo, descricao, modulo in permissoes_iniciais:
            Permissao.objects.get_or_create(
                codigo=codigo,
                defaults={'descricao': descricao, 'modulo': modulo}
            )
            self.stdout.write(self.style.SUCCESS(f'Permissão verificada/criada: {codigo}'))

        # 2. Inserir RolePermissoes
        for role, codigos in roles_permissoes.items():
            for codigo in codigos:
                permissao = Permissao.objects.get(codigo=codigo)
                RolePermissao.objects.get_or_create(
                    role_nome=role,
                    permissao=permissao
                )
                self.stdout.write(self.style.SUCCESS(f'Atribuída permissão {codigo} para {role}'))
        
        self.stdout.write(self.style.SUCCESS('Seed de permissões concluído!'))
