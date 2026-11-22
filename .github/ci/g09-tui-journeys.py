#!/usr/bin/env python3
"""Hosted exact-ELF TUI journeys. Setup/oracles are separate from observed TUI traffic."""
import argparse
import base64
import codecs
import errno
import fcntl
import hashlib
import http.client
import http.server
import importlib.util
import json
import os
from pathlib import Path
import pty
import re
import secrets
import select
import shutil
import signal
import socket
import struct
import subprocess
import termios
import threading
import time
import unicodedata
import urllib.parse

HELPER_BLOB = "4fb59ffe5234f754b4cebca399e4d6e08dc29dde"
helper_path = Path(__file__).with_name("g09-generic-tui.py")
helper_raw = helper_path.read_bytes()
if hashlib.sha1(b"blob " + str(len(helper_raw)).encode() + b"\0" + helper_raw).hexdigest() != HELPER_BLOB:
    raise RuntimeError("BOOTSTRAP_HELPER_CHANGED")
spec = importlib.util.spec_from_file_location("g09_generic", helper_path)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
LIMIT = base.MAX_BYTES
SOURCE = base.SOURCE
ELF = base.ELF
TAR = base.TAR
check = base.require
CATALOG = base.CATALOG
HOP = base.HOP
POLICY = {"experimental": {"policies": [{"action": "provider.use", "effect": "deny", "resource": "*"}]}}

CASE_NAMES = [
    "TUI Session fork preserves source identity and placement",
    "TUI project session list excludes another project",
    "TUI creates a Git worktree and moves the selected Session",
    "TUI cancels and confirms moving a Session with file changes",
    "TUI normal removal requires confirmation and preserves other copies",
    "TUI forced removal distinguishes cancellation and confirmation",
    "TUI editor and export preserve selected Session and worktree binding",
    "TUI bootstrap without Basic authority cannot read or mutate project state",
]

EDITOR = r'''import hashlib, json, os, sys
from pathlib import Path
source = Path(sys.argv[1]).resolve()
raw = source.read_bytes()
if len(raw) > 1048576:
    raise RuntimeError("EDITOR_INPUT_LIMIT")
parent = os.getppid()
with open("/proc/" + str(parent) + "/exe", "rb") as stream:
    parent_sha = hashlib.file_digest(stream, "sha256").hexdigest()
suffix = b"\n<!-- G09 editor return marker -->\n"
source.write_bytes(raw + suffix)
record = {"pid": os.getpid(), "parentPid": parent, "parentElfSha256": parent_sha,
          "cwd": os.getcwd(), "file": str(source), "input": raw.decode("utf-8"),
          "inputSha256": hashlib.sha256(raw).hexdigest(),
          "returnedSha256": hashlib.sha256(raw + suffix).hexdigest()}
destination = Path(os.environ["G09_EDITOR_LOG"]) / (str(os.getpid()) + ".json")
temporary = destination.with_suffix(".tmp")
with open(temporary, "x") as output:
    os.chmod(temporary, 0o600)
    json.dump(record, output, sort_keys=True)
os.replace(temporary, destination)
'''


