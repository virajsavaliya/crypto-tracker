# backend/core/management/commands/populate_crypto_data.py
# Purpose: One-time command to populate ALL crypto calculation metrics
# Usage: docker-compose exec backend1 python manage.py populate_crypto_data

from django.core.management.base import BaseCommand
from core.tasks import calculate_crypto_metrics_task, fetch_binance_data_task
from core.models import CryptoData
import time

class Command(BaseCommand):
    help = 'Populate crypto data with all calculated metrics (RSI, volumes, spreads, etc.)'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('🚀 Starting crypto data population...'))
        
        # Step 1: Fetch fresh data from Binance
        self.stdout.write('📡 Fetching fresh data from Binance API...')
        fetch_task = fetch_binance_data_task.delay()
        
        # Wait for fetch to complete
        timeout = 60
        start = time.time()
        while not fetch_task.ready() and (time.time() - start) < timeout:
            time.sleep(2)
            self.stdout.write('.', ending='')
        
        if fetch_task.ready():
            self.stdout.write(self.style.SUCCESS(f'\n✅ Fetch completed: {fetch_task.result}'))
        else:
            self.stdout.write(self.style.WARNING('\n⚠️  Fetch timeout, continuing with existing data...'))
        
        # Step 2: Calculate all metrics
        self.stdout.write('\n🧮 Calculating metrics (RSI, volumes, spreads, returns)...')
        calc_task = calculate_crypto_metrics_task.delay()
        
        # Wait for calculation to complete
        start = time.time()
        while not calc_task.ready() and (time.time() - start) < timeout:
            time.sleep(2)
            self.stdout.write('.', ending='')
        
        if calc_task.ready():
            self.stdout.write(self.style.SUCCESS(f'\n✅ Calculation completed: {calc_task.result}'))
        else:
            self.stdout.write(self.style.WARNING('\n⚠️  Calculation timeout, may still be processing...'))
        
        # Step 3: Show sample results
        self.stdout.write('\n📊 Sample calculated data:')
        samples = CryptoData.objects.filter(
            last_price__isnull=False,
            quote_volume_24h__isnull=False
        ).order_by('?')[:3]
        
        for crypto in samples:
            self.stdout.write(f'\n🪙 {crypto.symbol}:')
            self.stdout.write(f'   Last: ${crypto.last_price}')
            self.stdout.write(f'   Bid: ${crypto.bid_price or "N/A"}')
            self.stdout.write(f'   Ask: ${crypto.ask_price or "N/A"}')
            self.stdout.write(f'   Spread: {crypto.spread or "N/A"}')
            self.stdout.write(f'   RSI 1m: {crypto.rsi_1m or "N/A"}')
            self.stdout.write(f'   RSI 3m: {crypto.rsi_3m or "N/A"}')
            self.stdout.write(f'   1m Vol %: {crypto.m1_vol_pct or "N/A"}')
            self.stdout.write(f'   3m Vol %: {crypto.m3_vol_pct or "N/A"}')
            self.stdout.write(f'   1m BV: {crypto.m1_bv or "N/A"}')
            self.stdout.write(f'   1m SV: {crypto.m1_sv or "N/A"}')
            self.stdout.write(f'   1m NV: {crypto.m1_nv or "N/A"}')
        
        # Step 4: Show statistics
        total_symbols = CryptoData.objects.count()
        with_rsi = CryptoData.objects.filter(rsi_1m__isnull=False).count()
        with_volumes = CryptoData.objects.filter(m1_vol_pct__isnull=False).count()
        with_spread = CryptoData.objects.filter(spread__isnull=False).count()
        
        self.stdout.write(self.style.SUCCESS(f'\n📈 Statistics:'))
        self.stdout.write(f'   Total symbols: {total_symbols}')
        self.stdout.write(f'   With RSI data: {with_rsi} ({with_rsi/total_symbols*100:.1f}%)')
        self.stdout.write(f'   With volume data: {with_volumes} ({with_volumes/total_symbols*100:.1f}%)')
        self.stdout.write(f'   With spread data: {with_spread} ({with_spread/total_symbols*100:.1f}%)')
        
        self.stdout.write(self.style.SUCCESS('\n✅ Crypto data population completed!'))
        self.stdout.write(self.style.SUCCESS('💡 Celery Beat will keep data updated automatically every 60 seconds.'))
