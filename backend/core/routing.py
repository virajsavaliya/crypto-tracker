from django.urls import re_path
from . import consumers

# Allow both /ws/crypto and /ws/crypto/ by making the trailing slash optional.
websocket_urlpatterns = [
    re_path(r'^ws/crypto/?$', consumers.CryptoConsumer.as_asgi()),
]