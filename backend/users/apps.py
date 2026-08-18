from django.apps import AppConfig


class UsersConfig(AppConfig):
    name = 'users'

    def ready(self):
        from django.conf import settings
        from django.db.models.signals import post_save

        from .models import criar_perfil_para_usuario

        post_save.connect(
            criar_perfil_para_usuario,
            sender=settings.AUTH_USER_MODEL,
            dispatch_uid='users.criar_perfil_para_usuario',
        )
