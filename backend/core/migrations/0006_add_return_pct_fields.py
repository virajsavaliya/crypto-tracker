# backend/core/migrations/0006_add_return_pct_fields.py
# Purpose: Add missing Return % (R%) fields to CryptoData model
# These fields show price change percentage for different timeframes

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_add_usdt_indexes'),
    ]

    operations = [
        # Add Return % fields for all timeframes
        migrations.AddField(
            model_name='cryptodata',
            name='m1_r_pct',
            field=models.DecimalField(blank=True, decimal_places=10, max_digits=20, null=True, help_text='1 minute return percentage'),
        ),
        migrations.AddField(
            model_name='cryptodata',
            name='m2_r_pct',
            field=models.DecimalField(blank=True, decimal_places=10, max_digits=20, null=True, help_text='2 minute return percentage'),
        ),
        migrations.AddField(
            model_name='cryptodata',
            name='m3_r_pct',
            field=models.DecimalField(blank=True, decimal_places=10, max_digits=20, null=True, help_text='3 minute return percentage'),
        ),
        migrations.AddField(
            model_name='cryptodata',
            name='m5_r_pct',
            field=models.DecimalField(blank=True, decimal_places=10, max_digits=20, null=True, help_text='5 minute return percentage'),
        ),
        migrations.AddField(
            model_name='cryptodata',
            name='m10_r_pct',
            field=models.DecimalField(blank=True, decimal_places=10, max_digits=20, null=True, help_text='10 minute return percentage'),
        ),
        migrations.AddField(
            model_name='cryptodata',
            name='m15_r_pct',
            field=models.DecimalField(blank=True, decimal_places=10, max_digits=20, null=True, help_text='15 minute return percentage'),
        ),
        migrations.AddField(
            model_name='cryptodata',
            name='m60_r_pct',
            field=models.DecimalField(blank=True, decimal_places=10, max_digits=20, null=True, help_text='60 minute return percentage'),
        ),
    ]
