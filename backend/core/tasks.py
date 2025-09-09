# File: core/tasks.py
from django.core.mail import send_mail
from django.conf import settings

def send_activation_email_task(email, first_name, activation_token):
    activation_link = f"{settings.FRONTEND_URL}/activate/{activation_token}/"
    subject = 'Activate Your Account'
    
    # Plain text version for email clients that don't support HTML
    text_message = f"""
    Hi {first_name},

    Welcome! Please activate your account by clicking the following link:
    {activation_link}

    If you did not sign up, please ignore this email.
    """

    # HTML version with a clickable button
    html_message = f"""
    <html>
    <head>
        <style>
            .button {{
                background-color: #007bff;
                color: #ffffff;
                padding: 12px 25px;
                text-decoration: none;
                border-radius: 5px;
                font-family: Arial, sans-serif;
                font-size: 16px;
                display: inline-block;
            }}
            .button:hover {{
                background-color: #0056b3;
            }}
            p {{
                font-family: Arial, sans-serif;
                font-size: 16px;
            }}
        </style>
    </head>
    <body>
        <p>Hi {first_name},</p>
        <p>Welcome! Please click the button below to activate your account.</p>
        <a href="{activation_link}" class="button" style="color: #ffffff;">Activate Account</a>
        <p style="margin-top: 20px;">If you did not sign up, please ignore this email.</p>
    </body>
    </html>
    """
    
    from_email = settings.EMAIL_HOST_USER
    recipient_list = [email]
    
    # Send both the text and HTML versions
    send_mail(subject, text_message, from_email, recipient_list, html_message=html_message)

def send_login_token_email_task(email, first_name, login_token):
    login_link = f"{settings.FRONTEND_URL}/login/{login_token}/"
    subject = 'Your Login Link'

    # Plain text version
    text_message = f"""
    Hi {first_name},

    Here is your link to log in:
    {login_link}

    This link will expire shortly. If you did not request this, please secure your account.
    """

    # HTML version with a clickable button
    html_message = f"""
    <html>
    <head>
        <style>
            .button {{
                background-color: #28a745;
                color: #ffffff;
                padding: 12px 25px;
                text-decoration: none;
                border-radius: 5px;
                font-family: Arial, sans-serif;
                font-size: 16px;
                display: inline-block;
            }}
            .button:hover {{
                background-color: #218838;
            }}
            p {{
                font-family: Arial, sans-serif;
                font-size: 16px;
            }}
        </style>
    </head>
    <body>
        <p>Hi {first_name},</p>
        <p>Please click the button below to log in to your account.</p>
        <a href="{login_link}" class="button" style="color: #ffffff;">Log In</a>
        <p style="margin-top: 20px;">This link will expire shortly. If you did not request this, you can safely ignore this email.</p>
    </body>
    </html>
    """
    
    from_email = settings.EMAIL_HOST_USER
    recipient_list = [email]

    # Send both versions
    send_mail(subject, text_message, from_email, recipient_list, html_message=html_message)