import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

# 1. Superadmin (DevMode / God Mode - Acesso Irrestrito)
from users.models import Perfil

superadmin_user, created_super = User.objects.get_or_create(
    username='superadmin',
    defaults={'email': 'superadmin@example.com'}
)
superadmin_user.is_superuser = True
superadmin_user.is_staff = True
superadmin_user.set_password('superadmin')
superadmin_user.save()
perfil_super, _ = Perfil.objects.get_or_create(user=superadmin_user)
perfil_super.role = 'superadmin'
perfil_super.save()

if created_super:
    print('Superadmin (DevMode) created: superadmin / superadmin')
else:
    print('Superadmin (DevMode) verified: superadmin / superadmin')

# 1.1 Administrador (Operação do Estabelecimento / Gerente)
admin_user, created = User.objects.get_or_create(
    username='admin',
    defaults={'email': 'admin@example.com'}
)
admin_user.is_superuser = True
admin_user.is_staff = True
admin_user.set_password('admin')
admin_user.save()
perfil, _ = Perfil.objects.get_or_create(user=admin_user)
perfil.role = 'administrador'
perfil.save()

if created:
    print('Admin (Gerente) created: admin / admin')
else:
    print('Admin (Gerente) verified: admin / admin')


# Função auxiliar para criar usuários regulares e assinalar o perfil
def create_role_user(username, role_name):
    user, created = User.objects.get_or_create(
        username=username,
        defaults={'email': f'{username}@example.com'}
    )
    user.set_password(username)
    user.save()

    perfil, _ = Perfil.objects.get_or_create(user=user)
    perfil.role = role_name
    perfil.save()

    if created:
        print(f'{role_name.capitalize()} created: {username} / {username}')
    else:
        print(f'{role_name.capitalize()} verified: {username}')

# 2. Atendente
create_role_user('atendente', 'atendente')

# 3. Cozinheiro
create_role_user('cozinheiro', 'cozinheiro')

# 4. Entregador
create_role_user('entregador', 'entregador')

# 5. Cliente
create_role_user('cliente', 'cliente')

