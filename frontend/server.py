#!/usr/bin/env python3
"""
Simple HTTP server for frontend with client-side routing support
"""
import http.server
import socketserver
import os
import urllib.parse

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

if __name__ == "__main__":
    PORT = 3000
    
    # Change to the frontend directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", PORT), SPAHandler) as httpd:
        print(f"🚀 Frontend server running on http://localhost:{PORT}")
        print(f"📋 Serving files from: {os.getcwd()}")
        print(f"🔄 Client-side routing enabled")
        print(f"⏹️  Press Ctrl+C to stop")
        httpd.serve_forever() 