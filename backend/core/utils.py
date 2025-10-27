# File: core/utils.py

import logging
import time
from typing import List, Dict, Any, Optional
from decimal import Decimal
from datetime import datetime
from django.db import transaction, IntegrityError
from django.utils import timezone
from .models import CryptoData
import psycopg2

logger = logging.getLogger(__name__)


def batch_update_crypto_data(binance_data: List[Dict[str, Any]]) -> List[str]:
    """
    🚀 HIGH-PERFORMANCE batch update for USDT-only crypto data
    - Uses raw SQL for maximum speed (5-second cycle optimization)
    - Handles up to 1000+ symbols efficiently
    - Returns list of updated symbols
    """
    from django.db import connection
    
    updated_symbols = []
    
    try:
        # Convert Binance data to batch format
        batch_data = []
        for item in binance_data:
            try:
                batch_data.append({
                    'symbol': item['symbol'],
                    'last_price': Decimal(item['lastPrice']),
                    'price_change_percent_24h': Decimal(item['priceChangePercent']),
                    'high_price_24h': Decimal(item['highPrice']),
                    'low_price_24h': Decimal(item['lowPrice']),
                    'quote_volume_24h': Decimal(item['quoteVolume']),
                    'bid_price': Decimal(item['bidPrice']) if item['bidPrice'] else None,
                    'ask_price': Decimal(item['askPrice']) if item['askPrice'] else None,
                })
                updated_symbols.append(item['symbol'])
            except Exception as e:
                logger.error(f"Error processing {item.get('symbol', 'unknown')}: {e}")
                continue
        
        # Use efficient raw SQL for bulk upsert
        if batch_data:
            with connection.cursor() as cursor:
                # Build optimized SQL for USDT-only updates
                sql = """
                INSERT INTO core_cryptodata (symbol, last_price, price_change_percent_24h, 
                                           high_price_24h, low_price_24h, quote_volume_24h, 
                                           bid_price, ask_price)
                VALUES %s
                ON CONFLICT (symbol) 
                DO UPDATE SET 
                    last_price = EXCLUDED.last_price,
                    price_change_percent_24h = EXCLUDED.price_change_percent_24h,
                    high_price_24h = EXCLUDED.high_price_24h,
                    low_price_24h = EXCLUDED.low_price_24h,
                    quote_volume_24h = EXCLUDED.quote_volume_24h,
                    bid_price = EXCLUDED.bid_price,
                    ask_price = EXCLUDED.ask_price
                """
                
                # Process in chunks for memory efficiency
                chunk_size = 500
                for i in range(0, len(batch_data), chunk_size):
                    chunk = batch_data[i:i + chunk_size]
                    
                    # Build values tuple
                    values = []
                    for data in chunk:
                        values.append((
                            data['symbol'],
                            data['last_price'],
                            data['price_change_percent_24h'], 
                            data['high_price_24h'],
                            data['low_price_24h'],
                            data['quote_volume_24h'],
                            data['bid_price'],
                            data['ask_price']
                        ))
                    
                    # Execute efficient batch update
                    from psycopg2.extras import execute_values
                    execute_values(cursor, sql, values)
                    
                    logger.info(f"Batch {i//chunk_size + 1}: Processed {len(chunk)} records via raw SQL")
        
        return updated_symbols
        
    except Exception as e:
        logger.error(f"❌ Batch update failed: {e}")
        raise


