from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from catalog.models import Categoria
import os

class Command(BaseCommand):
    help = 'Carrega dados iniciais do sistema'

    def handle(self, *args, **kwargs):
        self.stdout.write('Iniciando carga de dados iniciais...')

        # Criar admin se não existir
        admin_username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'admin')
        admin_password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', 'admin')
        admin_email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@example.com')

        if not User.objects.filter(username=admin_username).exists():
            User.objects.create_superuser(admin_username, admin_email, admin_password)
            self.stdout.write(self.style.SUCCESS(f'Superusuário "{admin_username}" criado.'))
        else:
            self.stdout.write(self.style.WARNING(f'Superusuário "{admin_username}" já existe.'))

        # Criar categorias padrão
        categorias = ['Lanches', 'Bebidas', 'Sobremesas', 'Porções', 'Pasteis']
        for cat_nome in categorias:
            cat, created = Categoria.objects.get_or_create(nome=cat_nome)
            if created:
                self.stdout.write(self.style.SUCCESS(f'Categoria "{cat_nome}" criada.'))
            else:
                self.stdout.write(self.style.WARNING(f'Categoria "{cat_nome}" já existe.'))

        self.stdout.write(self.style.SUCCESS('Carga de dados concluída com sucesso!'))
