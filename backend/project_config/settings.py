from pathlib import Path
import os
import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(os.path.join(BASE_DIR, '.env'))

# --- SECURITY SETTINGS ---
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-here')
DEBUG = os.environ.get('DEBUG', 'False') == 'True'

# Get hostnames from environment variables for production
BACKEND_HOSTNAME = os.environ.get('BACKEND_HOSTNAME')
FRONTEND_URL = os.environ.get('FRONTEND_URL')

# Add your backend hostname to ALLOWED_HOSTS
ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'backend1', 'backend2', 'backend', 'volusignal.com', 'www.volusignal.com', 'api.volusignal.com', '46.62.216.158']
if BACKEND_HOSTNAME:
    ALLOWED_HOSTS.append(BACKEND_HOSTNAME)
if os.environ.get('ALLOWED_HOSTS'):
    ALLOWED_HOSTS.extend(os.environ.get('ALLOWED_HOSTS').split(','))

# --- PRODUCTION SECURITY SETTINGS ---
# Only enable these security features in production (when DEBUG is False)
if not DEBUG:
    # HTTPS/SSL settings
    SECURE_SSL_REDIRECT = False  # Nginx handles SSL redirect
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    
    # Cookie security
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    CSRF_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    CSRF_COOKIE_SAMESITE = 'Lax'
    
    # Security headers (some handled by Nginx, but good to have as backup)
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    
    # HSTS (Strict Transport Security) - be careful with this in production
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# --- APPLICATION DEFINITION ---
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',  # Enable for local development
    'rest_framework',
    'rest_framework.authtoken',
    'django_celery_beat',  # Celery Beat scheduler for periodic tasks
    'core',
    'channels',
]

# --- MIDDLEWARE (Corrected Order) ---
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Enable for local development
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# --- CORS SETTINGS (Enable for local development) ---
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8080",  # Nginx load balancer
]
if FRONTEND_URL:
    CORS_ALLOWED_ORIGINS.append(FRONTEND_URL)
if os.environ.get('CORS_ALLOWED_ORIGINS'):
    CORS_ALLOWED_ORIGINS.extend(os.environ.get('CORS_ALLOWED_ORIGINS').split(','))

CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8080",
    "http://46.62.216.158:3000",
    "http://46.62.216.158:8080",
    "http://volusignal.com",
    "http://www.volusignal.com",
    "https://volusignal.com",
    "https://www.volusignal.com",
]
if FRONTEND_URL:
    CSRF_TRUSTED_ORIGINS.append(FRONTEND_URL)

# --- URLS, TEMPLATES, and APPLICATIONS ---
ROOT_URLCONF = 'project_config.urls'
WSGI_APPLICATION = 'project_config.wsgi.application'
ASGI_APPLICATION = 'project_config.asgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# --- DATABASE with Connection Pooling (Optimized for 2 Core + 4GB RAM) ---
if 'DATABASE_URL' in os.environ:
    DATABASES = {
        'default': dj_database_url.config(
            conn_max_age=300,
            conn_health_checks=True,
            ssl_require=False  # Always disable SSL for local development
        )
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv("DB_NAME", "crypto_tracker"),
            'USER': os.getenv("DB_USER", "postgres"),
            'PASSWORD': os.getenv("DB_PASSWORD", "postgres"),
            'HOST': os.getenv("DB_HOST", "localhost"),
            'PORT': os.getenv("DB_PORT", "5432"),
            'CONN_MAX_AGE': 300,
            'CONN_HEALTH_CHECKS': True,
        }
    }

# --- CACHING with Redis (Optimized with retry logic for stability) ---
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': os.environ.get('REDIS_URL', 'redis://localhost:6379/0'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'CONNECTION_POOL_KWARGS': {
                'max_connections': 25,
                'retry_on_timeout': True,
                'socket_connect_timeout': 5,
                'socket_timeout': 5,
                'health_check_interval': 10,
            },
            'COMPRESSOR': 'django_redis.compressors.zlib.ZlibCompressor',
            'SERIALIZER': 'django_redis.serializers.json.JSONSerializer',
            'IGNORE_EXCEPTIONS': True,  # Don't crash on Redis errors
        },
        'TIMEOUT': 600,  # 10 minutes cache timeout
        'KEY_PREFIX': 'crypto_tracker',
    }
}

