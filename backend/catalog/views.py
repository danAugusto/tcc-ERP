"""Views do catalogo."""

from rest_framework import generics

from .models import Product
from .serializers import ProductSerializer


class ProductListCreateView(generics.ListCreateAPIView):
    """Lista ou cria produtos do cardapio."""

    serializer_class = ProductSerializer
    queryset = Product.objects.all()


class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Consulta, altera ou exclui um produto."""

    serializer_class = ProductSerializer
    queryset = Product.objects.all()