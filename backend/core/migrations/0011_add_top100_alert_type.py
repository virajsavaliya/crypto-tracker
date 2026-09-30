# Generated migration for adding top_100 alert type

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0010_add_plan_dates'),
    ]

    operations = [
        # No actual schema change needed - just updating the choices
        # The alert_type field already exists as CharField
        # This migration documents the addition of the new choice
        migrations.AlterField(
            model_name='alert',
            name='alert_type',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('price_movement', 'Price Movement'),
                    ('volume_change', 'Volume Change'),
                    ('new_coin_listing', 'New Coin Listing'),
                    ('rsi_overbought', 'RSI Overbought (>70)'),
                    ('rsi_oversold', 'RSI Oversold (<30)'),
                    ('pump_alert', 'Pump Alert (>5% in 1m)'),
                    ('dump_alert', 'Dump Alert (<-5% in 1m)'),
                    ('top_100', 'Top 100 Coins Alert'),
                ]
            ),
        ),
    ]
