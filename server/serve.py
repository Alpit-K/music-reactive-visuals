"""dj-vj session server: serves the built engine, appends logs, and stops on /quit.

Usage: uv run server/serve.py --port 8765 --root engine/dist [--logs logs]
Standard library only (design §4). Binds to 127.0.0.1: nothing outside the Mac can reach it.
"""
import argparse
import re
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

NAME = re.compile(r"^[\w-]+$")


class Handler(SimpleHTTPRequestHandler):
    logs: Path

    def do_GET(self):
        if self.path == "/health":
            self._reply(200, b"ok")
        elif self.path == "/age":
            # The launcher's watchdog: a page that draws posts frame rows every 5 s, so a stale age means
            # a crashed renderer or a hung page even while the Chrome process is alive.
            self._reply(200, f"{time.monotonic() - self.server.last_log:.1f}".encode())
        else:
            super().do_GET()

    def do_POST(self):
        url = urlparse(self.path)
        if url.path == "/log":
            q = parse_qs(url.query)
            session, name = q.get("session", [""])[0], q.get("name", [""])[0]
            if not (NAME.match(session) and NAME.match(name)):
                self._reply(400)
                return
            body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            folder = self.logs / session
            folder.mkdir(parents=True, exist_ok=True)
            with (folder / f"{name}.jsonl").open("ab") as f:
                f.write(body)
            self.server.last_log = time.monotonic()
            self._reply(204)
        elif url.path == "/quit":
            self._reply(204)
            # shutdown() blocks until serve_forever returns, so it cannot run on this request's thread.
            threading.Thread(target=self.server.shutdown, daemon=True).start()
        else:
            self._reply(404)

    def _reply(self, code, body=b""):
        self.send_response(code)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass  # one line per log POST would flood the launcher log


def make_server(port, root, logs):
    handler = partial(type("BoundHandler", (Handler,), {"logs": Path(logs)}), directory=str(root))
    srv = ThreadingHTTPServer(("127.0.0.1", port), handler)
    srv.last_log = time.monotonic()  # until the page first logs, age counts from server start
    return srv


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--root", default="engine/dist")
    p.add_argument("--logs", default="logs")
    a = p.parse_args()
    srv = make_server(a.port, a.root, a.logs)
    print(f"dj-vj server on http://localhost:{a.port}", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
