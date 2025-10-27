# Generated migration for adding plan date fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0009_alert_is_active_alert_last_triggered_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='plan_start_date',
            field=models.DateTimeField(blank=True, help_text='Date when current plan started', null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='plan_end_date',
            field=models.DateTimeField(blank=True, help_text='Date when current plan expires', null=True),
        ),
    ]
