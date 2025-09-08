from pathlib import Path
import os
import dj_database_url
from dotenv import load_dotenv # Add this import

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file for local development
load_dotenv(os.path.join(BASE_DIR, '.env'))

# --- SECURITY SETTINGS ---
# Load secrets from environment variables
SECRET_KEY = os.environ.get('SECRET_KEY')

# DEBUG should be False in production, and True only for local development
DEBUG = os.environ.get('DEBUG', 'False') == 'True'

# Add your live frontend and backend URLs here for security
ALLOWED_HOSTS = [
    'backend-production-b798.up.railway.app',  # Your backend URL
    'crypto-tracker-v1.up.railway.app',      # Your frontend URL
    'localhost',
    '127.0.0.1',
]


# --- APPLICATION DEFINITION ---
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework.authtoken',
    'core',
    'channels',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware', # Handles cross-origin requests
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# --- CORS SETTINGS ---
# This allows your frontend to make requests to your backend
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.up\.railway\.app$",
    r"^http://localhost:3000$",
]
CORS_ALLOW_CREDENTIALS = True


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

# --- DATABASE CONFIGURATION ---
# Use Railway's DATABASE_URL in production, but fall back to local settings for development
if 'DATABASE_URL' in os.environ:
    DATABASES = {
        'default': dj_database_url.config(conn_max_age=600, ssl_require=False)
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv("DB_NAME"),
            'USER': os.getenv("DB_USER"),
            'PASSWORD': os.getenv("DB_PASSWORD"),
            'CONN_MAX_AGE': 60,   # keep connection alive & auto-reconnect every 60s
            'HOST': os.getenv("DB_HOST"),
            'PORT': os.getenv("DB_PORT"),
        }
    }
    # DATABASES = {
    #     'default': {
    #         'ENGINE': 'django.db.backends.postgresql',
    #         'NAME': 'binance',
    #         'USER': 'postgres',
    #         'PASSWORD': '',
    #         'HOST': 'localhost',
    #         'PORT': '5432',
    #     }
    # }


# --- REST FRAMEWORK and AUTHENTICATION ---
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ]
}
AUTH_PASSWORD_VALIDATORS = [
    { 'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator', },
    { 'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', },
    { 'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator', },
    { 'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator', },
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
FRONTEND_URL = os.environ.get('FRONTEND_URL')
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET')