class Screen:
    """Small VT display observer; never feeds responses or commands to the product."""
    def __init__(self):
        self.rows = [[" "] * 140 for _ in range(48)]
        self.row = self.col = 0
        self.pending = ""
        self.decoder = codecs.getincrementaldecoder("utf-8")("replace")

    def feed(self, raw):
        data = self.pending + self.decoder.decode(raw)
        self.pending = ""
        index = 0
        while index < len(data):
            char = data[index]
            if char == "\x1b":
                if index + 1 == len(data):
                    break
                kind = data[index + 1]
                if kind == "[":
                    end = index + 2
                    while end < len(data) and not ("@" <= data[end] <= "~"):
                        end += 1
                    if end == len(data):
                        break
                    args = data[index + 2:end]
                    command = data[end]
                    nums = [int(value) if value.isdigit() else 0 for value in args.lstrip("?><").split(";")]
                    n = nums[0] or 1
                    if command in ("H", "f"):
                        self.row = max(0, min(47, (nums[0] or 1) - 1))
                        self.col = max(0, min(139, (nums[1] if len(nums) > 1 and nums[1] else 1) - 1))
                    elif command == "G":
                        self.col = min(139, n - 1)
                    elif command == "d":
                        self.row = min(47, n - 1)
                    elif command in ("A", "B", "C", "D"):
                        if command == "A":
                            self.row = max(0, self.row - n)
                        if command == "B":
                            self.row = min(47, self.row + n)
                        if command == "C":
                            self.col = min(139, self.col + n)
                        if command == "D":
                            self.col = max(0, self.col - n)
                    elif command == "J":
                        if nums[0] in (2, 3):
                            self.rows = [[" "] * 140 for _ in range(48)]
                        elif nums[0] == 0:
                            self.rows[self.row][self.col:] = [" "] * (140 - self.col)
                            for row in range(self.row + 1, 48):
                                self.rows[row] = [" "] * 140
                    elif command == "K":
                        start, finish = (0, 140) if nums[0] == 2 else ((0, self.col + 1) if nums[0] == 1 else (self.col, 140))
                        self.rows[self.row][start:finish] = [" "] * (finish - start)
                    index = end + 1
                    continue
                if kind in ("]", "P", "^", "_"):
                    endings = [value for value in (data.find("\x07", index + 2), data.find("\x1b\\", index + 2)) if value >= 0]
                    if not endings:
                        break
                    end = min(endings)
                    index = end + (1 if data[end] == "\x07" else 2)
                    continue
                index += 2
                continue
            if char == "\r":
                self.col = 0
            elif char == "\n":
                self.row += 1
                if self.row >= 48:
                    self.rows.pop(0)
                    self.rows.append([" "] * 140)
                    self.row = 47
            elif char == "\b":
                self.col = max(0, self.col - 1)
            elif char == "\t":
                self.col = min(139, (self.col // 8 + 1) * 8)
            elif ord(char) >= 32 and not unicodedata.combining(char):
                self.rows[self.row][self.col] = char
                width = 2 if unicodedata.east_asian_width(char) in ("W", "F") else 1
                if width == 2 and self.col < 139:
                    self.rows[self.row][self.col + 1] = " "
                self.col = min(139, self.col + width)
            index += 1
        self.pending = data[index:]

    def text(self):
        return "\n".join("".join(row).rstrip() for row in self.rows)


def tree_state(directory):
    result = {}
    if not directory.exists():
        return {"exists": False}
    for item in sorted(directory.rglob("*")):
        relative = item.relative_to(directory)
        if ".git" in relative.parts:
            continue
        if item.is_symlink():
            result[str(relative)] = {"symlink": os.readlink(item)}
        elif item.is_file():
            result[str(relative)] = base.file_sha(item)
    return {"exists": True, "files": result}


class Harness:
    def __init__(self, args):
        self.args = args
        self.password = secrets.token_hex(32)
        self.auth = "Basic " + base64.b64encode(("orchestra:" + self.password).encode()).decode()
        self.secrets = [self.password.encode(), self.auth.encode(), self.auth[6:].encode()]
        self.processes = {}
        self.setup = []
        self.cases = []
        self.current = None
        self.created = False
        self.server = None

    def save(self, path, data):
        raw = data if isinstance(data, bytes) else (json.dumps(data, indent=2, sort_keys=True) + "\n").encode()
        for secret in self.secrets:
            raw = raw.replace(secret, b"[fixture-secret-redacted]")
        return base.private(path, raw)

    def env(self, root):
        value = base.environment(root)
        self.secrets.append((root / "data/credential.key").read_bytes().strip())
        return value

    def poll(self, pid):
        if self.processes[pid] is None:
            waited, status = os.waitpid(pid, os.WNOHANG)
            if waited:
                self.processes[pid] = status
        return self.processes[pid]

    def stop(self, pid):
        if self.poll(pid) is not None:
            return
        for sig, budget in ((signal.SIGTERM, 3), (signal.SIGKILL, 2)):
            try:
                os.killpg(pid, sig)
            except ProcessLookupError:
                pass
            deadline = time.monotonic() + budget
            while time.monotonic() < deadline and self.poll(pid) is None:
                time.sleep(0.05)
            if self.poll(pid) is not None:
                return
        raise RuntimeError("CHILD_CLEANUP_TIMEOUT")

    def request(self, method, path, body=None, expected=200, purpose="oracle", auth=True):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=30)
        encoded = json.dumps(body).encode() if body is not None else None
        headers = {"Authorization": self.auth} if auth else {}
        if encoded is not None:
            headers["Content-Type"] = "application/json"
        try:
            connection.request(method, path, body=encoded, headers=headers)
            response = connection.getresponse()
            raw = response.read(LIMIT + 1)
            check(len(raw) <= LIMIT, "DIRECT_RESPONSE_LIMIT")
            value = json.loads(raw) if raw else None
            self.setup.append({"origin": "harness-direct", "purpose": purpose, "method": method,
                               "path": path, "payload": body, "status": response.status,
                               "responseSha256": base.sha(raw), "responseBytes": len(raw)})
            check(response.status == expected, "DIRECT_HTTP_" + str(response.status) + "_EXPECTED_" + str(expected))
            return value
        finally:
            connection.close()

    def query(self, path, directory):
        return path + "?" + urllib.parse.urlencode({"directory": str(directory)})

    def git(self, directory, *argv):
        result = subprocess.run(["git", "-C", str(directory), *argv], env=self.fixture_env,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30, check=False)
        check(result.returncode == 0, "GIT_FIXTURE_FAILED_" + argv[0])
        self.setup.append({"origin": "harness-git", "purpose": "fixture-or-oracle",
                           "argv": ["git", "-C", str(directory), *argv], "exitCode": result.returncode,
                           "stdoutSha256": base.sha(result.stdout), "stderrSha256": base.sha(result.stderr)})
        return result.stdout

    def repository(self, name):
        directory = self.args.runtime_dir / name
        directory.mkdir(mode=0o700)
        (directory / "tracked.txt").write_text("committed-" + name + "\n")
        (directory / "sentinel.txt").write_text("outside-selection-" + secrets.token_hex(12) + "\n")
        self.git(directory, "-c", "init.defaultBranch=main", "init")
        self.git(directory, "add", "--all")
        self.git(directory, "-c", "user.name=G09 Fixture", "-c", "user.email=g09@example.invalid",
                 "commit", "-m", "fixture")
        return directory

    def start(self):
        self.args.runtime_dir.mkdir(mode=0o700, exist_ok=False)
        self.created = True
        self.fixture_env = self.env(self.args.runtime_dir / "fixture")
        self.fixture_env["GIT_OPTIONAL_LOCKS"] = "0"
        self.main = self.repository("main-repository")
        self.original_head = self.git(self.main, "rev-parse", "HEAD").strip()
        self.foreign = self.repository("foreign-repository")
        self.server_env = self.env(self.args.runtime_dir / "server")
        base.private(Path(self.server_env["ORCHESTRA_CONFIG_DIR"]) / "orchestra.json", POLICY)
        self.server_env["ORCHESTRA_SERVER_PASSWORD"] = self.password
        self.editor = self.args.runtime_dir / "observe-editor.py"
        base.private(self.editor, EDITOR.encode())
        check(" " not in str(self.editor), "EDITOR_FIXTURE_PATH_HAS_SPACES")
        with socket.socket() as reservation:
            reservation.bind(("127.0.0.1", 0))
            self.port = reservation.getsockname()[1]
        self.server_argv = [str(self.args.binary), "serve", "--hostname", "127.0.0.1", "--port", str(self.port)]
        self.server = os.fork()
        if self.server == 0:
            try:
                os.setsid()
                os.chdir(self.main)
                with open(self.args.runtime_dir / "server.log", "xb", buffering=0) as log:
                    os.dup2(log.fileno(), 1)
                    os.dup2(log.fileno(), 2)
                    os.execve(self.args.binary, self.server_argv, self.server_env)
            except BaseException:
                os._exit(127)
        self.processes[self.server] = None
        deadline = time.monotonic() + 35
        ready = False
        while time.monotonic() < deadline:
            check(self.poll(self.server) is None, "SERVER_EXITED")
            try:
                ready = self.request("GET", "/api/health", purpose="setup").get("healthy") is True
                if ready:
                    break
            except (ConnectionError, TimeoutError, OSError, http.client.HTTPException):
                time.sleep(0.1)
        check(ready, "SERVER_START_TIMEOUT")
        self.server_identity = base.identity(self.server, self.args.binary, self.server_argv)
        self.main_location = self.request("GET", self.query("/api/location", self.main), purpose="setup")
        self.project = self.main_location["project"]["id"]
        foreign = self.request("GET", self.query("/api/location", self.foreign), purpose="setup")
        check(self.project != foreign["project"]["id"] and self.project != "global", "GIT_PROJECT_IDENTITIES_NOT_DISTINCT")
        providers = self.request("GET", self.query("/api/provider", self.main), purpose="setup")
        model = self.request("GET", self.query("/api/model/default", self.main), purpose="setup")
        check(providers.get("data") == [] and model.get("data", "missing") is None, "MODEL_EXECUTION_NOT_DISABLED")
        self.model_execution_disabled = True

    def session(self, directory, title):
        result = self.request("POST", "/api/session", {"location": {"directory": str(directory)}}, purpose="setup")
        session = result["data"]
        self.request("POST", "/api/session/" + session["id"] + "/rename", {"title": title}, expected=204, purpose="setup")
        return self.session_info(session["id"])

    def session_info(self, session):
        return self.request("GET", "/api/session/" + session)["data"]

    def copy(self, name):
        result = self.request("POST", self.query("/experimental/project/" + self.project + "/copy", self.main),
                              {"strategy": "git_worktree", "directory": str(self.args.runtime_dir / "setup-copies"),
                               "name": name}, purpose="setup")
        directory = Path(result["directory"]).resolve()
        check(directory.is_relative_to(self.args.runtime_dir) and directory.is_dir(), "SETUP_COPY_OUTSIDE_RUNTIME")
        return directory

    def directory_records(self):
        return self.request("GET", "/api/project/" + self.project + "/directories")

    def run_case(self, index, operation):
        output = self.args.output_dir / ("%02d" % (index + 1))
        output.mkdir(mode=0o700)
        record = {"caseName": CASE_NAMES[index], "status": "fail", "formalG09Pass": False,
                  "setupStart": len(self.setup), "scope": "Observed named branch only; no inferred ID dispositions"}
        self.current = None
        try:
            operation(record, output)
            if self.current and self.current.request_keyboard_quit:
                self.current.quit()
            record["status"] = "pass"
        except Exception as error:
            record["failure"] = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        finally:
            if self.current:
                try:
                    record["tui"] = self.current.close()
                    if not record["tui"]["cleanupComplete"]:
                        record.update(status="fail", cleanupFailure=True)
                except Exception as error:
                    record.update(status="fail", cleanupFailure=type(error).__name__)
            record["setupEnd"] = len(self.setup)
            self.save(output / "case.json", record)
            self.cases.append(record)

    def tui(self, output, directory, session=None, fork=False, authenticated=True):
        self.current = Tui(self, output, directory, session, fork, authenticated)
        if authenticated:
            self.current.bootstrap()
        return self.current


class Tui:
    def __init__(self, harness, output, directory, session, fork, authenticated):
        self.h, self.output, self.directory = harness, output, directory
        self.events, self.errors, self.actions = [], [], []
        self.lock, self.stopping, self.quitting = threading.Lock(), threading.Event(), threading.Event()
        self.sockets, self.workers = set(), set()
        self.raw, self.screen = bytearray(), Screen()
        self.identity = None
        self.quit_status = None
        self.request_keyboard_quit = True
        self.session = session
        self.authenticated = authenticated
        self.root = harness.args.runtime_dir / ("tui-" + output.name)
        self.env = harness.env(self.root)
        self.editor_logs = self.root / "editor-observations"
        self.editor_logs.mkdir(mode=0o700)
        self.env.update({"EDITOR": "/usr/bin/python3 -B " + str(harness.editor),
                         "G09_EDITOR_LOG": str(self.editor_logs)})
        if authenticated:
            self.env.update({"ORCHESTRA_SERVER_PASSWORD": harness.password, "ORCHESTRA_SERVER_USERNAME": "orchestra"})
        target = self

        class Proxy(http.server.BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *_):
                pass

            def forward(self):
                connection = upstream_socket = None
                with target.lock:
                    target.workers.add(threading.current_thread())
                try:
                    check(self.client_address[0] == "127.0.0.1" and self.path.startswith("/") and
                          not self.path.startswith("//") and not self.headers.get("Transfer-Encoding"), "PROXY_REQUEST_SHAPE")
                    check(self.headers.get("Authorization") == (target.h.auth if target.authenticated else None) and
                          not self.headers.get("Cookie") and not any(key.lower().startswith(("x-sf-", "x-forwarded-"))
                          for key in self.headers), "TUI_AUTHORITY_MISMATCH")
                    length = int(self.headers.get("Content-Length", "0"))
                    check(0 <= length <= LIMIT, "REQUEST_LIMIT")
                    incoming = self.rfile.read(length) if length else None
                    payload = json.loads(incoming) if incoming else None
                    split = urllib.parse.urlsplit(self.path)
                    path = split.path
                    allowed = self.command == "GET" and path.startswith("/api/")
                    query = urllib.parse.parse_qs(split.query)
                    if query.get("directory"):
                        check(all(Path(value).resolve().is_relative_to(target.h.args.runtime_dir)
                                  for value in query["directory"]), "TUI_QUERY_ESCAPED_RUNTIME")
                    copy_root = "/experimental/project/" + target.h.project + "/copy"
                    if self.command == "POST" and path in (copy_root + "/refresh", copy_root + "/generate-name"):
                        allowed = target.h.model_execution_disabled
                    if self.command == "POST" and path == copy_root:
                        allowed = isinstance(payload, dict) and payload.get("strategy") == "git_worktree" and \
                            isinstance(payload.get("directory"), str) and \
                            Path(payload["directory"]).resolve().is_relative_to(target.h.args.runtime_dir) and \
                            isinstance(payload.get("name"), str) and payload["name"] not in ("", ".", "..") and \
                            Path(payload["name"]).name == payload["name"]
                    if self.command == "DELETE" and path == copy_root:
                        allowed = isinstance(payload, dict) and isinstance(payload.get("force"), bool) and \
                            isinstance(payload.get("directory"), str) and \
                            Path(payload["directory"]).resolve().is_relative_to(target.h.args.runtime_dir)
                    session_root = "/api/session/" + (target.session or "") + "/"
                    if self.command == "POST" and path in (session_root + "fork", session_root + "move", session_root + "synthetic"):
                        allowed = isinstance(payload, dict)
                        if path.endswith("/move"):
                            allowed = allowed and isinstance(payload.get("location", {}).get("directory"), str) and \
                                Path(payload["location"]["directory"]).resolve().is_relative_to(target.h.args.runtime_dir)
                        if path.endswith("/synthetic"):
                            allowed = allowed and payload.get("resume") is False and \
                                payload.get("text", "").startswith("<system-reminder>The user has changed")
                    check(allowed, "UNEXPECTED_TUI_MUTATION_OR_MODEL_ROUTE")
                    headers = {key: value for key, value in self.headers.items() if key.lower() not in HOP}
                    headers["Host"] = f"127.0.0.1:{target.h.port}"
                    connection = http.client.HTTPConnection("127.0.0.1", target.h.port, timeout=35)
                    connection.request(self.command, self.path, body=incoming, headers=headers)
                    response = connection.getresponse()
                    upstream_socket = response.fp.raw._sock
                    streaming = response.getheader("Content-Type", "").split(";", 1)[0] == "text/event-stream"
                    event = {"method": self.command, "path": path, "query": urllib.parse.parse_qs(split.query),
                             "payload": payload, "status": response.status, "source": "actual-upstream",
                             "delivered": False, "streaming": streaming}
                    with target.lock:
                        check(len(target.events) < 400, "REQUEST_COUNT_LIMIT")
                        event["index"] = len(target.events)
                        target.events.append(event)
                        target.sockets.add(upstream_socket)
                    body = b"" if streaming else response.read(LIMIT + 1)
                    check(len(body) <= LIMIT, "RESPONSE_LIMIT")
                    self.send_response(response.status)
                    for key, value in response.getheaders():
                        if key.lower() not in HOP:
                            self.send_header(key, value)
                    if not streaming:
                        self.send_header("Content-Length", str(len(body)))
                    self.send_header("Connection", "close")
                    self.end_headers()
                    if streaming:
                        check(path == "/api/event", "UNEXPECTED_SSE")
                        upstream_socket.settimeout(180)
                        capture = bytearray()
                        while not target.stopping.is_set():
                            chunk = response.read1(65536)
                            if not chunk:
                                break
                            capture.extend(chunk)
                            check(len(capture) <= LIMIT, "SSE_LIMIT")
                            self.wfile.write(chunk)
                            self.wfile.flush()
                            types = set()
                            for frame in bytes(capture).replace(b"\r\n", b"\n").split(b"\n\n")[:-1]:
                                data = b"\n".join(line[5:].lstrip() for line in frame.split(b"\n") if line.startswith(b"data:"))
                                if data:
                                    try:
                                        types.add(json.loads(data).get("type"))
                                    except (ValueError, AttributeError):
                                        pass
                            with target.lock:
                                event.update(delivered=True, responseBytes=len(capture), responseSha256=base.sha(capture),
                                             eventTypes=sorted(value for value in types if isinstance(value, str)))
                    else:
                        self.wfile.write(body)
                        self.wfile.flush()
                        content_type = response.getheader("Content-Type", "").split(";", 1)[0].lower()
                        value = json.loads(body) if body and (content_type == "application/json" or content_type.endswith("+json")) else None
                        with target.lock:
                            event.update(delivered=True, responseBytes=len(body), responseSha256=base.sha(body), response=value)
                except Exception as error:
                    requested_close = target.quitting.is_set() and isinstance(error, (BrokenPipeError, ConnectionResetError))
                    if not target.stopping.is_set() and not requested_close:
                        with target.lock:
                            target.errors.append(str(error) if isinstance(error, RuntimeError) else type(error).__name__)
                    self.close_connection = True
                finally:
                    if connection:
                        connection.close()
                    with target.lock:
                        if upstream_socket:
                            target.sockets.discard(upstream_socket)
                        target.workers.discard(threading.current_thread())

            do_GET = do_HEAD = do_POST = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = forward

        self.proxy = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Proxy)
        self.proxy.daemon_threads = True
        self.argv = [str(harness.args.binary), "attach", f"http://127.0.0.1:{self.proxy.server_port}", "--dir", str(directory)]
        if session:
            self.argv += ["--session", session]
        if fork:
            self.argv += ["--fork"]
        self.pid, self.terminal = pty.fork()
        if self.pid == 0:
            try:
                os.chdir(directory)
                os.execve(harness.args.binary, self.argv, self.env)
            except BaseException:
                os._exit(127)
        harness.processes[self.pid] = None
        fcntl.ioctl(self.terminal, termios.TIOCSWINSZ, struct.pack("HHHH", 48, 140, 0, 0))
        self.thread = threading.Thread(target=self.proxy.serve_forever, kwargs={"poll_interval": 0.05})
        self.thread.start()

    def pump(self, duration=0.05):
        if self.identity is None:
            try:
                if Path(f"/proc/{self.pid}/exe").resolve() == self.h.args.binary:
                    self.identity = base.identity(self.pid, self.h.args.binary, self.argv)
                    check(os.readlink(f"/proc/{self.pid}/fd/0").startswith("/dev/pts/"), "TUI_NOT_PTY")
            except FileNotFoundError:
                pass
        if select.select([self.terminal], [], [], duration)[0]:
            try:
                raw = os.read(self.terminal, 65536)
                self.raw.extend(raw)
                self.screen.feed(raw)
            except OSError as error:
                if error.errno != errno.EIO:
                    raise
        check(len(self.raw) <= LIMIT, "PTY_LIMIT")
        check(self.h.poll(self.h.server) is None, "SERVER_EXITED_DURING_JOURNEY")
        with self.lock:
            check(not self.errors, "PROXY_FAILURE")

    def wait(self, predicate, reason, timeout=20, allow_exit=False):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            self.pump()
            result = predicate()
            if result:
                return result
            if not allow_exit:
                check(self.h.poll(self.pid) is None, "TUI_EXITED_DURING_" + reason)
        raise RuntimeError("TIMEOUT_" + reason)

    def settle(self, seconds=0.35):
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            self.pump()
            check(self.h.poll(self.pid) is None, "TUI_EXITED_WHILE_SETTLING")

    def observed(self):
        with self.lock:
            return [dict(event) for event in self.events]

    def mark(self):
        with self.lock:
            return len(self.events)

    def event(self, method, path, status=200, after=0, payload=None):
        def match():
            return next((event for event in self.observed() if event["index"] >= after and event["method"] == method and
                         event["path"] == path and event["status"] == status and event["delivered"] and
                         (payload is None or payload(event.get("payload")))), None)
        return self.wait(match, method + "_" + path.replace("/", "_"))

    def keys(self, label, value):
        self.actions.append({"label": label, "bytesHex": value.hex(), "networkIndex": self.mark(),
                             "screenSha256": base.sha(self.screen.text().encode())})
        os.write(self.terminal, value)

    def text(self, value):
        self.keys("type fixture selection", value.encode())

    def screen_has(self, phrase):
        return self.wait(lambda: phrase in self.screen.text(), "SCREEN_" + phrase.replace(" ", "_"))

    def bootstrap(self):
        def ready():
            events = [event for event in self.observed() if event["delivered"] and event["status"] == 200]
            paths = {event["path"] for event in events}
            location = any(event["path"] == "/api/location" and (event.get("response") or {}).get("directory") ==
                           str(self.directory) for event in events)
            return self.identity and CATALOG.issubset(paths) and location and "/api/session" in paths and \
                any("server.connected" in event.get("eventTypes", []) for event in events)
        self.wait(ready, "BOOTSTRAP", timeout=45)
        self.settle(1)
        # Fresh policy intentionally has no providers; close the real onboarding dialog before commands.
        self.keys("dismiss optional provider dialog", b"\x1b")
        self.settle(0.2)
        self.keys("dismiss optional nested dialog", b"\x1b")
        self.settle(0.2)

    def command(self, title):
        self.keys("open command palette", b"\x10")
        self.screen_has("Commands")
        self.text(title)
        self.settle()
        self.screen_has(title)
        self.keys("select palette command", b"\r")
        self.settle()

    def move_dialog(self):
        before = self.mark()
        self.command("Move session")
        root = "/experimental/project/" + self.h.project + "/copy"
        self.event("POST", root + "/refresh", 204, before)
        self.event("GET", "/api/project/" + self.h.project + "/directories", 200, before)
        self.screen_has("Move session")

    def select_copy(self, directory):
        self.text(directory.name)
        self.settle()
        self.screen_has(directory.name)

    def editor_calls(self):
        return [json.loads(path.read_text()) for path in sorted(self.editor_logs.glob("*.json"), key=lambda item: int(item.stem))]

    def quit(self):
        self.keys("close active dialog before quit", b"\x1b")
        self.settle(0.2)
        self.keys("close remaining dialog before quit", b"\x1b")
        self.settle(0.2)
        self.quitting.set()
        self.keys("request application quit Ctrl+C", b"\x03")
        deadline = time.monotonic() + 2
        while time.monotonic() < deadline and self.h.poll(self.pid) is None:
            self.pump()
        if self.h.poll(self.pid) is None:
            self.keys("request application quit Ctrl+D", b"\x04")
        self.wait(lambda: self.h.poll(self.pid) is not None, "KEYBOARD_QUIT", timeout=5, allow_exit=True)
        status = self.h.poll(self.pid)
        check(status is not None and os.WIFEXITED(status) and os.WEXITSTATUS(status) == 0, "KEYBOARD_QUIT_FAILED")
        self.quit_status = os.waitstatus_to_exitcode(status)

    def close(self):
        self.stopping.set()
        cleanup_errors = []
        with self.lock:
            sockets = list(self.sockets)
        for connection in sockets:
            try:
                connection.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
        cleanup_needed = self.h.poll(self.pid) is None
        try:
            self.h.stop(self.pid)
        except Exception as error:
            cleanup_errors.append(type(error).__name__)
        os.close(self.terminal)
        if self.thread.is_alive():
            self.proxy.shutdown()
        self.proxy.server_close()
        self.thread.join(timeout=2)
        with self.lock:
            workers = list(self.workers)
        deadline = time.monotonic() + 3
        for worker in workers:
            worker.join(timeout=max(0, deadline - time.monotonic()))
        events = self.observed()
        unexpected = []
        for event in events:
            expected_force_rejection = event["method"] == "DELETE" and event["status"] == 400 and \
                (event.get("response") or {}).get("data", {}).get("forceRequired") is True
            valid_status = event["status"] in (200, 204) or expected_force_rejection
            if not self.authenticated:
                valid_status = event["method"] == "GET" and event["status"] == 401
            if not event["delivered"] or not valid_status:
                unexpected.append(event["index"])
        network = self.h.save(self.output / "tui.network.json", events)
        terminal = self.h.save(self.output / "tui.pty.raw", bytes(self.raw))
        screen = self.h.save(self.output / "final-screen.txt", self.screen.text().encode())
        self.h.save(self.output / "keyboard-actions.json", self.actions)
        editors = self.h.save(self.output / "editor-observations.json", self.editor_calls())
        status = self.h.poll(self.pid)
        return {"process": self.identity, "actualExitCode": os.waitstatus_to_exitcode(status) if status is not None else None,
                "keyboardQuitExitCode": self.quit_status, "cleanupSignalsRequired": cleanup_needed,
                "cleanupComplete": not self.workers and not self.errors and not cleanup_errors and not unexpected,
                "forwardingErrors": self.errors, "cleanupErrors": cleanup_errors, "unexpectedResponseIndices": unexpected,
                "network": network, "terminal": terminal, "screen": screen, "editorObservations": editors}


