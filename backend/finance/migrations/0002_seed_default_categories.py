from django.db import migrations

DEFAULT_CATEGORIES = [
    ('Vendas', 'receita', 'Vendas de produtos e servicos.'),
    ('Outros ganhos', 'receita', 'Outras entradas de receita.'),
    ('Compra de insumos', 'despesa', 'Aquisição de insumos para producao.'),
    ('Aluguel', 'despesa', 'Pagamento de aluguel do estabelecimento.'),
    ('Manutenção', 'despesa', 'Manutencao de equipamentos e estrutura.'),
]


def seed_default_categories(apps, schema_editor):
    FinanceCategory = apps.get_model('finance', 'FinanceCategory')
    for name, category_type, description in DEFAULT_CATEGORIES:
        FinanceCategory.objects.get_or_create(
            name=name,
            defaults={'type': category_type, 'description': description},
        )


def remove_default_categories(apps, schema_editor):
    FinanceCategory = apps.get_model('finance', 'FinanceCategory')
    FinanceCategory.objects.filter(
        name__in=[item[0] for item in DEFAULT_CATEGORIES]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_default_categories, remove_default_categories),
    ]