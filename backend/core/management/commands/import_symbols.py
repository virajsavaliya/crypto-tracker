# backend/core/management/commands/import_symbols.py
# Purpose: Chunked import command for large crypto datasets with progress tracking
# Reduces server load: Streaming reads, batched inserts, PostgreSQL COPY, progress logging
# Test: python manage.py import_symbols --file data.csv --chunk-size 1000

import csv
import json
import time
import logging
from decimal import Decimal
from typing import Iterator, List, Dict, Any
from io import StringIO

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction, connection
from django.utils import timezone
from psycopg2.extras import execute_values

from core.models import CryptoData
from core.tasks import calculate_crypto_metrics_task

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Import crypto symbols data from CSV/JSON file with chunked processing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            required=True,
            help='Path to the CSV or JSON file containing crypto data'
        )
        parser.add_argument(
            '--chunk-size',
            type=int,
            default=500,
            help='Number of records to process in each chunk (default: 500)'
        )
        parser.add_argument(
            '--format',
            choices=['csv', 'json'],
            default='csv',
            help='File format (default: csv)'
        )
        parser.add_argument(
            '--use-copy',
            action='store_true',
            help='Use PostgreSQL COPY for faster inserts (PostgreSQL only)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be imported without making changes'
        )

    def handle(self, *args, **options):
        file_path = options['file']
        chunk_size = options['chunk_size']
        file_format = options['format']
        use_copy = options['use_copy']
        dry_run = options['dry_run']

        self.stdout.write(f"Starting import from {file_path}")
        self.stdout.write(f"Chunk size: {chunk_size}")
        self.stdout.write(f"Format: {file_format}")
        self.stdout.write(f"Use COPY: {use_copy}")
        self.stdout.write(f"Dry run: {dry_run}")

        start_time = time.time()
        total_processed = 0
        total_created = 0
        total_updated = 0
        errors = []

        try:
            # Read and process data in chunks
            data_generator = self._read_file_chunked(file_path, file_format, chunk_size)
            
            for chunk_num, chunk_data in enumerate(data_generator, 1):
                self.stdout.write(f"\nProcessing chunk {chunk_num} ({len(chunk_data)} records)...")
                
                if dry_run:
                    self._validate_chunk(chunk_data)
                    total_processed += len(chunk_data)
                    continue
                
                try:
                    if use_copy and connection.vendor == 'postgresql':
                        created, updated = self._bulk_insert_copy(chunk_data)
                    else:
                        created, updated = self._bulk_insert_standard(chunk_data)
                    
                    total_processed += len(chunk_data)
                    total_created += created
                    total_updated += updated
                    
                    self.stdout.write(
                        f"Chunk {chunk_num}: {created} created, {updated} updated"
                    )
                    
                except Exception as e:
                    error_msg = f"Error processing chunk {chunk_num}: {e}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    continue

            # Trigger background metric calculation
            if not dry_run and total_processed > 0:
                self.stdout.write("Triggering background metrics calculation...")
                calculate_crypto_metrics_task.delay()

        except Exception as e:
            raise CommandError(f"Import failed: {e}")

        elapsed_time = time.time() - start_time
        
        self.stdout.write("\n" + "="*50)
        self.stdout.write(f"Import completed in {elapsed_time:.2f} seconds")
        self.stdout.write(f"Total processed: {total_processed}")
        if not dry_run:
            self.stdout.write(f"Total created: {total_created}")
            self.stdout.write(f"Total updated: {total_updated}")
        self.stdout.write(f"Errors: {len(errors)}")
        
        if errors:
            self.stdout.write("\nErrors encountered:")
            for error in errors:
                self.stdout.write(f"  - {error}")

    def _read_file_chunked(self, file_path: str, file_format: str, chunk_size: int) -> Iterator[List[Dict[str, Any]]]:
        """
        Read file in chunks to minimize memory usage
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                if file_format == 'csv':
                    yield from self._read_csv_chunked(file, chunk_size)
                elif file_format == 'json':
                    yield from self._read_json_chunked(file, chunk_size)
        except FileNotFoundError:
            raise CommandError(f"File not found: {file_path}")
        except Exception as e:
            raise CommandError(f"Error reading file: {e}")

    def _read_csv_chunked(self, file, chunk_size: int) -> Iterator[List[Dict[str, Any]]]:
        """
        Read CSV file in chunks
        """
        reader = csv.DictReader(file)
        chunk = []
        
        for row in reader:
            processed_row = self._process_row(row)
            if processed_row:
                chunk.append(processed_row)
                
                if len(chunk) >= chunk_size:
                    yield chunk
                    chunk = []
        
        if chunk:
            yield chunk

    def _read_json_chunked(self, file, chunk_size: int) -> Iterator[List[Dict[str, Any]]]:
        """
        Read JSON file in chunks (assumes array of objects)
        """
        data = json.load(file)
        if not isinstance(data, list):
            raise CommandError("JSON file must contain an array of objects")
        
        for i in range(0, len(data), chunk_size):
            chunk = []
            for item in data[i:i + chunk_size]:
                processed_row = self._process_row(item)
                if processed_row:
                    chunk.append(processed_row)
            
            if chunk:
                yield chunk

    def _process_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process and validate a single row of data
        """
        try:
            # Required fields
            if not row.get('symbol'):
                logger.warning(f"Skipping row without symbol: {row}")
                return None
            
            processed = {
                'symbol': row['symbol'].upper().strip(),
            }
            
            # Numeric fields with conversion
            numeric_fields = [
                'last_price', 'price_change_percent_24h', 'high_price_24h', 'low_price_24h',
                'quote_volume_24h', 'bid_price', 'ask_price', 'spread'
            ]
            
            for field in numeric_fields:
                value = row.get(field)
                if value is not None and value != '':
                    try:
                        processed[field] = Decimal(str(value))
                    except (ValueError, TypeError):
                        logger.warning(f"Invalid {field} value for {row['symbol']}: {value}")
                        processed[field] = None
            
            return processed
            
        except Exception as e:
            logger.error(f"Error processing row {row}: {e}")
            return None

    def _validate_chunk(self, chunk_data: List[Dict[str, Any]]):
        """
        Validate chunk data for dry run
        """
        for item in chunk_data:
            symbol = item.get('symbol')
            if not symbol:
                self.stdout.write(f"  WARNING: Missing symbol in {item}")
                continue
                
            # Check if symbol already exists
            if CryptoData.objects.filter(symbol=symbol).exists():
                self.stdout.write(f"  UPDATE: {symbol}")
            else:
                self.stdout.write(f"  CREATE: {symbol}")

    def _bulk_insert_standard(self, chunk_data: List[Dict[str, Any]]) -> tuple[int, int]:
        """
        Standard bulk insert using Django ORM
        """
        created = 0
        updated = 0
        
        with transaction.atomic():
            for item in chunk_data:
                symbol = item['symbol']
                crypto_data, was_created = CryptoData.objects.get_or_create(
                    symbol=symbol,
                    defaults=item
                )
                
                if was_created:
                    created += 1
                else:
                    # Update existing record
                    for field, value in item.items():
                        if field != 'symbol':
                            setattr(crypto_data, field, value)
                    crypto_data.save()
                    updated += 1
        
        return created, updated

    def _bulk_insert_copy(self, chunk_data: List[Dict[str, Any]]) -> tuple[int, int]:
        """
        Fast bulk insert using PostgreSQL COPY
        """
        if not chunk_data:
            return 0, 0
        
        created = 0
        updated = 0
        
        # Prepare data for COPY
        fields = ['symbol', 'last_price', 'price_change_percent_24h', 'high_price_24h', 
                 'low_price_24h', 'quote_volume_24h', 'bid_price', 'ask_price', 'spread']
        
        copy_data = []
        update_data = []
        
        with transaction.atomic():
            for item in chunk_data:
                symbol = item['symbol']
                
                if CryptoData.objects.filter(symbol=symbol).exists():
                    update_data.append(item)
                else:
                    # Prepare for COPY
                    row = []
                    for field in fields:
                        value = item.get(field)
                        row.append(str(value) if value is not None else '\\N')
                    copy_data.append('\t'.join(row))
            
            # Use COPY for new records
            if copy_data:
                copy_sql = f"""
                COPY core_cryptodata ({', '.join(fields)})
                FROM STDIN WITH (FORMAT text, NULL '\\N', DELIMITER E'\\t')
                """
                
                with connection.cursor() as cursor:
                    cursor.copy_expert(copy_sql, StringIO('\n'.join(copy_data)))
                    created = len(copy_data)
            
            # Update existing records using execute_values
            if update_data:
                update_sql = """
                UPDATE core_cryptodata SET
                    last_price = data.last_price::numeric,
                    price_change_percent_24h = data.price_change_percent_24h::numeric,
                    high_price_24h = data.high_price_24h::numeric,
                    low_price_24h = data.low_price_24h::numeric,
                    quote_volume_24h = data.quote_volume_24h::numeric,
                    bid_price = data.bid_price::numeric,
                    ask_price = data.ask_price::numeric,
                    spread = data.spread::numeric
                FROM (VALUES %s) AS data(symbol, last_price, price_change_percent_24h, 
                      high_price_24h, low_price_24h, quote_volume_24h, bid_price, ask_price, spread)
                WHERE core_cryptodata.symbol = data.symbol
                """
                
                update_values = []
                for item in update_data:
                    values = tuple(item.get(field) for field in fields)
                    update_values.append(values)
                
                with connection.cursor() as cursor:
                    execute_values(cursor, update_sql, update_values, template=None, page_size=100)
                    updated = len(update_values)
        
        return created, updated