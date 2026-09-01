"""Inventory API endpoints."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from .models import Insumo
from .serializers import InsumoSerializer


class InsumoViewSet(ModelViewSet):
    """Provides authenticated CRUD operations for inventory supplies."""

    queryset = Insumo.objects.all()
    serializer_class = InsumoSerializer
    permission_classes = [IsAuthenticated]
