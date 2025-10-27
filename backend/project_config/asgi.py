import os
from django.core.asgi import get_asgi_application

# First, set the default settings module for the 'daphne' command.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project_config.settings')

# This must be called before importing anything else from Django.
django_asgi_app = get_asgi_application()

# Now it's safe to import your routing and other components.
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from channels.security.websocket import AllowedHostsOriginValidator
import core.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    # Wrap websocket handling with origin + auth middleware.
    "websocket": AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter(core.routing.websocket_urlpatterns)
        )
    ),
})