# --- CELERY CONFIGURATION (Optimized for 2 Core + 4GB RAM) ---
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/1')
CELERY_RESULT_BACKEND = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TIMEZONE = 'UTC'
CELERY_ENABLE_UTC = True
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 300  # 5 minutes
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_WORKER_MAX_TASKS_PER_CHILD = 100  # Recycle workers after 100 tasks

# Fix Celery 6.0 deprecation warning
CELERY_BROKER_CONNECTION_RETRY = True
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True

CELERY_BEAT_SCHEDULE = {
    'poll-telegram-updates': {
        'task': 'core.tasks.poll_telegram_updates_task',
        'schedule': 10,  # Run every 10 seconds - check for new Telegram messages
    },
    'calculate-crypto-metrics': {
        'task': 'core.tasks.calculate_crypto_metrics_task',
        'schedule': 60,  # Run every minute for real-time updates
    },
    'process-price-alerts': {
        'task': 'core.tasks.process_price_alerts_task',
        'schedule': 60,  # Run every minute - check price, volume, pump, dump alerts
    },
    'process-rsi-alerts': {
        'task': 'core.tasks.process_rsi_alerts_task',
        'schedule': 60,  # Run every minute - check RSI overbought/oversold alerts
    },
    # DISABLED: 'fetch-all-binance-symbols' - We only want USDT symbols
    # 'fetch-all-binance-symbols': {
    #     'task': 'core.tasks.fetch_all_binance_symbols_task',
    #     'schedule': 1800,  # Run every 30 minutes for all symbols
    # },
}

# --- CHANNELS (Optimized with retry logic for stability) ---
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": { 
            "hosts": [{
                "address": os.environ.get('REDIS_URL', 'redis://localhost:6379'),
                "retry_on_timeout": True,
                "socket_connect_timeout": 30,
                "socket_timeout": 30,
                "health_check_interval": 30,
            }],
            "capacity": 1000,
            "expiry": 60,
            "group_expiry": 120,
        },
    },
}

# --- LOGGING CONFIGURATION ---
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True,
        },
        'core': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}

# Add file logging only in non-Docker environments
if not os.getenv('DOCKER_ENV'):
    logs_dir = os.path.join(BASE_DIR, 'logs')
    if not os.path.exists(logs_dir):
        os.makedirs(logs_dir)
    
    LOGGING['handlers']['file'] = {
        'level': 'INFO',
        'class': 'logging.FileHandler',
        'filename': os.path.join(logs_dir, 'django.log'),
        'formatter': 'verbose',
    }
    LOGGING['loggers']['django']['handlers'].append('file')
    LOGGING['loggers']['core']['handlers'].append('file')

# --- REST FRAMEWORK and AUTHENTICATION ---
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework_simplejwt.authentication.JWTAuthentication'],
    # Convert Decimal fields to float instead of string to prevent "0E-10" string issues in frontend
    'COERCE_DECIMAL_TO_STRING': False,
}

# --- JWT CONFIGURATION (15-minute session timeout) ---
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),  # Session timeout after 15 minutes of inactivity
    'REFRESH_TOKEN_LIFETIME': timedelta(minutes=30),  # Refresh token expires after 30 minutes
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
AUTH_USER_MODEL = 'core.User'

# --- INTERNATIONALIZATION and STATIC FILES ---
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --- EMAIL and STRIPE CONFIGURATION ---
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER)
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET')

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_BOT_USERNAME = os.environ.get('TELEGRAM_BOT_USERNAME', '')

# Backend URL (for webhooks and API references)
BACKEND_URL = os.environ.get('BACKEND_URL', 'http://localhost:8080')