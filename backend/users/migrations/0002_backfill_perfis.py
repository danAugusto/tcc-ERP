from django.db import migrations


def backfill_perfis(apps, schema_editor):
    Perfil = apps.get_model('users', 'Perfil')
    User = apps.get_model('auth', 'User')

    for user in User.objects.all():
        Perfil.objects.get_or_create(user_id=user.id)


def remove_perfis(apps, schema_editor):
    Perfil = apps.get_model('users', 'Perfil')
    Perfil.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(backfill_perfis, remove_perfis),
    ]