def case_fork(h, result, output):
    original = h.session(h.main, "G09 fork source")
    tui = h.tui(output, h.main, original["id"], fork=True)
    event = tui.event("POST", "/api/session/" + original["id"] + "/fork")
    forked = event["response"]["data"]
    check(forked["id"] != original["id"] and forked["location"] == original["location"], "FORK_IDENTITY_OR_PLACEMENT")
    check(h.session_info(original["id"]) == original, "FORK_CHANGED_SOURCE")
    check(h.session_info(forked["id"])["location"] == original["location"], "FORK_NOT_PERSISTED")
    tui.event("GET", "/api/session/" + forked["id"], after=event["index"] + 1)
    result.update(sourceSession=original["id"], createdSession=forked["id"], tuiRequestIndex=event["index"],
                  creationBranch="App --session --fork; New session navigation alone does not persist a Session")


def case_scope(h, result, output):
    selected_directory = h.main / "scoped-directory"
    selected_directory.mkdir(mode=0o700)
    current = h.session(selected_directory, "G09 initial scoped Session")
    selected = h.session(selected_directory, "G09 scoped selection")
    outside_directory = h.session(h.main, "G09 other directory in project")
    foreign = h.session(h.foreign, "G09 other project excluded")
    tui = h.tui(output, selected_directory, current["id"])
    before = tui.mark()
    tui.keys("open directory-filtered Session list", b"\x18l")
    filtered = tui.event("GET", "/api/session", after=before)
    ids = {item["id"] for item in filtered["response"]["data"]}
    check(filtered["query"].get("project") == [h.project] and
          filtered["query"].get("subpath") == ["scoped-directory"], "SESSION_DIRECTORY_FILTER_MISSING")
    check({current["id"], selected["id"]}.issubset(ids) and outside_directory["id"] not in ids and foreign["id"] not in ids,
          "DIRECTORY_FILTER_WRONG_RESULT")
    tui.keys("close directory-filtered list", b"\x1b")
    tui.settle()
    tui.command("Disable session directory filtering")
    before = tui.mark()
    tui.keys("open project-wide Session list", b"\x18l")
    project_wide = tui.event("GET", "/api/session", after=before)
    ids = {item["id"] for item in project_wide["response"]["data"]}
    check(project_wide["query"].get("project") == [h.project] and not project_wide["query"].get("subpath"),
          "DIRECTORY_FILTER_TOGGLE_DID_NOT_CHANGE_QUERY")
    check({current["id"], selected["id"], outside_directory["id"]}.issubset(ids) and foreign["id"] not in ids,
          "PROJECT_FILTER_WRONG_RESULT")
    tui.text("G09 scoped selection")
    tui.settle()
    before = tui.mark()
    tui.keys("select a different scoped Session", b"\r")
    navigation = tui.event("GET", "/api/session/" + selected["id"], after=before)
    check(navigation["response"]["data"]["id"] == selected["id"], "TUI_NAVIGATED_TO_WRONG_SESSION")
    tui.screen_has("G09 scoped selection")
    check(all(h.session_info(item["id"]) == item for item in (current, selected, outside_directory, foreign)),
          "LIST_SELECTION_MUTATED_SESSIONS")
    result.update(initialSession=current["id"], selectedSession=selected["id"], excludedSession=foreign["id"],
                  directoryFilteredQuery=filtered["query"], projectWideQuery=project_wide["query"],
                  navigationRequestIndex=navigation["index"],
                  qualification="Directory/project filtering under one Basic operator; not a per-project authorization claim")


