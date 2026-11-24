"""Cria o primeiro administrador a partir de variaveis de ambiente (nunca sobrescreve um existente)."""

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from users.models import Perfil


class Command(BaseCommand):
    help = 'Cria o administrador inicial usando ADMIN_USERNAME, ADMIN_PASSWORD e ADMIN_EMAIL.'

    def handle(self, *args, **options):
        username = os.environ.get('ADMIN_USERNAME', '').strip()
        password = os.environ.get('ADMIN_PASSWORD', '')
        email = os.environ.get('ADMIN_EMAIL', '').strip()

        User = get_user_model()
        if not username or not password:
            if User.objects.filter(is_superuser=True).exists():
                self.stdout.write('Administrador inicial: ADMIN_USERNAME/ADMIN_PASSWORD nao definidos; ignorado.')
                return
            raise CommandError('Defina ADMIN_USERNAME e ADMIN_PASSWORD para criar o primeiro administrador.')

        if User.objects.filter(username=username).exists():
            self.stdout.write(f'Administrador "{username}" ja existe; senha preservada.')
            return

        if len(password) < 8:
            raise CommandError('ADMIN_PASSWORD deve ter pelo menos 8 caracteres.')

        user = User.objects.create_superuser(username=username, email=email, password=password)
        perfil, _ = Perfil.objects.get_or_create(user=user)
        perfil.role = 'administrador'
        perfil.save()
        self.stdout.write(self.style.SUCCESS(f'Administrador "{username}" criado.'))
