import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth.models import AnonymousUser
from core.models import User

@database_sync_to_async
def get_user(token_key):
    try:
        token = AccessToken(token_key)
        user_id = token['user_id']
        return User.objects.get(id=user_id)
    except Exception:
        return AnonymousUser()

class CryptoConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = AnonymousUser()
        self.room_group_name = None
        
        try:
            token = self.scope['query_string'].decode().split('=')[1]
            self.user = await get_user(token)
        except (IndexError, UnicodeDecodeError):
            pass

        # Only allow enterprise users to connect to the WebSocket
        if self.user.is_authenticated and self.user.subscription_plan == 'enterprise':
            self.room_group_name = 'crypto_enterprise'
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            await self.accept()
        else:
            await self.close()

    async def disconnect(self, close_code):
        if self.room_group_name:
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def crypto_update(self, event):
        await self.send(text_data=json.dumps(event['data']))