def case_create(h, result, output):
    session = h.session(h.main, "G09 new worktree")
    before_files = tree_state(h.main)
    before_directories = {item["directory"] for item in h.directory_records()}
    tui = h.tui(output, h.main, session["id"])
    tui.move_dialog()
    before = tui.mark()
    # DialogSelect explicitly makes Tab focus the first enabled footer action: New.
    tui.keys("focus New project copy footer action", b"\t")
    tui.settle()
    tui.keys("activate New project copy footer action", b"\r")
    root = "/experimental/project/" + h.project + "/copy"
    generated = tui.event("POST", root + "/generate-name", after=before)
    created = tui.event("POST", root, after=before)
    destination = Path(created["response"]["directory"]).resolve()
    check(destination.is_relative_to(h.args.runtime_dir) and destination.is_dir(), "CREATED_WORKTREE_MISSING_OR_ESCAPED")
    check(created["payload"].get("strategy") == "git_worktree", "TUI_DID_NOT_REQUEST_GIT_WORKTREE")
    worktrees = h.git(h.main, "worktree", "list", "--porcelain").decode().splitlines()
    check("worktree " + str(destination) in worktrees, "CREATED_DIRECTORY_IS_NOT_A_GIT_WORKTREE")
    common_main = h.git(h.main, "rev-parse", "--path-format=absolute", "--git-common-dir").strip()
    common_target = h.git(destination, "rev-parse", "--path-format=absolute", "--git-common-dir").strip()
    check(common_main == common_target, "CREATED_WORKTREE_HAS_WRONG_GIT_REPOSITORY")
    moved = tui.event("POST", "/api/session/" + session["id"] + "/move", 204, before,
                      lambda body: body.get("location", {}).get("directory") == str(destination))
    stored = h.session_info(session["id"])
    check(stored["id"] == session["id"] and stored["projectID"] == session["projectID"] and
          stored["location"]["directory"] == str(destination), "CREATED_SESSION_IDENTITY_OR_PLACEMENT")
    check(tree_state(h.main) == before_files and tree_state(destination) == before_files, "CREATE_CHANGED_SOURCE_OR_COPY_CONTENT")
    check(str(destination) in {item["directory"] for item in h.directory_records()} - before_directories,
          "NEW_WORKTREE_NOT_REGISTERED")
    result.update(sessionID=session["id"], destination=str(destination),
                  requestIndices=[generated["index"], created["index"], moved["index"]],
                  modelExecution="All providers denied by fixture policy; model.default verified null",
                  gitWorktreeRegistered=True, gitCommonDirectory=common_main.decode())


