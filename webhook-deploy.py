#!/usr/bin/env python3
"""
Simple webhook server for automated deployments
Run this on your server: python3 webhook-deploy.py
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import subprocess
import json
import hmac
import hashlib
import os

# Configuration
PORT = 9000
SECRET = "dronestrike-deploy-secret"  # Change this to something secure
DEPLOY_SCRIPT = "/home/droneuser/dronestrike-v2/deploy.sh"

class WebhookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/deploy':
            self.send_response(404)
            self.end_headers()
            return

        # Read the payload
        content_length = int(self.headers['Content-Length'])
        payload = self.rfile.read(content_length)
        
        # Verify signature (optional but recommended)
        signature = self.headers.get('X-Hub-Signature-256', '')
        if signature:
            expected = 'sha256=' + hmac.new(
                SECRET.encode(),
                payload,
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(signature, expected):
                self.send_response(401)
                self.end_headers()
                self.wfile.write(b'Unauthorized')
                return

        try:
            # Parse payload
            data = json.loads(payload.decode())
            
            # Check if it's a push to main branch
            if data.get('ref') == 'refs/heads/main':
                print("Deploying main branch...")
                
                # Run deployment script
                result = subprocess.run(
                    ['bash', DEPLOY_SCRIPT],
                    cwd='/home/droneuser/dronestrike-v2',
                    capture_output=True,
                    text=True
                )
                
                if result.returncode == 0:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    response = {
                        'status': 'success',
                        'message': 'Deployment completed successfully',
                        'output': result.stdout
                    }
                    self.wfile.write(json.dumps(response).encode())
                    print("Deployment successful!")
                else:
                    self.send_response(500)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    response = {
                        'status': 'error',
                        'message': 'Deployment failed',
                        'error': result.stderr
                    }
                    self.wfile.write(json.dumps(response).encode())
                    print(f"Deployment failed: {result.stderr}")
            else:
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'Ignored non-main branch')
                
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f'Error: {str(e)}'.encode())
            print(f"Webhook error: {e}")

    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'Webhook server is running')
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), WebhookHandler)
    print(f"Webhook server running on port {PORT}")
    print(f"Deploy endpoint: http://your-server:9000/deploy")
    server.serve_forever()