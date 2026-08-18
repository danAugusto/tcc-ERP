"""URLs do modulo de preparo."""

from django.urls import path

from .views import CompletePreparoView, NextPreparoView, PreparoQueueView

app_name = 'preparation'

urlpatterns = [
    path('', PreparoQueueView.as_view(), name='preparo_queue'),
    path('next/', NextPreparoView.as_view(), name='preparo_next'),
    path('<int:pk>/complete/', CompletePreparoView.as_view(), name='preparo_complete'),
]