def case_move(h, result, output):
    destination = h.copy("move-existing")
    session = h.session(h.main, "G09 move existing")
    original = (h.main / "tracked.txt").read_bytes()
    changed = original + b"uncommitted move marker\n"
    (h.main / "tracked.txt").write_bytes(changed)
    before_source, before_target = tree_state(h.main), tree_state(destination)
    tui = h.tui(output, h.main, session["id"])
    tui.move_dialog()
    tui.select_copy(destination)
    before = tui.mark()
    tui.keys("select move destination with changes", b"\r")
    tui.screen_has("File Changes Found")
    tui.keys("cancel moving Session and changes", b"\x1b")
    tui.settle(0.6)
    check(not any(event["index"] >= before and event["path"].endswith("/move") and event["method"] == "POST"
                  for event in tui.observed()), "CANCELLED_MOVE_SENT_MUTATION")
    check(h.session_info(session["id"]) == session and tree_state(h.main) == before_source and
          tree_state(destination) == before_target, "CANCELLED_MOVE_CHANGED_STATE")
    tui.move_dialog()
    tui.select_copy(destination)
    before = tui.mark()
    tui.keys("select move destination again", b"\r")
    tui.screen_has("File Changes Found")
    tui.keys("confirm moving file changes", b"\r")
    event = tui.event("POST", "/api/session/" + session["id"] + "/move", 204, before,
                     lambda body: body.get("moveChanges") is True and body.get("location", {}).get("directory") == str(destination))
    stored = h.session_info(session["id"])
    check(stored["id"] == session["id"] and stored["projectID"] == session["projectID"] and
          stored["location"]["directory"] == str(destination), "CONFIRMED_MOVE_WRONG_IDENTITY_OR_LOCATION")
    check((destination / "tracked.txt").read_bytes() == changed and (h.main / "tracked.txt").read_bytes() == original,
          "CONFIRMED_MOVE_WRONG_FILE_TRANSFER")
    check((destination / "sentinel.txt").read_bytes() == (h.main / "sentinel.txt").read_bytes(), "MOVE_TOUCHED_SENTINEL")
    result.update(sessionID=session["id"], destination=str(destination), cancelledWithoutMutation=True,
                  confirmedRequestIndex=event["index"], sourceRestored=True, targetContainsChanges=True)


