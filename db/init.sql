-- db/init.sql
-- Purpose: Database initialization script for PostgreSQL
-- Creates database and optimized indexes for crypto data

-- Create database only if it doesn't exist
SELECT 'CREATE DATABASE crypto_tracker'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'crypto_tracker')\gexec

\c crypto_tracker;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create optimized indexes after Django migrations
-- These indexes improve query performance for crypto data

-- Index for symbol lookups (most common query)
-- CREATE INDEX IF NOT EXISTS idx_cryptodata_symbol ON core_cryptodata(symbol);
-- 
-- Index for volume-based sorting (used in dashboard)
-- CREATE INDEX IF NOT EXISTS idx_cryptodata_volume ON core_cryptodata(quote_volume_24h DESC);
-- 
-- Index for price change queries
-- CREATE INDEX IF NOT EXISTS idx_cryptodata_price_change ON core_cryptodata(price_change_percent_24h);
-- 
-- Composite index for symbol + volume (optimizes main query)
-- CREATE INDEX IF NOT EXISTS idx_cryptodata_symbol_volume ON core_cryptodata(symbol, quote_volume_24h DESC);
-- 
-- Index for user-related queries
-- CREATE INDEX IF NOT EXISTS idx_user_email ON core_user(email);
-- CREATE INDEX IF NOT EXISTS idx_user_active ON core_user(is_active);
-- CREATE INDEX IF NOT EXISTS idx_user_premium ON core_user(is_premium_user);
-- 
-- Index for favorites
-- CREATE INDEX IF NOT EXISTS idx_favorites_user ON core_favoritecrypto(user_id);
-- CREATE INDEX IF NOT EXISTS idx_favorites_symbol ON core_favoritecrypto(symbol);
-- 
-- Index for alerts
-- CREATE INDEX IF NOT EXISTS idx_alerts_user ON core_alert(user_id);
-- CREATE INDEX IF NOT EXISTS idx_alerts_created ON core_alert(created_at);

-- Note: Indexes are commented out because they should be created after Django migrations
-- Uncomment these after running: docker-compose exec backend1 python manage.py migrate