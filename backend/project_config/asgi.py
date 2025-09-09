import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
import core.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project_config.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": URLRouter(
            core.routing.websocket_urlpatterns
        )
})