def deletion_start(tui, target):
    tui.move_dialog()
    tui.select_copy(target)
    before = tui.mark()
    snapshot = tree_state(target)
    tui.keys("first delete activation", b"\x04")
    tui.screen_has("again to confirm")
    tui.settle()
    check(not any(event["index"] >= before and event["method"] == "DELETE" for event in tui.observed()),
          "FIRST_DELETE_ACTIVATION_MUTATED")
    check(tree_state(target) == snapshot, "FIRST_DELETE_ACTIVATION_CHANGED_FILES")
    tui.keys("second delete activation", b"\x04")
    return before


def removal_git_state(h, target, peer):
    paths = {line[len("worktree "):] for line in h.git(h.main, "worktree", "list", "--porcelain").decode().splitlines()
             if line.startswith("worktree ")}
    check(str(target) not in paths and {str(h.main), str(peer)}.issubset(paths),
          "REMOVAL_LEFT_STALE_GIT_REGISTRY_OR_REMOVED_PEER")
    records = {item["directory"] for item in h.directory_records()}
    check(str(target) not in records and {str(h.main), str(peer)}.issubset(records), "REMOVAL_CHANGED_OTHER_DIRECTORY_RECORD")
    common = h.git(h.main, "rev-parse", "--path-format=absolute", "--git-common-dir").strip()
    check(h.git(peer, "rev-parse", "--path-format=absolute", "--git-common-dir").strip() == common and
          h.git(h.main, "rev-parse", "HEAD").strip() == h.original_head and
          h.git(peer, "rev-parse", "HEAD").strip() == h.original_head, "REMOVAL_DAMAGED_MAIN_OR_PEER_GIT_IDENTITY")
    return {"remainingGitDirectories": sorted(paths), "mainAndPeerHead": h.original_head.decode(),
            "mainAndPeerCommonDirectory": common.decode()}


def case_remove(h, result, output):
    target, peer = h.copy("remove-clean"), h.copy("remove-clean-peer")
    session = h.session(h.main, "G09 normal removal")
    before_main, before_peer = tree_state(h.main), tree_state(peer)
    tui = h.tui(output, h.main, session["id"])
    before = deletion_start(tui, target)
    event = tui.event("DELETE", "/experimental/project/" + h.project + "/copy", 204, before,
                     lambda body: body.get("directory") == str(target) and body.get("force") is False)
    check(not target.exists() and str(target) not in {item["directory"] for item in h.directory_records()},
          "NORMAL_REMOVAL_NOT_COMPLETED")
    check(tree_state(h.main) == before_main and tree_state(peer) == before_peer and h.session_info(session["id"]) == session,
          "NORMAL_REMOVAL_TOUCHED_OUTSIDE_SELECTION")
    result.update(selectedDirectory=str(target), preservedDirectory=str(peer), firstActivationDidNotMutate=True,
                  confirmedRequestIndex=event["index"], force=False,
                  gitState=removal_git_state(h, target, peer))


