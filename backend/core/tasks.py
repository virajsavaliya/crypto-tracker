# File: core/tasks.py
from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings

@shared_task
def send_activation_email_task(email, first_name, activation_token):
    activation_link = f"{settings.FRONTEND_URL}/activate/{activation_token}/"
    subject = 'Activate Your Account'
    message = f'Hi {first_name},\n\nPlease click on the link to activate your account: {activation_link}'
    from_email = settings.EMAIL_HOST_USER
    recipient_list = [email]
    send_mail(subject, message, from_email, recipient_list)

@shared_task
def send_login_token_email_task(email, first_name, login_token):
    login_link = f"{settings.FRONTEND_URL}/login/{login_token}/"
    subject = 'Your Login Link'
    message = f'Hi {first_name},\n\nPlease click on the link to log in: {login_link}'
    from_email = settings.EMAIL_HOST_USER
    recipient_list = [email]
    send_mail(subject, message, from_email, recipient_list)