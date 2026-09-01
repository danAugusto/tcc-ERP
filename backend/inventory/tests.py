from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Insumo


class InsumoApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='administrador_estoque', password='senha-segura-123'
        )
        self.client.force_authenticate(self.user)

    def insumo_payload(self, **overrides):
        payload = {
            'nome': 'Farinha de trigo',
            'unidade_medida': 'KG',
            'quantidade_atual': '20.000',
            'estoque_minimo': '5.000',
        }
        payload.update(overrides)
        return payload

    def test_authenticated_user_can_create_insumo(self):
        response = self.client.post(
            '/api/inventory/insumos/', self.insumo_payload(), format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['unidade_medida'], 'KG')
        self.assertEqual(response.data['quantidade_atual'], '20.000')
        self.assertTrue(Insumo.objects.filter(nome='Farinha de trigo').exists())

    def test_authenticated_user_can_list_retrieve_update_and_delete_insumo(self):
        insumo = Insumo.objects.create(
            nome='Óleo',
            unidade_medida='L',
            quantidade_atual='10.000',
            estoque_minimo='2.000',
        )

        list_response = self.client.get('/api/inventory/insumos/')
        retrieve_response = self.client.get(f'/api/inventory/insumos/{insumo.id}/')
        update_response = self.client.put(
            f'/api/inventory/insumos/{insumo.id}/',
            self.insumo_payload(
                nome='Óleo de soja',
                unidade_medida='L',
                quantidade_atual='8.500',
                estoque_minimo='2.500',
            ),
            format='json',
        )
        delete_response = self.client.delete(f'/api/inventory/insumos/{insumo.id}/')

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(retrieve_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Insumo.objects.filter(id=insumo.id).exists())

    def test_insumo_name_must_be_unique(self):
        Insumo.objects.create(
            nome='Queijo',
            unidade_medida='KG',
            quantidade_atual='5.000',
            estoque_minimo='1.000',
        )

        response = self.client.post(
            '/api/inventory/insumos/', self.insumo_payload(nome='Queijo'), format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('nome', response.data)

    def test_insumo_requires_a_valid_measurement_unit(self):
        response = self.client.post(
            '/api/inventory/insumos/',
            self.insumo_payload(unidade_medida='CX'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('unidade_medida', response.data)

    def test_insumo_quantities_cannot_be_negative(self):
        for field_name in ('quantidade_atual', 'estoque_minimo'):
            with self.subTest(campo=field_name):
                response = self.client.post(
                    '/api/inventory/insumos/',
                    self.insumo_payload(nome=f'Insumo {field_name}', **{field_name: '-0.001'}),
                    format='json',
                )

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field_name, response.data)

    def test_unauthenticated_user_cannot_access_insumos(self):
        self.client.force_authenticate(user=None)

        response = self.client.get('/api/inventory/insumos/')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