def case_force(h, result, output):
    target, peer = h.copy("remove-dirty"), h.copy("remove-dirty-peer")
    (target / "tracked.txt").write_bytes((target / "tracked.txt").read_bytes() + b"uncommitted deletion marker\n")
    session = h.session(h.main, "G09 forced removal")
    before_main, before_peer, before_target = tree_state(h.main), tree_state(peer), tree_state(target)
    tui = h.tui(output, h.main, session["id"])
    before = deletion_start(tui, target)
    failed = tui.event("DELETE", "/experimental/project/" + h.project + "/copy", 400, before,
                      lambda body: body.get("directory") == str(target) and body.get("force") is False)
    check((failed["response"] or {}).get("data", {}).get("forceRequired") is True, "NORMAL_REMOVAL_DID_NOT_REQUIRE_FORCE")
    tui.screen_has("Delete working copy?")
    tui.keys("cancel forced removal", b"\x1b")
    tui.settle(0.6)
    check(not any(event["index"] > failed["index"] and event["method"] == "DELETE" and
                  (event.get("payload") or {}).get("force") is True for event in tui.observed()), "CANCELLED_FORCE_SENT_DELETE")
    check(tree_state(target) == before_target and tree_state(h.main) == before_main and tree_state(peer) == before_peer,
          "CANCELLED_FORCE_CHANGED_FILES")
    # Cancellation reopens Move session; close it before selecting the action afresh.
    tui.keys("close reopened move dialog", b"\x1b")
    tui.settle()
    before = deletion_start(tui, target)
    tui.event("DELETE", "/experimental/project/" + h.project + "/copy", 400, before)
    tui.screen_has("Delete working copy?")
    tui.keys("confirm forced removal", b"\r")
    forced = tui.event("DELETE", "/experimental/project/" + h.project + "/copy", 204, before,
                      lambda body: body.get("directory") == str(target) and body.get("force") is True)
    check(not target.exists() and str(target) not in {item["directory"] for item in h.directory_records()},
          "FORCED_REMOVAL_NOT_COMPLETED")
    check(tree_state(h.main) == before_main and tree_state(peer) == before_peer and h.session_info(session["id"]) == session,
          "FORCED_REMOVAL_TOUCHED_OUTSIDE_SELECTION")
    result.update(selectedDirectory=str(target), preservedDirectory=str(peer), normalRejectedRequest=failed["index"],
                  cancelledWithoutDeletion=True, forcedRequest=forced["index"],
                  gitState=removal_git_state(h, target, peer))


def case_editor(h, result, output):
    directory = h.copy("editor-selected")
    session = h.session(directory, "G09 selected export Session")
    tui = h.tui(output, directory, session["id"])
    marker = "G09 unsent editor draft " + session["id"]
    tui.text(marker)
    tui.keys("open real configured editor", b"\x18e")
    tui.wait(lambda: len(tui.editor_calls()) == 1, "EDITOR_INVOCATION")
    tui.wait(lambda: not Path(tui.editor_calls()[0]["file"]).exists(), "EDITOR_TEMP_CLEANUP")
    first = tui.editor_calls()[0]
    tui.screen_has("G09 editor return marker")
    check(first["parentPid"] == tui.pid and first["parentElfSha256"] == ELF and first["cwd"] == str(directory) and
          first["input"] == marker, "EDITOR_WRONG_SESSION_WORKTREE_OR_INPUT")
    filename = "g09-export-" + session["id"][-8:] + ".md"
    destination = directory / filename
    before_files = tree_state(directory)
    check(not destination.exists(), "EXPORT_DESTINATION_NOT_FRESH")
    tui.keys("open export options for cancellation", b"\x18x")
    tui.screen_has("Export Options")
    tui.keys("cancel export options", b"\x1b")
    tui.settle()
    check(tree_state(directory) == before_files and len(tui.editor_calls()) == 1, "CANCELLED_EXPORT_CREATED_EFFECT")
    tui.keys("open export without saving options", b"\x18x")
    tui.screen_has("Export Options")
    tui.keys("focus Open without saving option", b"\t\t\t\t")
    tui.settle()
    tui.keys("enable Open without saving", b" ")
    tui.wait(lambda: any("Open without saving" in line and "[x]" in line for line in tui.screen.text().splitlines()),
             "OPEN_WITHOUT_SAVING_CHECKBOX")
    tui.keys("confirm export without saving", b"\r")
    tui.wait(lambda: len(tui.editor_calls()) == 2, "OPEN_WITHOUT_SAVING_EDITOR")
    tui.wait(lambda: not Path(tui.editor_calls()[1]["file"]).exists(), "OPEN_WITHOUT_SAVING_TEMP_CLEANUP")
    unsaved = tui.editor_calls()[1]
    check(unsaved["parentPid"] == tui.pid and unsaved["parentElfSha256"] == ELF and unsaved["cwd"] == str(directory) and
          "**Session ID:** " + session["id"] in unsaved["input"] and session["title"] in unsaved["input"],
          "OPEN_WITHOUT_SAVING_WRONG_BINDING")
    check(tree_state(directory) == before_files, "OPEN_WITHOUT_SAVING_CREATED_PROJECT_ARTIFACT")
    tui.keys("open saved export options", b"\x18x")
    tui.screen_has("Export Options")
    tui.keys("replace export filename", b"\x15" + filename.encode())
    tui.settle()
    tui.keys("confirm saved export", b"\r")
    tui.wait(lambda: len(tui.editor_calls()) == 3 and destination.is_file(), "EXPORT_ARTIFACT")
    tui.wait(lambda: not Path(tui.editor_calls()[2]["file"]).exists(), "EXPORT_EDITOR_TEMP_CLEANUP")
    saved = tui.editor_calls()[2]
    tui.wait(lambda: destination.is_file() and base.file_sha(destination) == saved["returnedSha256"],
             "EXPORT_RETURNED_BYTES_PERSISTED")
    content = destination.read_bytes()
    check(saved["parentPid"] == tui.pid and saved["parentElfSha256"] == ELF and saved["cwd"] == str(directory),
          "EXPORT_EDITOR_WRONG_WORKTREE")
    check("**Session ID:** " + session["id"] in saved["input"] and session["title"] in saved["input"],
          "EXPORT_WRONG_SESSION_CONTENT")
    check(base.sha(content) == saved["returnedSha256"], "EXPORT_DID_NOT_PRESERVE_EDITOR_RESULT")
    check(h.session_info(session["id"]) == session, "EDITOR_EXPORT_MUTATED_SESSION")
    result.update(sessionID=session["id"], worktree=str(directory), exportPath=str(destination),
                  exportSha256=base.sha(content), cancelledWithoutExport=True, openWithoutSavingCreatedNoArtifact=True,
                  editorContract="Real configured observer program: invocation, parent ELF, cwd, temporary input and returned bytes",
                  notProven="Post-move editor cwd when attach stays in an older directory; visual experience of a full editor")


