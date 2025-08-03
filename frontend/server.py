#!/usr/bin/env python3
"""
Simple HTTP server for frontend with client-side routing support
"""
import http.server
import socketserver
import os
import urllib.parse
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Parse the URL
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        
        # Check if it's an API call (should go to backend)
        if path.startswith('/api/'):
            self.send_error(404, "API calls should go to backend server")
            return
        
        # Check if it's a static file that exists
        if os.path.exists(path.lstrip('/')):
            return super().do_GET()
        
        # For all other routes, serve index.html (client-side routing)
        self.path = '/index.html'
        return super().do_GET()
    
    def guess_type(self, path):
        """Override to set correct MIME types"""
        if path.endswith('.js'):
            return 'application/javascript'
        elif path.endswith('.css'):
            return 'text/css'
        elif path.endswith('.png'):
            return 'image/png'
        elif path.endswith('.jpg') or path.endswith('.jpeg'):
            return 'image/jpeg'
        elif path.endswith('.svg'):
            return 'image/svg+xml'
        else:
            return super().guess_type(path)
    
    def send_header(self, keyword, value):
        """Override to ensure correct Content-Type headers"""
        if keyword.lower() == 'content-type':
            if self.path.endswith('.js'):
                super().send_header('Content-Type', 'application/javascript')
                return
            elif self.path.endswith('.css'):
                super().send_header('Content-Type', 'text/css')
                return
        super().send_header(keyword, value)
    
    def end_headers(self):
        """Add cache control headers to force reload"""
        if self.path.endswith('.js') or self.path.endswith('.css'):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        super().end_headers()

if __name__ == "__main__":
    PORT = 3001  # Frontend server port
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3001')
    
    # Change to the frontend directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", PORT), SPAHandler) as httpd:
        print(f"🚀 Frontend server running on {FRONTEND_URL}")
        print(f"📋 Serving files from: {os.getcwd()}")
        print(f"🔄 Client-side routing enabled")
        print(f"⏹️  Press Ctrl+C to stop")
        httpd.serve_forever() 