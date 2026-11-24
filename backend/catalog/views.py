"""Catalog endpoints."""

from rest_framework.permissions import IsAuthenticated, SAFE_METHODS, BasePermission
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.viewsets import ModelViewSet

from users.permissions import IsEquipe

from .models import Categoria, Produto
from .serializers import CategoriaSerializer, ProdutoSerializer


class IsEquipeOrReadOnly(BasePermission):
    """Permite leitura pública (sem autenticação) para catálogo; escrita exige perfil de equipe/administrador."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and IsEquipe().has_permission(request, view))


class CategoriaViewSet(ModelViewSet):
    """Provides authenticated CRUD operations for catalog categories."""

    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [IsEquipeOrReadOnly]


class ProdutoViewSet(ModelViewSet):
    """Provides authenticated CRUD operations for products."""

    queryset = Produto.objects.select_related('categoria').all()
    serializer_class = ProdutoSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    permission_classes = [IsEquipeOrReadOnly]