def case_unauthorized(h, result, output):
    before = h.request("GET", "/api/project")
    sessions = h.request("GET", "/api/session")
    tui = h.tui(output, h.main, authenticated=False)
    tui.wait(lambda: tui.identity and any(event["status"] == 401 and event["delivered"] for event in tui.observed()),
             "UNAUTHENTICATED_TUI_REQUESTS", timeout=45, allow_exit=True)
    tui.wait(lambda: h.poll(tui.pid) is not None, "UNAUTHENTICATED_TUI_EXIT", timeout=15, allow_exit=True)
    check(os.WIFEXITED(h.poll(tui.pid)), "UNAUTHENTICATED_TUI_DID_NOT_EXIT_NORMALLY")
    events = tui.observed()
    check(events and all(event["method"] == "GET" and event["status"] == 401 and event["delivered"] for event in events),
          "UNAUTHENTICATED_TUI_READ_OR_MUTATION")
    check(h.request("GET", "/api/project") == before and h.request("GET", "/api/session") == sessions,
          "UNAUTHENTICATED_TUI_CHANGED_PROJECT_OR_SESSION_STATE")
    result.update(authorizationBoundary="Missing generic Basic authority; not a per-project ACL or PermissionV2 result",
                  upstreamStatuses=[event["status"] for event in events],
                  actualTuiExitCode=os.waitstatus_to_exitcode(h.poll(tui.pid)))
    # It has already exited through the rejection path; no successful keyboard-quit claim.
    tui.request_keyboard_quit = False


def main():
    parser = argparse.ArgumentParser()
    for option in ("binary", "archive", "runtime-dir", "output-dir"):
        parser.add_argument("--" + option, required=True, type=Path)
    args = parser.parse_args()
    for key in ("binary", "archive", "runtime_dir", "output_dir"):
        setattr(args, key, getattr(args, key).resolve())
    temporary = Path(os.environ["RUNNER_TEMP"]).resolve()
    check(args.runtime_dir.is_relative_to(temporary) and args.output_dir.is_relative_to(temporary) and
          args.runtime_dir != temporary and args.output_dir != temporary and
          not args.runtime_dir.is_relative_to(args.output_dir) and not args.output_dir.is_relative_to(args.runtime_dir),
          "UNSAFE_TEMPORARY_PATHS")
    os.umask(0o077)
    args.output_dir.mkdir(mode=0o700, parents=False, exist_ok=False)
    h = Harness(args)
    receipt = {"schema": "g09-installed-tui-journeys-v1", "status": "fail", "formalG09Pass": False,
               "sourceSHA": SOURCE, "sourceTreeSHA": base.TREE, "artifactId": "14722264806",
               "elfSha256": ELF, "tarSha256": TAR, "harnessSha256": base.file_sha(__file__),
               "bootstrapHelperBlob": HELPER_BLOB, "bootstrapHelperSha256": base.sha(helper_raw),
               "runId": os.environ.get("GITHUB_RUN_ID"), "runAttempt": os.environ.get("GITHUB_RUN_ATTEMPT"),
               "jobId": os.environ.get("CHECK_RUN_ID"), "workflowSHA": os.environ.get("GITHUB_SHA"),
               "classifiedOccurrenceIds": [], "classifiedFindingIds": [], "candidateRebuilt": False,
               "notProven": ["Formal G09 acceptance", "PermissionV2 correctness", "Saved-permission DataProvider consumer",
                             "Microsoft/Teams authorization", "Every branch of the 33 Solid findings"]}
    try:
        check(os.environ.get("GITHUB_ACTIONS") == "true" and os.environ.get("GITHUB_REPOSITORY") ==
              "gustavomhss/Orchestra-SF", "HOSTED_REPOSITORY_ONLY")
        check(all(re.fullmatch(r"[1-9][0-9]*", str(receipt[key] or "")) for key in ("runId", "runAttempt", "jobId")) and
              re.fullmatch(r"[0-9a-f]{40}", str(receipt["workflowSHA"] or "")), "EXECUTION_IDENTITY_MISSING")
        check(os.getpid() == 1 and os.geteuid() != 0 and {name for _, name in socket.if_nameindex()} == {"lo"},
              "PID_NETWORK_OR_UID_ISOLATION_MISSING")
        status = Path("/proc/self/status").read_text()
        check(all(re.search(r"^" + name + r":\s+0+$", status, re.M) for name in ("CapEff", "CapBnd", "CapInh", "CapAmb")) and
              re.search(r"^NoNewPrivs:\s+1$", status, re.M), "PRIVILEGES_NOT_DROPPED")
        check(base.file_sha(args.binary) == ELF and base.file_sha(args.archive) == TAR, "PRESERVED_INPUT_MISMATCH")
        h.start()
        receipt["serverProcess"] = h.server_identity
        receipt["providerPolicy"] = POLICY
        receipt["editorObserverSha256"] = base.sha(EDITOR.encode())
        operations = (case_fork, case_scope, case_create, case_move, case_remove, case_force, case_editor, case_unauthorized)
        for index, operation in enumerate(operations):
            h.run_case(index, lambda result, output, function=operation: function(h, result, output))
        check(base.identity(h.server, args.binary, h.server_argv) == h.server_identity, "SERVER_IDENTITY_CHANGED")
        receipt["status"] = "pass" if all(case["status"] == "pass" for case in h.cases) else "fail"
    except Exception as error:
        receipt["failure"] = str(error) if isinstance(error, RuntimeError) else type(error).__name__
    finally:
        for pid in reversed(list(h.processes)):
            try:
                h.stop(pid)
            except Exception:
                receipt.update(status="fail", cleanupFailure=True)
        log = args.runtime_dir / "server.log"
        h.save(args.output_dir / "server.log", log.read_bytes()[-LIMIT:] if log.is_file() else b"")
        h.save(args.output_dir / "setup-and-oracles.json", h.setup)
        receipt["cases"] = h.cases
        receipt["processes"] = [{"pid": pid, "waitStatus": value} for pid, value in h.processes.items()]
        try:
            receipt["preservedInputsUnchanged"] = base.file_sha(args.binary) == ELF and base.file_sha(args.archive) == TAR
            check(receipt["preservedInputsUnchanged"], "PRESERVED_INPUT_CHANGED")
            if h.created:
                shutil.rmtree(args.runtime_dir)
            receipt["temporaryRuntimeRemoved"] = h.created and not args.runtime_dir.exists()
        except Exception:
            receipt.update(status="fail", cleanupFailure=True)
        h.save(args.output_dir / "tui-journeys-proof.json", receipt)
        print(json.dumps({"status": receipt["status"], "formalG09Pass": False,
                          "cases": [{"caseName": case["caseName"], "status": case["status"],
                                     "failure": case.get("failure")} for case in h.cases]}))
    return 0 if receipt["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
