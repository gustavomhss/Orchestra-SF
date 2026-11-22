#!/usr/bin/env python3
"""Same-run candidate ELF probe; preserved candidate helpers and dispositions stay unchanged."""
import argparse
import base64
import errno
import fcntl
import hashlib
import http.client
import http.server
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
import termios
import threading
import time
import urllib.parse

CATALOG = {"/api/provider", "/api/model", "/api/model/default", "/api/agent", "/api/config"}
MAX_BYTES = 8 * 1024 * 1024
HOP = {"host", "connection", "proxy-connection", "keep-alive", "transfer-encoding", "upgrade", "content-length"}


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def file_sha(path):
    with open(path, "rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


# Identity is supplied only by the same-run artifact verifier. The preserved
# candidate helpers remain unchanged; no old artifact identities are accepted.
SOURCE = TREE = ELF = TAR = None
CANDIDATE = None
CANDIDATE_FILES = {}


def bind_candidate(path, binary, archive):
    global SOURCE, TREE, ELF, TAR, CANDIDATE, CANDIDATE_FILES
    require(CANDIDATE is None, "CANDIDATE_ALREADY_BOUND")
    require(os.environ.get("GITHUB_ACTIONS") == "true" and
            os.environ.get("GITHUB_REPOSITORY") == "gustavomhss/Orchestra-SF", "HOSTED_REPOSITORY_ONLY")
    temporary = Path(os.environ["RUNNER_TEMP"]).resolve()
    root = temporary / "g09-candidate"
    path = path.resolve()
    require(path == root / "candidate-binding.json", "UNEXPECTED_CANDIDATE_BINDING_PATH")
    raw = path.read_bytes()
    require(len(raw) <= 65536, "CANDIDATE_BINDING_LIMIT")
    candidate = json.loads(raw)
    require(candidate.get("schema") == "sf-g09-candidate-binding-v1", "CANDIDATE_BINDING_SCHEMA")
    for key in ("sourceSHA", "sourceTreeSHA", "workflowSHA"):
        require(re.fullmatch(r"[0-9a-f]{40}", str(candidate.get(key, ""))), "CANDIDATE_SHA_" + key)
    for key in ("artifactZipSha256", "archiveSha256", "binarySha256", "compileProvenanceSha256",
                "compileEvidenceSha256", "cliSourceMapIndexSha256", "cliSourceMapsSha256"):
        require(re.fullmatch(r"[0-9a-f]{64}", str(candidate.get(key, ""))), "CANDIDATE_DIGEST_" + key)
    for key in ("runId", "runAttempt", "producerJobId", "producerCheckRunId", "artifactId"):
        require(re.fullmatch(r"[1-9][0-9]*", str(candidate.get(key, ""))), "CANDIDATE_ID_" + key)
    require(candidate["sourceSHA"] == candidate["workflowSHA"] == os.environ.get("GITHUB_SHA") ==
            os.environ.get("SF_PRODUCT_SOURCE_SHA"), "CANDIDATE_SOURCE_WORKFLOW_MISMATCH")
    require(str(candidate["runId"]) == os.environ.get("GITHUB_RUN_ID") and
            str(candidate["runAttempt"]) == os.environ.get("GITHUB_RUN_ATTEMPT"), "CANDIDATE_RUN_MISMATCH")
    require(str(candidate["artifactId"]) == os.environ.get("CANDIDATE_ARTIFACT_ID") and
            str(candidate["producerCheckRunId"]) == os.environ.get("CANDIDATE_PRODUCER_CHECK_RUN_ID"),
            "CANDIDATE_PRODUCER_OUTPUT_MISMATCH")
    output_digest = os.environ.get("CANDIDATE_ARTIFACT_DIGEST", "").removeprefix("sha256:")
    require(re.fullmatch(r"[0-9a-f]{64}", output_digest) and
            candidate.get("artifactDigest") == "sha256:" + output_digest ==
            "sha256:" + candidate["artifactZipSha256"], "CANDIDATE_ARTIFACT_DIGEST_MISMATCH")
    require(all(re.fullmatch(r"[1-9][0-9]*", os.environ.get(key, ""))
                for key in ("TUI_JOB_ID", "CHECK_RUN_ID")), "TUI_JOB_ID_MISSING")
    require(str(candidate["producerJobId"]) != os.environ["TUI_JOB_ID"], "TUI_REUSED_PRODUCER_JOB")
    require(str(candidate["producerCheckRunId"]) != os.environ["CHECK_RUN_ID"], "TUI_REUSED_PRODUCER_ID")
    paths = candidate.get("paths")
    require(isinstance(paths, dict), "CANDIDATE_PATHS_MISSING")
    package = Path(paths["package"])
    require(package.is_absolute() and package.resolve() == root / "package", "CANDIDATE_PACKAGE_PATH")
    checked = {str(path): sha(raw)}
    for key in ("archive", "receipt", "inventory", "nativeReceipt", "compileProvenance",
                "compileEvidence", "cliSourceMapIndex", "cliSourceMaps"):
        item = Path(paths[key])
        require(item.is_absolute() and item.resolve().is_relative_to(package) and item.is_file(),
                "CANDIDATE_FILE_PATH_" + key)
        checked[str(item.resolve())] = file_sha(item)
    for key, digest_key in (("archive", "archiveSha256"), ("compileProvenance", "compileProvenanceSha256"),
                            ("compileEvidence", "compileEvidenceSha256"),
                            ("cliSourceMapIndex", "cliSourceMapIndexSha256"),
                            ("cliSourceMaps", "cliSourceMapsSha256")):
        require(checked[str(Path(paths[key]).resolve())] == candidate[digest_key],
                "CANDIDATE_FILE_DIGEST_" + key)
    require(Path(paths["archive"]).resolve() == archive, "CANDIDATE_ARCHIVE_PATH_MISMATCH")
    zipped = root / "artifact.zip"
    require(zipped.is_file() and file_sha(zipped) == candidate["artifactZipSha256"], "CANDIDATE_ZIP_CHANGED")
    checked[str(zipped)] = candidate["artifactZipSha256"]
    require(binary.is_relative_to(temporary) and binary.is_file() and
            file_sha(binary) == candidate["binarySha256"], "CANDIDATE_ELF_MISMATCH")
    with binary.open("rb") as stream:
        require(stream.read(4) == b"\x7fELF", "CANDIDATE_NOT_ELF")
    checked[str(binary)] = candidate["binarySha256"]
    provenance = json.loads(Path(paths["compileProvenance"]).read_text())
    require(provenance.get("schema") == "sf-linux-compile-provenance-v2" and
            provenance.get("sourceSHA") == candidate["sourceSHA"] and
            provenance.get("sourceTreeSHA") == candidate["sourceTreeSHA"] and
            provenance.get("workflowSHA") == candidate["workflowSHA"] and
            str(provenance.get("runId")) == str(candidate["runId"]) and
            str(provenance.get("runAttempt")) == str(candidate["runAttempt"]) and
            provenance.get("job") == "teams-profile-artifact" and
            str(provenance.get("checkRunId")) == str(candidate["producerCheckRunId"]),
            "CANDIDATE_PROVENANCE_IDENTITY_MISMATCH")
    require(provenance.get("archiveSha256") == candidate["archiveSha256"] and
            provenance.get("binary", {}).get("path") == "bin/orchestra" and
            provenance.get("binary", {}).get("sha256") == candidate["binarySha256"],
            "CANDIDATE_PROVENANCE_BYTES_MISMATCH")
    SOURCE, TREE, ELF, TAR = (candidate["sourceSHA"], candidate["sourceTreeSHA"],
                             candidate["binarySha256"], candidate["archiveSha256"])
    CANDIDATE, CANDIDATE_FILES = candidate, checked


def candidate_identity():
    require(CANDIDATE is not None, "CANDIDATE_NOT_BOUND")
    return {
        "candidateOrigin": "same-run-teams-profile-artifact",
        "candidateBindingSchema": CANDIDATE["schema"],
        "candidateBindingSha256": CANDIDATE_FILES[str(Path(os.environ["RUNNER_TEMP"]).resolve() /
                                                    "g09-candidate/candidate-binding.json")],
        "artifactId": str(CANDIDATE["artifactId"]),
        "artifactDigest": CANDIDATE["artifactDigest"],
        "artifactZipSha256": CANDIDATE["artifactZipSha256"],
        "producerJobId": str(CANDIDATE["producerJobId"]),
        "producerCheckRunId": str(CANDIDATE["producerCheckRunId"]),
        "compileProvenanceSha256": CANDIDATE["compileProvenanceSha256"],
        "candidateInputsSha256": CANDIDATE_FILES,
    }


def candidate_inputs_unchanged(binary, archive):
    return file_sha(binary) == ELF and file_sha(archive) == TAR and all(
        file_sha(Path(path)) == expected for path, expected in CANDIDATE_FILES.items()
    )


def private(path, data):
    raw = data if isinstance(data, bytes) else (json.dumps(data, indent=2, sort_keys=True) + "\n").encode()
    with open(path, "xb") as stream:
        os.chmod(path, 0o600)
        stream.write(raw)
    return {"file": path.name, "bytes": len(raw), "sha256": sha(raw)}


def environment(root):
    root.mkdir(mode=0o700)
    for name in ("home", "data", "config", "cache", "state", "tmp"):
        (root / name).mkdir(mode=0o700)
    private(root / "data/credential.key", base64.b64encode(secrets.token_bytes(32)))
    return {
        "PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": str(root / "home"), "LANG": "C.UTF-8",
        "TERM": "xterm-256color", "COLORTERM": "truecolor", "COLUMNS": "120", "LINES": "40",
        "XDG_DATA_HOME": str(root / "data"), "XDG_CONFIG_HOME": str(root / "config"),
        "XDG_CACHE_HOME": str(root / "cache"), "XDG_STATE_HOME": str(root / "state"),
        "TMPDIR": str(root / "tmp"), "ORCHESTRA_CONFIG_DIR": str(root / "config"),
        "ORCHESTRA_DB": str(root / "data/orchestra.db"),
        "ORCHESTRA_CREDENTIAL_KEY_FILE": str(root / "data/credential.key"),
        "ORCHESTRA_INHERIT_CREDENTIALS": "0", "ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER": "strict",
        "ORCHESTRA_DISABLE_AUTOUPDATE": "1", "ORCHESTRA_DISABLE_MODELS_FETCH": "1",
        "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null",
    }


def identity(pid, binary, argv):
    executable = Path(f"/proc/{pid}/exe")
    require(executable.resolve() == binary and file_sha(executable) == ELF, "PROCESS_ELF_MISMATCH")
    command = [os.fsdecode(part) for part in Path(f"/proc/{pid}/cmdline").read_bytes().split(b"\0") if part]
    require(command == argv, "PROCESS_ARGUMENTS_MISMATCH")
    require(os.readlink(f"/proc/{pid}/ns/net") == os.readlink("/proc/self/ns/net"), "PROCESS_NETWORK_NAMESPACE_MISMATCH")
    return {"pid": pid, "elfSha256": ELF, "argv": argv}


def main():
    parser = argparse.ArgumentParser()
    for option in ("binary", "archive", "runtime-dir", "output-dir", "binding"):
        parser.add_argument("--" + option, type=Path, required=True)
    args = parser.parse_args()
    args.binary, args.archive = args.binary.resolve(), args.archive.resolve()
    args.runtime_dir, args.output_dir = args.runtime_dir.resolve(), args.output_dir.resolve()
    bind_candidate(args.binding, args.binary, args.archive)
    temporary = Path(os.environ["RUNNER_TEMP"]).resolve()
    require(args.runtime_dir.is_relative_to(temporary) and args.output_dir.is_relative_to(temporary), "NON_TEMPORARY_PATH")
    require(args.runtime_dir != temporary and args.output_dir != temporary and
            not args.output_dir.is_relative_to(args.runtime_dir) and
            not args.runtime_dir.is_relative_to(args.output_dir), "OVERLAPPING_PATHS")
    os.umask(0o077)
    args.output_dir.mkdir(mode=0o700, parents=False, exist_ok=False)
    receipt = {
        "schema": "g09-candidate-generic-bootstrap-v1", "status": "fail", "formalG09Pass": False,
        **candidate_identity(), "sourceSHA": SOURCE, "sourceTreeSHA": TREE,
        "elfSha256": ELF, "tarSha256": TAR, "harnessSha256": file_sha(__file__),
        "runId": os.environ.get("GITHUB_RUN_ID"), "runAttempt": os.environ.get("GITHUB_RUN_ATTEMPT"),
        "jobId": os.environ.get("TUI_JOB_ID"), "checkRunId": os.environ.get("CHECK_RUN_ID"),
        "workflowSHA": os.environ.get("GITHUB_SHA"),
        "classifiedOccurrenceIds": [], "classifiedFindingIds": [], "rebuiltDuringProbe": False,
        "scope": "Exact installed CLI generic serve and real PTY attach bootstrap with normal Basic authentication",
        "notProven": ["Microsoft/Teams authorization", "PermissionV2 evaluation", "worktree create/move/remove",
                      "editor/export", "33 Solid endpoint attributions", "formal G09 acceptance"],
    }
    password = secrets.token_hex(32)
    authorization = "Basic " + base64.b64encode(("orchestra:" + password).encode()).decode()
    events, errors, processes, sockets, workers = [], [], {}, set(), set()
    lock, stopping, quitting = threading.Lock(), threading.Event(), threading.Event()
    proxy = thread = terminal = None
    transcript = bytearray()
    runtime_created = False
    server_log = args.runtime_dir / "server.log"

    def poll(pid):
        if processes[pid] is None:
            waited, status = os.waitpid(pid, os.WNOHANG)
            if waited:
                processes[pid] = status
        return processes[pid]

    def stop(pid):
        if poll(pid) is not None:
            return
        for sig, budget in ((signal.SIGTERM, 3), (signal.SIGKILL, 2)):
            try:
                os.killpg(pid, sig)
            except ProcessLookupError:
                pass
            until = time.monotonic() + budget
            while time.monotonic() < until and poll(pid) is None:
                time.sleep(0.05)
            if poll(pid) is not None:
                return
        raise RuntimeError("CHILD_CLEANUP_TIMEOUT")

    def health(port, header):
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=2)
        try:
            connection.request("GET", "/api/health", headers={"Authorization": header} if header else {})
            response = connection.getresponse()
            body = response.read(MAX_BYTES + 1)
            require(len(body) <= MAX_BYTES, "HEALTH_RESPONSE_LIMIT")
            return response.status, body
        finally:
            connection.close()

    try:
        require(os.environ.get("GITHUB_ACTIONS") == "true", "ACTIONS_ONLY")
        require(os.environ.get("GITHUB_REPOSITORY") == "gustavomhss/Orchestra-SF", "REPOSITORY_MISMATCH")
        require(all(re.fullmatch(r"[1-9][0-9]*", str(receipt[key] or "")) for key in ("runId", "runAttempt", "jobId")),
                "MISSING_EXECUTION_IDENTITY")
        require(re.fullmatch(r"[0-9a-f]{40}", str(receipt["workflowSHA"] or "")), "MISSING_WORKFLOW_SHA")
        require(os.geteuid() != 0, "PROBE_MUST_DROP_ROOT")
        require(os.getpid() == 1, "PROBE_MUST_OWN_PID_NAMESPACE")
        require({name for _, name in socket.if_nameindex()} == {"lo"}, "NETWORK_IS_NOT_LOOPBACK_ONLY")
        status = Path("/proc/self/status").read_text()
        require(all(re.search(r"^" + cap + r":\s+0+$", status, re.M) for cap in ("CapEff", "CapBnd", "CapInh", "CapAmb")) and
                re.search(r"^NoNewPrivs:\s+1$", status, re.M),
                "PROBE_PRIVILEGES_NOT_DROPPED")
        receipt["isolation"] = {"interfaces": ["lo"], "networkNamespace": os.readlink("/proc/self/ns/net"),
                                "pidNamespaceInit": os.getpid() == 1, "uid": os.geteuid(),
                                "noNewPrivileges": True, "effectiveCapabilities": "0"}
        require(candidate_inputs_unchanged(args.binary, args.archive), "CANDIDATE_INPUT_MISMATCH")
        args.runtime_dir.mkdir(mode=0o700, exist_ok=False)
        runtime_created = True
        workspace = args.runtime_dir / ("directory-" + secrets.token_hex(12))
        workspace.mkdir(mode=0o700)
        server_env, tui_env = environment(args.runtime_dir / "server"), environment(args.runtime_dir / "tui")
        server_env["ORCHESTRA_SERVER_PASSWORD"] = password
        tui_env.update({"ORCHESTRA_SERVER_PASSWORD": password, "ORCHESTRA_SERVER_USERNAME": "orchestra"})
        with socket.socket() as reservation:
            reservation.bind(("127.0.0.1", 0))
            port = reservation.getsockname()[1]
        server_argv = [str(args.binary), "serve", "--hostname", "127.0.0.1", "--port", str(port)]
        server = os.fork()
        if server == 0:
            try:
                os.setsid()
                os.chdir(workspace)
                with open(server_log, "xb", buffering=0) as log:
                    os.dup2(log.fileno(), 1)
                    os.dup2(log.fileno(), 2)
                    os.execve(args.binary, server_argv, server_env)
            except BaseException:
                os._exit(127)
        processes[server] = None
        deadline, ready = time.monotonic() + 30, False
        while time.monotonic() < deadline:
            require(poll(server) is None, "GENERIC_SERVER_EXITED")
            try:
                code, body = health(port, authorization)
                if code == 200:
                    require(json.loads(body).get("healthy") is True, "HEALTH_PAYLOAD_INVALID")
                    ready = True
                    break
                raise RuntimeError("GENERIC_SERVER_UNEXPECTED_STATUS")
            except (ConnectionError, TimeoutError, OSError, http.client.HTTPException):
                time.sleep(0.1)
        require(ready, "GENERIC_SERVER_START_TIMEOUT")
        receipt["serverProcess"] = identity(server, args.binary, server_argv)
        require(health(port, None)[0] == 401 and health(port, "Basic ZzA5OmludmFsaWQ=")[0] == 401,
                "GENERIC_BASIC_AUTH_CONTROL_FAILED")
        receipt["healthControls"] = {"origin": "harness-direct", "validBasic": 200, "missingBasic": 401, "wrongBasic": 401}

        class Proxy(http.server.BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *_):
                pass

            def forward(self):
                connection = stream_socket = None
                with lock:
                    workers.add(threading.current_thread())
                try:
                    require(self.command == "GET" and self.client_address[0] == "127.0.0.1", "UNEXPECTED_TUI_METHOD_OR_PEER")
                    require(self.path.startswith("/api/") and not self.headers.get("Transfer-Encoding") and
                            self.headers.get("Content-Length", "0") == "0", "UNEXPECTED_TUI_TARGET_OR_BODY")
                    require(self.headers.get("Authorization") == authorization and not self.headers.get("Cookie") and
                            not any(key.lower().startswith(("x-sf-", "x-forwarded-")) for key in self.headers),
                            "TUI_AUTHORITY_MISMATCH")
                    headers = {key: value for key, value in self.headers.items() if key.lower() not in HOP}
                    headers["Host"] = f"127.0.0.1:{port}"
                    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
                    connection.request("GET", self.path, headers=headers)
                    response = connection.getresponse()
                    stream_socket = response.fp.raw._sock
                    with lock:
                        sockets.add(stream_socket)
                    path = urllib.parse.urlsplit(self.path)
                    streaming = response.getheader("Content-Type", "").split(";", 1)[0] == "text/event-stream"
                    event = {"method": "GET", "path": path.path, "querySha256": sha(path.query.encode()),
                             "status": response.status, "source": "actual-upstream", "basicMatched": True,
                             "streaming": streaming, "delivered": False, "responseBytes": 0}
                    with lock:
                        require(len(events) < 100, "TUI_REQUEST_COUNT_LIMIT")
                        events.append(event)
                    body = b"" if streaming else response.read(MAX_BYTES + 1)
                    require(len(body) <= MAX_BYTES, "UPSTREAM_BODY_LIMIT")
                    self.send_response(response.status)
                    for key, value in response.getheaders():
                        if key.lower() not in HOP:
                            self.send_header(key, value)
                    if not streaming:
                        self.send_header("Content-Length", str(len(body)))
                    self.send_header("Connection", "close")
                    self.end_headers()
                    if streaming:
                        require(path.path == "/api/event", "UNEXPECTED_STREAMING_ROUTE")
                        stream_socket.settimeout(50)
                        capture = bytearray()
                        while not stopping.is_set():
                            chunk = response.read1(65536)
                            if not chunk:
                                break
                            capture.extend(chunk)
                            require(len(capture) <= MAX_BYTES, "SSE_CAPTURE_LIMIT")
                            self.wfile.write(chunk)
                            self.wfile.flush()
                            connected = False
                            for frame in bytes(capture).replace(b"\r\n", b"\n").split(b"\n\n")[:-1]:
                                data = b"\n".join(line[5:].lstrip() for line in frame.split(b"\n") if line.startswith(b"data:"))
                                if data:
                                    try:
                                        connected = connected or json.loads(data).get("type") == "server.connected"
                                    except (ValueError, AttributeError):
                                        pass
                            with lock:
                                event.update(delivered=True, responseBytes=len(capture),
                                             responseSha256=sha(capture), serverConnected=connected)
                    else:
                        self.wfile.write(body)
                        self.wfile.flush()
                        extra = {}
                        if path.path == "/api/location" and response.status == 200:
                            value = json.loads(body)
                            extra = {"locationMatched": value.get("directory") == str(workspace),
                                     "projectID": value.get("project", {}).get("id")}
                        if path.path == "/api/session" and response.status == 200:
                            extra["emptySessionList"] = json.loads(body).get("data") == []
                        with lock:
                            event.update(delivered=True, responseBytes=len(body), responseSha256=sha(body), **extra)
                except Exception as error:
                    requested_close = quitting.is_set() and isinstance(error, (BrokenPipeError, ConnectionResetError))
                    if not stopping.is_set() and not requested_close:
                        with lock:
                            errors.append(str(error) if isinstance(error, RuntimeError) else type(error).__name__)
                    self.close_connection = True
                finally:
                    if connection:
                        connection.close()
                    with lock:
                        if stream_socket:
                            sockets.discard(stream_socket)
                        workers.discard(threading.current_thread())

            do_GET = do_HEAD = do_POST = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = forward

        proxy = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Proxy)
        proxy.daemon_threads = True
        tui_argv = [str(args.binary), "attach", f"http://127.0.0.1:{proxy.server_port}", "--dir", str(workspace)]
        tui, terminal = pty.fork()
        if tui == 0:
            try:
                os.chdir(workspace)
                os.execve(args.binary, tui_argv, tui_env)
            except BaseException:
                os._exit(127)
        processes[tui] = None
        thread = threading.Thread(target=proxy.serve_forever, kwargs={"poll_interval": 0.05})
        thread.start()
        fcntl.ioctl(terminal, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 120, 0, 0))
        deadline, admitted_at, quit_at, second_quit = time.monotonic() + 45, None, None, False
        while time.monotonic() < deadline:
            if "tuiProcess" not in receipt:
                try:
                    if Path(f"/proc/{tui}/exe").resolve() == args.binary:
                        receipt["tuiProcess"] = identity(tui, args.binary, tui_argv)
                        require(os.readlink(f"/proc/{tui}/fd/0").startswith("/dev/pts/"), "TUI_NOT_A_PTY")
                except FileNotFoundError:
                    pass
            if select.select([terminal], [], [], 0.05)[0]:
                try:
                    transcript.extend(os.read(terminal, 65536))
                except OSError as error:
                    if error.errno != errno.EIO:
                        raise
            require(len(transcript) <= MAX_BYTES and b"tui bootstrap failed" not in transcript, "TUI_BOOTSTRAP_OR_CAPTURE_FAILED")
            require(poll(server) is None, "GENERIC_SERVER_EXITED_DURING_TUI")
            with lock:
                require(not errors, "PROXY_FAILURE")
                done = [event for event in events if event["delivered"] and event["status"] == 200]
                paths = {event["path"] for event in done}
                locations = [event for event in done if event.get("locationMatched") and event.get("projectID")]
                admitted = CATALOG.issubset(paths) and any(event.get("serverConnected") for event in done) and \
                    any(event.get("emptySessionList") for event in done) and any(
                        f"/api/project/{event['projectID']}/directories" in paths for event in locations)
            now = time.monotonic()
            if admitted and admitted_at is None:
                admitted_at = now
            if admitted_at is not None and quit_at is None and now - admitted_at >= 1:
                require(b"\x1b[" in transcript, "NO_TUI_RENDER_OUTPUT")
                quitting.set()
                os.write(terminal, b"\x03")
                receipt["quitRequestedViaKeyboard"] = ["Ctrl+C"]
                quit_at = now
            if quit_at is not None and not second_quit and now - quit_at >= 2 and poll(tui) is None:
                os.write(terminal, b"\x04")
                receipt["quitRequestedViaKeyboard"].append("Ctrl+D")
                second_quit = True
            if poll(tui) is not None:
                require(quit_at is not None and os.WIFEXITED(processes[tui]) and
                        os.WEXITSTATUS(processes[tui]) == 0, "TUI_EXITED_BEFORE_BOOTSTRAP_OR_FAILED")
                break
        tui_status = poll(tui)
        require(admitted_at is not None and quit_at is not None and tui_status is not None and
                os.WIFEXITED(tui_status) and os.WEXITSTATUS(tui_status) == 0 and "tuiProcess" in receipt,
                "TUI_BOOTSTRAP_OR_QUIT_TIMEOUT_OR_FAILED")
        require(identity(server, args.binary, server_argv) == receipt["serverProcess"], "SERVER_IDENTITY_CHANGED")
        require(health(port, authorization)[0] == 200, "SERVER_UNHEALTHY_AFTER_TUI")
        receipt.update(status="pass", genericBootstrapAdmitted=True, tuiExitedAfterRequestedKeys=True,
                       tuiExitCode=os.waitstatus_to_exitcode(tui_status))
    except Exception as error:
        receipt["failure"] = str(error) if isinstance(error, RuntimeError) else type(error).__name__
    finally:
        stopping.set()
        with lock:
            active_sockets = list(sockets)
        for connection in active_sockets:
            try:
                connection.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
        for pid in reversed(list(processes)):
            try:
                stop(pid)
            except Exception:
                receipt.update(status="fail", cleanupFailure=True)
        if terminal is not None:
            os.close(terminal)
        if proxy:
            if thread and thread.is_alive():
                proxy.shutdown()
            proxy.server_close()
        if thread:
            thread.join(timeout=2)
        with lock:
            active_workers = list(workers)
        until = time.monotonic() + 3
        for worker in active_workers:
            worker.join(timeout=max(0, until - time.monotonic()))
        with lock:
            if workers or errors or any(event["status"] != 200 or not event["delivered"] for event in events):
                receipt.update(status="fail", forwardingComplete=False)
            receipt["forwardingErrors"] = list(errors)
            receipt["network"] = private(args.output_dir / "tui.network.json", events)
        redactions = [password.encode(), authorization.encode(), authorization[6:].encode()]
        for name in ("server", "tui"):
            key = args.runtime_dir / name / "data/credential.key"
            if runtime_created and key.is_file():
                redactions.append(key.read_bytes().strip())
        for name, raw in (("tui.pty.raw", bytes(transcript)),
                          ("server.log", server_log.read_bytes() if server_log.is_file() else b"")):
            for secret in redactions:
                raw = raw.replace(secret, b"[fixture-secret-redacted]")
            receipt[name] = private(args.output_dir / name, raw[-MAX_BYTES:])
        try:
            receipt["candidateInputsUnchanged"] = candidate_inputs_unchanged(args.binary, args.archive)
            require(receipt["candidateInputsUnchanged"], "INPUT_CHANGED")
            if runtime_created:
                shutil.rmtree(args.runtime_dir)
            receipt["temporaryRuntimeRemoved"] = runtime_created and not args.runtime_dir.exists()
        except Exception:
            receipt.update(status="fail", cleanupFailure=True)
        receipt["processes"] = [{"pid": pid, "waitStatus": value} for pid, value in processes.items()]
        private(args.output_dir / "generic-bootstrap-proof.json", receipt)
        print(json.dumps({"status": receipt["status"], "formalG09Pass": False,
                          "failure": receipt.get("failure"), "receipt": "generic-bootstrap-proof.json"}))
    return 0 if receipt["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
