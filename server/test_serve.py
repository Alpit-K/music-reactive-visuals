import threading
import urllib.error
import urllib.request

import pytest

from serve import make_server


@pytest.fixture
def server(tmp_path):
    root = tmp_path / "dist"
    root.mkdir()
    (root / "index.html").write_text("<p>wall</p>")
    logs = tmp_path / "logs"
    srv = make_server(0, root, logs)
    thread = threading.Thread(target=srv.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{srv.server_address[1]}", logs, srv, thread
    srv.shutdown()


def post(url, body=b""):
    return urllib.request.urlopen(urllib.request.Request(url, data=body, method="POST"))


def test_serves_static(server):
    base, *_ = server
    assert urllib.request.urlopen(f"{base}/index.html").read() == b"<p>wall</p>"


def test_health(server):
    base, *_ = server
    assert urllib.request.urlopen(f"{base}/health").read() == b"ok"


def test_log_appends_per_session(server):
    base, logs, *_ = server
    assert post(f"{base}/log?session=20261001-200000&name=scene-log", b'{"a":1}\n').status == 204
    post(f"{base}/log?session=20261001-200000&name=scene-log", b'{"a":2}\n')
    assert (logs / "20261001-200000" / "scene-log.jsonl").read_text() == '{"a":1}\n{"a":2}\n'


@pytest.mark.parametrize("query", ["session=../x&name=a", "session=s&name=../../etc", "session=s", "name=a"])
def test_log_rejects_bad_names(server, query):
    base, *_ = server
    with pytest.raises(urllib.error.HTTPError) as e:
        post(f"{base}/log?{query}", b"x\n")
    assert e.value.code == 400


def test_quit_stops_server(server):
    base, _, srv, thread = server
    assert post(f"{base}/quit").status == 204
    thread.join(timeout=5)
    assert not thread.is_alive()


def test_age_counts_from_start_then_from_last_log(server):
    base, _, srv, _ = server
    srv.last_log -= 40  # as if the server started 40 s ago and the page never logged
    assert float(urllib.request.urlopen(f"{base}/age").read()) >= 40
    post(f"{base}/log?session=s&name=frames", b"{}\n")
    assert float(urllib.request.urlopen(f"{base}/age").read()) < 1