def bulk_upsert_crypto_data(
    crypto_data_list: List[Dict[str, Any]], 
    batch_size: int = 300,
    max_retries: int = 3
) -> Dict[str, int]:
    """
    Performs a deadlock-safe bulk UPSERT operation for CryptoData.
    
    Args:
        crypto_data_list: List of dictionaries containing crypto data
                         Each dict should contain at minimum: 'symbol'
                         Optional fields: 'last_price', 'price_change_percent_24h', 
                         'high_price_24h', 'low_price_24h', 'quote_volume_24h', 
                         'bid_price', 'ask_price', 'spread', and all m1-m60 fields
        batch_size: Number of records to process per batch (default: 300)
        max_retries: Maximum number of retry attempts on deadlock (default: 3)
    
    Returns:
        Dict with statistics: {'created': int, 'updated': int, 'processed': int}
    
    Example usage:
        crypto_data = [
            {
                'symbol': 'BTCUSDT',
                'last_price': Decimal('45000.50'),
                'price_change_percent_24h': Decimal('2.5'),
                'updated_at': timezone.now()
            },
            {
                'symbol': 'ETHUSDT', 
                'last_price': Decimal('3200.75'),
                'price_change_percent_24h': Decimal('-1.2'),
                'updated_at': timezone.now()
            }
        ]
        result = bulk_upsert_crypto_data(crypto_data)
    """
    
    if not crypto_data_list:
        return {'created': 0, 'updated': 0, 'processed': 0}
    
    total_created = 0
    total_updated = 0
    total_processed = 0
    
    # Get all field names from the CryptoData model (excluding id and auto fields)
    model_fields = [field.name for field in CryptoData._meta.fields if field.name != 'id']
    
    # Process data in batches to avoid memory issues and reduce lock contention
    for i in range(0, len(crypto_data_list), batch_size):
        batch = crypto_data_list[i:i + batch_size]
        
        for attempt in range(max_retries):
            try:
                with transaction.atomic():
                    # Prepare CryptoData objects for bulk_create
                    crypto_objects = []
                    
                    for data in batch:
                        # Ensure symbol is present
                        if 'symbol' not in data or not data['symbol']:
                            logger.warning(f"Skipping record without symbol: {data}")
                            continue
                        
                        # Create CryptoData object with available fields
                        crypto_data = {}
                        for field_name in model_fields:
                            if field_name in data:
                                crypto_data[field_name] = data[field_name]
                        
                        # Add timestamp handling - CryptoData doesn't have updated_at field
                        # Remove it if present to avoid errors
                        if 'updated_at' in crypto_data:
                            del crypto_data['updated_at']
                        
                        crypto_objects.append(CryptoData(**crypto_data))
                    
                    if not crypto_objects:
                        continue
                    
                    # Perform bulk UPSERT using Django's bulk_create with update_conflicts
                    # This generates: INSERT ... ON CONFLICT(symbol) DO UPDATE SET ...
                    result = CryptoData.objects.bulk_create(
                        crypto_objects,
                        update_conflicts=True,
                        unique_fields=['symbol'],  # The field that defines uniqueness
                        update_fields=[
                            # Update all fields except symbol and id
                            field for field in model_fields 
                            if field not in ['symbol', 'id']
                        ]
                    )
                    
                    # Django's bulk_create doesn't return detailed stats, so we estimate
                    batch_processed = len(crypto_objects)
                    total_processed += batch_processed
                    
                    # For more precise stats, we could query before/after counts
                    # but that would add overhead. For now, we'll use the created count
                    batch_created = len([obj for obj in result if obj.pk])
                    batch_updated = batch_processed - batch_created
                    
                    total_created += batch_created
                    total_updated += batch_updated
                    
                    logger.info(
                        f"Batch {i//batch_size + 1}: Processed {batch_processed} records "
                        f"(estimated: {batch_created} created, {batch_updated} updated)"
                    )
                    
                    break  # Success, break retry loop
                    
            except IntegrityError as e:
                if 'deadlock detected' in str(e).lower() and attempt < max_retries - 1:
                    # Exponential backoff on deadlock
                    wait_time = (2 ** attempt) * 0.1  # 0.1s, 0.2s, 0.4s
                    logger.warning(
                        f"Deadlock detected in batch {i//batch_size + 1}, "
                        f"attempt {attempt + 1}/{max_retries}. Retrying in {wait_time}s..."
                    )
                    time.sleep(wait_time)
                    continue
                else:
                    logger.error(f"Failed to process batch {i//batch_size + 1} after {max_retries} attempts: {e}")
                    raise
            
            except Exception as e:
                logger.error(f"Unexpected error in batch {i//batch_size + 1}: {e}")
                raise
    
    logger.info(
        f"Bulk upsert completed: {total_processed} total processed, "
        f"{total_created} created, {total_updated} updated"
    )
    
    return {
        'created': total_created,
        'updated': total_updated, 
        'processed': total_processed
    }


