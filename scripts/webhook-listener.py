#!/usr/bin/env python3
"""
GitHub Webhook Listener for Auto-Deployment
Listens for GitHub push events and automatically deploys the frontend
"""

import os
import sys
import hmac
import hashlib
import subprocess
import logging
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

# Configuration
PORT = 9000
WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET', 'your-secret-key-here')
DEPLOY_SCRIPT = '/root/crypto-tracker/deploy-frontend.sh'
LOG_FILE = '/var/log/webhook-deployment.log'

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

class WebhookHandler(BaseHTTPRequestHandler):
    """Handle incoming webhook requests from GitHub"""
    
    def do_POST(self):
        """Handle POST requests from GitHub webhooks"""
        
        # Only accept POST to /webhook
        if self.path != '/webhook':
            self.send_response(404)
            self.end_headers()
            return
        
        # Get content length
        content_length = int(self.headers.get('Content-Length', 0))
        
        # Read the POST data
        post_data = self.rfile.read(content_length)
        
        # Get the signature from headers
        signature = self.headers.get('X-Hub-Signature-256', '')
        
        # Verify the signature
        if not self.verify_signature(post_data, signature):
            logger.warning('Invalid signature - unauthorized request')
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b'Unauthorized')
            return
        
        # Parse the JSON payload
        try:
            payload = json.loads(post_data.decode('utf-8'))
        except json.JSONDecodeError:
            logger.error('Invalid JSON payload')
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Invalid JSON')
            return
        
        # Check if it's a push event to main branch
        event_type = self.headers.get('X-GitHub-Event', '')
        
        if event_type != 'push':
            logger.info(f'Ignoring non-push event: {event_type}')
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'Event ignored')
            return
        
        ref = payload.get('ref', '')
        if ref != 'refs/heads/main':
            logger.info(f'Ignoring push to non-main branch: {ref}')
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'Non-main branch ignored')
            return
        
        # Get commit information
        commits = payload.get('commits', [])
        commit_messages = [c.get('message', '') for c in commits[-3:]]  # Last 3 commits
        pusher = payload.get('pusher', {}).get('name', 'Unknown')
        
        logger.info('='*60)
        logger.info(f'🚀 Deployment triggered by: {pusher}')
        logger.info(f'📝 Recent commits: {commit_messages}')
        logger.info('='*60)
        
        # Run the deployment script
        try:
            result = subprocess.run(
                ['/bin/bash', DEPLOY_SCRIPT],
                capture_output=True,
                text=True,
                timeout=600  # 10 minute timeout
            )
            
            if result.returncode == 0:
                logger.info('✅ Deployment completed successfully')
                logger.info(f'Output: {result.stdout}')
                
                self.send_response(200)
                self.end_headers()
                response = {
                    'status': 'success',
                    'message': 'Deployment completed successfully',
                    'timestamp': datetime.now().isoformat()
                }
                self.wfile.write(json.dumps(response).encode('utf-8'))
            else:
                logger.error(f'❌ Deployment failed with code {result.returncode}')
                logger.error(f'Error output: {result.stderr}')
                
                self.send_response(500)
                self.end_headers()
                response = {
                    'status': 'error',
                    'message': 'Deployment failed',
                    'error': result.stderr,
                    'timestamp': datetime.now().isoformat()
                }
                self.wfile.write(json.dumps(response).encode('utf-8'))
                
        except subprocess.TimeoutExpired:
            logger.error('❌ Deployment timed out')
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b'Deployment timeout')
            
        except Exception as e:
            logger.error(f'❌ Deployment error: {str(e)}')
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f'Deployment error: {str(e)}'.encode('utf-8'))
    
    def verify_signature(self, payload, signature_header):
        """Verify the webhook signature from GitHub"""
        if not signature_header:
            return False
        
        # GitHub sends signature as 'sha256=<signature>'
        try:
            hash_algorithm, signature = signature_header.split('=')
        except ValueError:
            return False
        
        if hash_algorithm != 'sha256':
            return False
        
        # Calculate the expected signature
        mac = hmac.new(
            WEBHOOK_SECRET.encode('utf-8'),
            msg=payload,
            digestmod=hashlib.sha256
        )
        expected_signature = mac.hexdigest()
        
        # Compare signatures
        return hmac.compare_digest(expected_signature, signature)
    
    def do_GET(self):
        """Handle GET requests - health check"""
        if self.path == '/health':
            self.send_response(200)
            self.end_headers()
            response = {
                'status': 'healthy',
                'service': 'webhook-listener',
                'timestamp': datetime.now().isoformat()
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        """Override to use custom logger"""
        logger.info(f'{self.address_string()} - {format % args}')


def main():
    """Start the webhook listener server"""
    
    # Check if deploy script exists
    if not os.path.exists(DEPLOY_SCRIPT):
        logger.error(f'Deploy script not found: {DEPLOY_SCRIPT}')
        sys.exit(1)
    
    # Make sure deploy script is executable
    os.chmod(DEPLOY_SCRIPT, 0o755)
    
    # Create log directory if it doesn't exist
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    
    # Start the server
    server = HTTPServer(('0.0.0.0', PORT), WebhookHandler)
    
    logger.info('='*60)
    logger.info('🎣 GitHub Webhook Listener Started')
    logger.info(f'📡 Listening on port {PORT}')
    logger.info(f'📝 Deploy script: {DEPLOY_SCRIPT}')
    logger.info(f'📄 Log file: {LOG_FILE}')
    logger.info(f'🔐 Webhook secret configured: {"Yes" if WEBHOOK_SECRET != "your-secret-key-here" else "No (using default)"}')
    logger.info('='*60)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info('\n🛑 Shutting down webhook listener...')
        server.shutdown()
        sys.exit(0)


if __name__ == '__main__':
    main()
