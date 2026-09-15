#!/usr/bin/env python3
"""Mock Xtream server with multiple fake hosts on different ports to simulate varying speed/stability."""
import json
import time
import random
import socket
import struct
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

# Configuration for 3 different "servers" with different characteristics
# Server 1: fast & stable (port 8191) - quick response, no delay
# Server 2: medium & jittery (port 8192) - 100-300ms response, jitter
# Server 3: slow & unreliable (port 8193) - 500-2000ms response, sometimes fails

SERVERS = {
    8191: {"name": "fast-stable", "min_delay": 0.02, "max_delay": 0.08, "fail_rate": 0.0, "stream_speed_kbps": 5000},
    8192: {"name": "medium-jittery", "min_delay": 0.15, "max_delay": 0.45, "fail_rate": 0.1, "stream_speed_kbps": 1500},
    8193: {"name": "slow-unreliable", "min_delay": 0.6, "max_delay": 2.0, "fail_rate": 0.3, "stream_speed_kbps": 400},
}

USERS = {
    8191: ("fast_user", "fast_pass"),
    8192: ("med_user", "med_pass"),
    8193: ("slow_user", "slow_pass"),
}


def make_user_info(port, exp_days=120):
    now = int(time.time())
    return {
        "username": USERS[port][0],
        "password": USERS[port][1],
        "max_connections": "2",
        "active_cons": "1",
        "exp_date": str(now + exp_days * 86400),
        "is_trial": "0",
        "status": "Active",
        "created_at": str(now - 200 * 86400),
        "allowed_output_formats": ["ts", "m3u8", "rtmp"],
        "auth": 1,
    }


def make_server_info(port):
    return {
        "url": f"demo{port - 8190}.example.com",
        "port": str(port),
        "https_port": str(port + 1000),
        "rtmp_port": str(port + 2000),
        "server_protocol": "http",
        "server_method": "default",
        "rip": f"10.0.0.{port - 8190}",
        "timezone": "UTC",
        "timestamp_now": int(time.time()),
    }


def make_live_streams():
    return [{"stream_id": i, "name": f"Channel {i}"} for i in range(1, 101)]


def make_vod_streams():
    return [{"stream_id": i, "name": f"Movie {i}"} for i in range(1, 501)]


def make_live_categories():
    return [{"category_id": str(i), "category_name": f"Cat {i}"} for i in range(1, 6)]


def make_vod_categories():
    return [{"category_id": str(i), "category_name": f"VOD Cat {i}"} for i in range(1, 5)]


def make_series_categories():
    return [{"category_id": str(i), "category_name": f"Series Cat {i}"} for i in range(1, 4)]


def make_series():
    return [{"series_id": i, "name": f"Series {i}"} for i in range(1, 101)]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        port = self.server.server_address[1]
        config = SERVERS.get(port, SERVERS[8191])

        # Simulate delay
        delay = random.uniform(config["min_delay"], config["max_delay"])
        time.sleep(delay)

        # Simulate failure rate
        if random.random() < config["fail_rate"]:
            self.send_response(503)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Service Unavailable"}).encode())
            return

        # Check credentials
        params = parse_qs(parsed.query)
        username = params.get("username", [""])[0]
        password = params.get("password", [""])[0]
        valid_user, valid_pass = USERS.get(port, ("", ""))

        # Special: stream endpoints don't need action param
        path_parts = parsed.path.strip("/").split("/")

        # Stream URLs: /live/{user}/{pass}/{id}.ts or .m3u8
        # /movie/{user}/{pass}/{id}.mp4
        if len(path_parts) >= 5 and path_parts[0] in ("live", "movie"):
            if username != valid_user or password != valid_pass:
                self.send_response(403)
                self.end_headers()
                return
            # Stream a chunk of fake data to simulate download
            speed_kbps = config["stream_speed_kbps"]
            chunk_size = speed_kbps * 1024  # 1 second of data
            self.send_response(200)
            self.send_header("Content-Type", "video/mp2t" if path_parts[0] == "live" else "video/mp4")
            self.send_header("Content-Length", str(chunk_size))
            self.end_headers()
            # Send data in chunks to simulate streaming
            sent = 0
            while sent < chunk_size:
                chunk = b'\x00' * min(8192, chunk_size - sent)
                self.wfile.write(chunk)
                sent += len(chunk)
            return

        # player_api.php
        if parsed.path != "/player_api.php":
            # Treat get.php as success too
            if parsed.path == "/get.php":
                self.send_response(200)
                self.send_header("Content-Type", "audio/x-mpegurl")
                self.end_headers()
                self.wfile.write(b"#EXTM3U\n")
                return
            self.send_response(404)
            self.end_headers()
            return

        if username != valid_user or password != valid_pass:
            self._json({"user_info": {"auth": 0, "status": "Banned"}, "server_info": make_server_info(port)})
            return

        action = params.get("action", [""])[0]
        if action == "":
            self._json({"user_info": make_user_info(port), "server_info": make_server_info(port)})
        elif action == "get_live_categories":
            self._json(make_live_categories())
        elif action == "get_live_streams":
            self._json(make_live_streams())
        elif action == "get_vod_categories":
            self._json(make_vod_categories())
        elif action == "get_vod_streams":
            self._json(make_vod_streams())
        elif action == "get_series_categories":
            self._json(make_series_categories())
        elif action == "get_series":
            self._json(make_series())
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
        port = self.server.server_address[1]
        print(f"[mock:{port}] {args[0]}")


def serve_port(port):
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.daemon_threads = True
    print(f"Mock server on :{port} ({SERVERS[port]['name']})")
    server.serve_forever()


if __name__ == "__main__":
    import threading

    for p in SERVERS:
        t = threading.Thread(target=serve_port, args=(p,), daemon=True)
        t.start()

    # Print test URLs for easy testing
    print("\nTest URLs:")
    for p in SERVERS:
        u, pw = USERS[p]
        print(f"  :{p} -> http://127.0.0.1:{p}/get.php?username={u}&password={pw}&type=m3u_plus")

    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        print("Shutting down")