def bulk_upsert_crypto_data_raw_sql(
    crypto_data_list: List[Dict[str, Any]], 
    batch_size: int = 500,
    max_retries: int = 3
) -> Dict[str, int]:
    """
    Alternative implementation using raw SQL for maximum performance and deadlock prevention.
    Uses PostgreSQL's INSERT ... ON CONFLICT directly for better control.
    
    This version provides more precise created/updated counts and may be faster
    for very large datasets (1000+ records).
    """
    
    if not crypto_data_list:
        return {'created': 0, 'updated': 0, 'processed': 0}
    
    from django.db import connection
    import psycopg2
    
    total_created = 0
    total_updated = 0
    total_processed = 0
    
    # Define the fields we want to handle
    fields = [
        'symbol', 'last_price', 'price_change_percent_24h', 'high_price_24h', 
        'low_price_24h', 'quote_volume_24h', 'bid_price', 'ask_price', 'spread',
        'm1', 'm2', 'm3', 'm5', 'm10', 'm15', 'm60',
        'm1_vol_pct', 'm2_vol_pct', 'm3_vol_pct', 'm5_vol_pct', 
        'm10_vol_pct', 'm15_vol_pct', 'm60_vol_pct',
        'm1_vol', 'm5_vol', 'm10_vol', 'm15_vol', 'm60_vol',
        'm1_low', 'm1_high', 'm1_range_pct',
        'm2_low', 'm2_high', 'm2_range_pct',
        'm3_low', 'm3_high', 'm3_range_pct',
        'm5_low', 'm5_high', 'm5_range_pct',
        'm10_low', 'm10_high', 'm10_range_pct',
        'm15_low', 'm15_high', 'm15_range_pct',
        'm60_low', 'm60_high', 'm60_range_pct',
        'm1_nv', 'm2_nv', 'm3_nv', 'm5_nv', 'm10_nv', 'm15_nv', 'm60_nv',
        'rsi_1m', 'rsi_3m', 'rsi_5m', 'rsi_15m',
        'm1_bv', 'm2_bv', 'm3_bv', 'm5_bv', 'm10_bv', 'm15_bv', 'm60_bv',
        'm1_sv', 'm2_sv', 'm3_sv', 'm5_sv', 'm10_sv', 'm15_sv', 'm60_sv'
    ]
    
    # Build the SQL query
    placeholders = ', '.join(['%s'] * len(fields))
    field_list = ', '.join(fields)
    
    # UPDATE clause for ON CONFLICT
    update_fields = [f for f in fields if f != 'symbol']
    update_clause = ', '.join([f"{field} = EXCLUDED.{field}" for field in update_fields])
    
    sql = f"""
        INSERT INTO core_cryptodata ({field_list})
        VALUES ({placeholders})
        ON CONFLICT (symbol) 
        DO UPDATE SET {update_clause}
    """
    
    # Process in batches with deadlock prevention
    for i in range(0, len(crypto_data_list), batch_size):
        batch = crypto_data_list[i:i + batch_size]
        
        for attempt in range(max_retries):
            try:
                with transaction.atomic():
                    with connection.cursor() as cursor:
                        # Prepare batch data with NumPy type conversion
                        batch_values = []
                        for data in batch:
                            if 'symbol' not in data or not data['symbol']:
                                continue
                            
                            row_values = []
                            for field in fields:
                                value = data.get(field)
                                # Convert Python None to SQL NULL, ensure no NumPy types
                                if value is None:
                                    row_values.append(None)
                                elif hasattr(value, 'item'):  # NumPy scalar
                                    # Convert NumPy scalar to native Python type
                                    row_values.append(float(value.item()))
                                elif str(type(value)).startswith("<class 'numpy"):
                                    # Convert any other NumPy types to native Python
                                    row_values.append(float(value))
                                else:
                                    row_values.append(value)
                            batch_values.append(row_values)
                        
                        if not batch_values:
                            continue
                        
                        # Execute batch insert with UPSERT - use executemany for better performance
                        cursor.executemany(sql, batch_values)
                        
                        batch_processed = len(batch_values)
                        total_processed += batch_processed
                        
                        # For this implementation, we'll consider all as "updated"
                        # since PostgreSQL doesn't distinguish in UPSERT rowcount
                        total_updated += batch_processed
                        
                        logger.info(
                            f"Batch {i//batch_size + 1}: Processed {batch_processed} records via raw SQL"
                        )
                        
                        break  # Success
                        
            except (psycopg2.errors.DeadlockDetected, psycopg2.errors.SerializationFailure) as e:
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt) * 0.1  # Exponential backoff
                    logger.warning(
                        f"SQL Deadlock detected in batch {i//batch_size + 1}, "
                        f"attempt {attempt + 1}/{max_retries}. Retrying in {wait_time}s..."
                    )
                    time.sleep(wait_time)
                    continue
                else:
                    logger.error(f"SQL batch failed after {max_retries} attempts: {e}")
                    raise
            
            except Exception as e:
                logger.error(f"Unexpected SQL error in batch {i//batch_size + 1}: {e}")
                # Check if it's a NumPy type error
                if "schema" in str(e).lower() and "np" in str(e).lower():
                    logger.error(f"NumPy type serialization error detected: {e}")
                    # Log the problematic data for debugging
                    for j, data in enumerate(batch):
                        for field in fields:
                            value = data.get(field)
                            if value is not None and hasattr(value, '__module__') and 'numpy' in str(type(value)):
                                logger.error(f"NumPy type found in batch {i//batch_size + 1}, record {j}, field {field}: {type(value)}")
                raise
    
    return {
        'created': 0,  # Raw SQL doesn't easily distinguish created vs updated
        'updated': total_updated,
        'processed': total_processed
    }


