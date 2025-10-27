import json
import asyncio
import time
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth.models import AnonymousUser
from core.models import User, CryptoData
from core.serializers import (
    CryptoDataSerializer,
    CryptoDataBasicSerializer,
    CryptoDataFreeSerializer,
)

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

        # Extract token from query string if provided (?token=...)
        try:
            raw_qs = self.scope.get('query_string', b'').decode()
            # Debug log (remove later): scope path & query string
            if raw_qs.startswith('token='):
                token = raw_qs.split('token=')[1].split('&')[0]
                self.user = await get_user(token)
        except Exception:  # Broad except is fine here; fallback to AnonymousUser
            pass

        # Determine group based on subscription plan. Align with broadcaster groups.
        if self.user.is_authenticated:
            plan = getattr(self.user, 'subscription_plan', 'free') or 'free'
        else:
            plan = 'free'

        plan_to_group = {
            'free': 'crypto_free',
            'basic': 'crypto_premium',  # Assuming basic maps to premium data tier
            'enterprise': 'crypto_enterprise'
        }
        self.room_group_name = plan_to_group.get(plan, 'crypto_free')

        # Always allow connection; authorization can be further enforced in data payload if needed
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        user_id = getattr(self.user, 'id', None)
        user_plan = getattr(self.user, 'subscription_plan', 'free')
        is_auth = bool(getattr(self.user, 'is_authenticated', False))
        # Send an immediate ack so the client can confirm handshake and auth status.
        await self.send(text_data=json.dumps({
            "type": "ws_ack",
            "group": self.room_group_name,
            "plan": user_plan,
            "is_authenticated": is_auth,
            "reason": None if is_auth else "unauthorized"
        }))
        # Start heartbeat pings (every 20s) so we can see if connection silently dies.
        try:
            loop = asyncio.get_running_loop()
            self.heartbeat_task = loop.create_task(self._heartbeat())
        except RuntimeError:
            self.heartbeat_task = None

    async def disconnect(self, close_code):
        if self.room_group_name:
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
        if hasattr(self, 'heartbeat_task') and self.heartbeat_task:
            self.heartbeat_task.cancel()

    async def crypto_update(self, event):
        # Send data to client; event['data'] expected to be JSON-serializable list or dict
        try:
            # Wrap as delta for clients that understand types; legacy clients still accept arrays
            payload = event.get('data')
            if isinstance(payload, (list, dict)):
                await self.send(text_data=json.dumps({"type": "delta", "data": payload}))
            else:
                await self.send(text_data=json.dumps(payload))
        except Exception:
            # Fallback to raw payload
            await self.send(text_data=json.dumps(event['data']))

    async def receive(self, text_data=None, bytes_data=None):
        """Handle incoming messages from clients (e.g., request full snapshot)."""
        if not text_data:
            return
        try:
            message = json.loads(text_data)
        except Exception:
            return

        msg_type = message.get('type')
        if msg_type == 'request_snapshot':
            sort_by = message.get('sort_by', 'profit')
            sort_order = message.get('sort_order', 'desc')
            # Determine sorting field similar to REST view
            sort_field = '-price_change_percent_24h'
            if sort_by == 'volume':
                sort_field = '-quote_volume_24h'
            elif sort_by == 'latest':
                sort_field = '-id'
            elif sort_by == 'price':
                sort_field = '-last_price'
            # Apply sort order
            if sort_order == 'asc':
                sort_field = sort_field.lstrip('-')

            # Determine serializer based on plan
            if getattr(self.user, 'subscription_plan', 'free') == 'enterprise':
                serializer_class = CryptoDataSerializer
            elif getattr(self.user, 'subscription_plan', 'free') == 'basic':
                serializer_class = CryptoDataBasicSerializer
            else:
                serializer_class = CryptoDataFreeSerializer

            # Chunk and send snapshot to avoid giant frames
            page_size = int(message.get('page_size') or 500)
            total_count = await database_sync_to_async(CryptoData.objects.count)()
            total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 1

            for page in range(total_pages):
                offset = page * page_size
                data_chunk = await self._get_snapshot_chunk(serializer_class, sort_field, offset, page_size)
                await self.send(text_data=json.dumps({
                    'type': 'snapshot',
                    'chunk': page + 1,
                    'total_chunks': total_pages,
                    'total_count': total_count,
                    'data': data_chunk,
                }))

    @database_sync_to_async
    def _get_snapshot_chunk(self, serializer_class, sort_field: str, offset: int, limit: int):
        qs = CryptoData.objects.all().order_by(sort_field)[offset:offset + limit]
        return serializer_class(qs, many=True).data

    async def _heartbeat(self):
        try:
            while True:
                await asyncio.sleep(10)  # ⚡ Faster: 20s → 10s for more responsive updates
                try:
                    await self.send(text_data=json.dumps({"type": "heartbeat", "ts": time.time()}))
                except Exception as e:
                    break
        except Exception as e:
            pass