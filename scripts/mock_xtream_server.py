#!/usr/bin/env python3
"""Mock Xtream Codes server for testing the checker UI."""
import json
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

# Demo user data
DEMO_USER = {
    "username": "demo_user",
    "password": "demo_pass_2025",
    "max_connections": "2",
    "active_cons": "1",
    "exp_date": str(int(time.time()) + 90 * 86400),  # 90 days from now
    "is_trial": "0",
    "status": "Active",
    "created_at": str(int(time.time()) - 280 * 86400),  # 280 days ago
    "allowed_output_formats": ["ts", "m3u8", "rtmp"],
    "auth": 1,
    "messaging": "",
}

DEMO_SERVER = {
    "url": "demo.xtream-test.com",
    "port": "8080",
    "https_port": "8443",
    "rtmp_port": "25443",
    "server_protocol": "http",
    "server_method": "default",
    "rip": "203.0.113.42",
    "timezone": "Europe/Amsterdam",
    "timestamp_now": int(time.time()),
}

LIVE_CATS = [{"category_id": str(i), "category_name": f"Live Cat {i}"} for i in range(1, 13)]
LIVE_STREAMS = [{"stream_id": i, "name": f"Channel {i}"} for i in range(1, 1251)]
VOD_CATS = [{"category_id": str(i), "category_name": f"VOD Cat {i}"} for i in range(1, 9)]
VOD_STREAMS = [{"stream_id": i, "name": f"Movie {i}"} for i in range(1, 8421)]
SERIES_CATS = [{"category_id": str(i), "category_name": f"Series Cat {i}"} for i in range(1, 7)]
SERIES_LIST = [{"series_id": i, "name": f"Series {i}"} for i in range(1, 1842)]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path != "/player_api.php":
            self.send_response(404)
            self.end_headers()
            return
        params = parse_qs(parsed.query)
        action = params.get("action", [""])[0]
        username = params.get("username", [""])[0]
        password = params.get("password", [""])[0]

        if username != DEMO_USER["username"] or password != DEMO_USER["password"]:
            self._json({"user_info": {"auth": 0, "status": "Banned"}, "server_info": DEMO_SERVER})
            return

        if action == "":
            self._json({"user_info": DEMO_USER, "server_info": DEMO_SERVER})
        elif action == "get_live_categories":
            self._json(LIVE_CATS)
        elif action == "get_live_streams":
            self._json(LIVE_STREAMS)
        elif action == "get_vod_categories":
            self._json(VOD_CATS)
        elif action == "get_vod_streams":
            self._json(VOD_STREAMS)
        elif action == "get_series_categories":
            self._json(SERIES_CATS)
        elif action == "get_series":
            self._json(SERIES_LIST)
        else:
            self._json([])

    def _json(self, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print("[mock]", args[0])


if __name__ == "__main__":
    port = 8181
    server = HTTPServer(("127.0.0.1", port), Handler)
    print(f"Mock Xtream server running at http://127.0.0.1:{port}")
    print(f"Demo URL: http://127.0.0.1:{port}/get.php?username={DEMO_USER['username']}&password={DEMO_USER['password']}&type=m3u_plus")
    server.serve_forever()