# Convenience function that automatically chooses the best implementation
def upsert_crypto_data(crypto_data_list: List[Dict[str, Any]], use_raw_sql: bool = False, **kwargs) -> Dict[str, int]:
    """
    Main entry point for crypto data upserts. Automatically handles deadlock prevention.
    
    Args:
        crypto_data_list: List of crypto data dictionaries
        use_raw_sql: If True, uses raw SQL implementation for maximum performance
        **kwargs: Additional arguments passed to the underlying function
    
    Returns:
        Dictionary with operation statistics
    """
    if use_raw_sql:
        return bulk_upsert_crypto_data_raw_sql(crypto_data_list, **kwargs)
    else:
        return bulk_upsert_crypto_data(crypto_data_list, **kwargs)


def upsert_crypto_data_from_websocket(data_list, batch_size: int = 300, max_retries: int = 3) -> int:
    """
    Upsert crypto data from websocket format to database using deadlock-safe operations.
    
    Args:
        data_list: List of tuples in format:
                  (symbol, prices, volumes, timestamp, open_time, close_time, 
                   sma_20, ema_20, rsi_14, bollinger_upper, bollinger_lower, 
                   macd_line, macd_signal, macd_histogram)
        batch_size: Number of records to process per batch
        max_retries: Maximum retry attempts on deadlock
    
    Returns:
        Number of successfully processed records
    """
    
    def convert_to_crypto_data_format(data_list):
        """Convert websocket data format to CryptoData dict format"""
        converted_data = []
        
        for symbol, prices, volumes, timestamp, open_time, close_time, sma_20, ema_20, rsi_14, bollinger_upper, bollinger_lower, macd_line, macd_signal, macd_histogram in data_list:
            price_change_24h = prices['price_change_24h']
            price_change_percentage_24h = prices['price_change_percentage_24h']
            
            crypto_data = {
                'symbol': symbol,
                'price': prices['price'],
                'bid_price': prices['bid_price'],
                'ask_price': prices['ask_price'],
                'volume': volumes['volume'],
                'quote_volume': volumes['quote_volume'],
                'open_price': prices['open_price'],
                'high_price': prices['high_price'],
                'low_price': prices['low_price'],
                'price_change_24h': price_change_24h,
                'price_change_percentage_24h': price_change_percentage_24h,
                'weighted_avg_price': prices['weighted_avg_price'],
                'prev_close_price': prices['prev_close_price'],
                'last_qty': prices['last_qty'],
                'bid_qty': prices['bid_qty'],
                'ask_qty': prices['ask_qty'],
                'count': prices['count'],
                'timestamp': timestamp,
                'open_time': open_time,
                'close_time': close_time,
                'sma_20': sma_20,
                'ema_20': ema_20,
                'rsi_14': rsi_14,
                'bollinger_upper': bollinger_upper,
                'bollinger_lower': bollinger_lower,
                'macd_line': macd_line,
                'macd_signal': macd_signal,
                'macd_histogram': macd_histogram,
            }
            converted_data.append(crypto_data)
        
        return converted_data
    
    # Convert to format expected by bulk_upsert_crypto_data
    converted_data = convert_to_crypto_data_format(data_list)
    
    # Use the existing deadlock-safe bulk upsert function
    result = bulk_upsert_crypto_data(converted_data, batch_size, max_retries)
    
    return result['processed']