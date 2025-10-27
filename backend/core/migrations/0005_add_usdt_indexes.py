# Generated migration file for optimizing USDT queries
# backend/core/migrations/0002_add_usdt_indexes.py

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_alter_user_mobile_number'),
    ]

    operations = [
        # Add index on symbol field for faster USDT filtering
        migrations.AddIndex(
            model_name='cryptodata',
            index=models.Index(fields=['symbol'], name='core_crypto_symbol_idx'),
        ),
        # Add composite index for common query patterns
        migrations.AddIndex(
            model_name='cryptodata',
            index=models.Index(fields=['symbol', 'quote_volume_24h'], name='core_crypto_symbol_vol_idx'),
        ),
        # Add index for volume filtering
        migrations.AddIndex(
            model_name='cryptodata',
            index=models.Index(fields=['quote_volume_24h'], name='core_crypto_volume_idx'),
        ),
        # Add index for last_price queries
        migrations.AddIndex(
            model_name='cryptodata',
            index=models.Index(fields=['last_price'], name='core_crypto_price_idx'),
        ),
    ]
