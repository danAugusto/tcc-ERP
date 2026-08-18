from rest_framework import generics
from rest_framework.permissions import AllowAny

from .serializers import MeSerializer, RegisterSerializer


class RegisterView(generics.CreateAPIView):
    """Creates an account for an ERP user."""

    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class MeView(generics.RetrieveAPIView):
    """Returns the authenticated user and its access profile."""

    serializer_class = MeSerializer

    def get_object(self):
        return self.request.user
