#!/usr/bin/env python3
"""Run the exact installed ELF's TUI attach against the real Microsoft host.

CI-only supplemental boundary proof. No rebuild, generic daemon, fake 403,
terminal screenshot verdict, signed sidecar, or automatic G09 ID disposition.
HTTP login/context calls below are explicitly setup/health controls.
"""
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
import secrets
import select
import signal
import struct
import sys
import termios
import threading
import time
import urllib.parse

SOURCE = "3ef84da65d6b8ad7cd3250412bbcabdf90924172"
TREE = "48d57887656fd2e325dee97a7c066bcb8e84bbc8"
ELF = "ff145b04dc0897b32b7cdd904cf3bba7d793cf4a391d3c02325d3c6125006a9f"
TAR = "dc11455bbcce4565b24cdca53ce3e5ab05f883757f6c0765910a0e4c98147d83"
FACTORY = "459919556ccc1381554cc62122831828ebc2acc816344206a5a0be11abe6a87f"
PROVIDER = "c272473a9b98cb5231348a31576900b6e362b6fc692cbc9a728b4bc92264777f"
TEAM = "44444444-4444-4444-8444-444444444444"
CATALOG = {"/api/provider", "/api/model", "/api/model/default", "/api/agent", "/api/config"}
CASE = "Installed TUI attach cannot bootstrap generic APIs through the dedicated Microsoft Team host"
MAX_BYTES = 4 * 1024 * 1024


def require(condition, reason):
    if not condition:
        raise RuntimeError(reason)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def file_digest(path):
    result = hashlib.sha256()
    with open(path, "rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def write_private(path, value):
    data = value if isinstance(value, bytes) else (json.dumps(value, sort_keys=True, indent=2) + "\n").encode()
    with open(path, "xb") as output:
        os.chmod(path, 0o600)
        output.write(data)
    return {"file": path.name, "sha256": digest(data), "bytes": len(data)}


def process_identity(pid, binary):
    path = Path("/proc") / str(pid) / "exe"
    require(path.resolve() == binary, "Running process is not the installed binary")
    require(file_digest(path) == ELF, "Running process ELF differs from the frozen candidate")
    return {"pid": pid, "elfSha256": ELF}


def business_files(runtime):
    result = {}
    for name in ("business", "business-teams"):
        directory = runtime / "installation" / name
        if not directory.exists():
            continue
        for path in sorted(directory.rglob("*")):
            require(not path.is_symlink(), "Business evidence contains a symlink")
            if path.is_file():
                result[str(path.relative_to(runtime))] = file_digest(path)
    return result


def request(port, proof, path, cookie=None, trusted=True):
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=20)
    headers = {"Host": f"sf-ingress.example.test:{port}", "Accept": "application/json"}
    if trusted:
        headers["x-sf-ingress-proof"] = proof
    if cookie:
        headers["Cookie"] = cookie
    try:
        connection.request("GET", path, headers=headers)
        response = connection.getresponse()
        body = response.read(MAX_BYTES + 1)
        require(len(body) <= MAX_BYTES, "Control response exceeds bounded evidence size")
        return response.status, response.getheaders(), body
    finally:
        connection.close()


def sign_in(port, proof, identity):
    status, headers, _ = request(port, proof, "/sucafina/auth/login?returnTo=%2F")
    require(status == 303, "Synthetic login start did not use the real Microsoft flow")
    authority = urllib.parse.urlsplit(dict(headers)["Location"] if "Location" in dict(headers) else
                                      next(value for key, value in headers if key.lower() == "location"))
    require(authority.scheme == "https" and authority.netloc == "login.microsoftonline.com", "Unexpected Entra authority")
    params = urllib.parse.parse_qs(authority.query, strict_parsing=True)
    for name in ("nonce", "code_challenge", "state", "redirect_uri"):
        require(len(params.get(name, [])) == 1, "Incomplete or ambiguous OAuth control")
    require(params["redirect_uri"][0] == "https://sf.example.test/sucafina/auth/callback", "Wrong callback origin")
    login = next(value for key, value in headers if key.lower() == "set-cookie" and "_login=" in value)
    require("; Secure" in login, "Login control lost Secure")
    query = urllib.parse.urlencode({
        "code": ".".join((identity, params["nonce"][0], params["code_challenge"][0])),
        "state": params["state"][0],
    })
    status, headers, _ = request(port, proof, "/sucafina/auth/callback?" + query, login.split(";")[0])
    require(status == 303, "Real installed callback rejected the synthetic remote provider")
    session = next(value for key, value in headers if key.lower() == "set-cookie" and "_session=" in value)
    require("; Secure" in session and "; HttpOnly" in session, "Session control lost its cookie flags")
    return session.split(";")[0]


def controls(port, proof):
    require(request(port, proof, "/sucafina/dashboard", trusted=False)[0] == 403, "Untrusted ingress control was not denied")
    status, _, body = request(port, proof, "/api/sucafina/installations?select=current&contractRevision=sf-team-profile%2F1")
    require(status == 200, "Actual native installation discovery did not answer")
    entries = json.loads(body)["installations"]
    require(len(entries) == 1, "Ambiguous installation control")
    binding = entries[0]
    require(binding["publicOrigin"] == "https://sf.example.test" and binding["mount"] == "/sucafina", "Wrong installed identity")
    query = urllib.parse.urlencode({
        "contractRevision": binding["contractRevision"], "installationId": binding["installationId"],
        "tenantId": binding["tenantId"], "hostId": binding["hostId"], "kind": "team", "teamObjectId": TEAM,
    })
    path = "/sucafina/api/ui/context?" + query
    require(request(port, proof, path)[0] == 401, "Anonymous Team context control was not denied")
    allowed = sign_in(port, proof, "allowed")
    status, _, body = request(port, proof, path, allowed)
    value = json.loads(body)
    require(status == 200 and value["status"] == "ok" and
            value["value"]["profile"]["teams"]["selected"]["teamObjectId"] == TEAM,
            "Real admitted Team context positive control failed")
    denied = sign_in(port, proof, "denied")
    status, _, body = request(port, proof, path, denied)
    require(status == 403 and json.loads(body) == {"status": "denied"}, "No-Team control failed")
    return {"kind": "http-setup-controls-not-tui", "syntheticEntra": True,
            "untrustedIngress": 403, "anonymousContext": 401, "admittedTeamContext": 200, "noTeamContext": 403}


def run_tui(args, root, basic, proof):
    name = "basic-is-not-team-authority" if basic else "no-corporate-session"
    nonce = secrets.token_hex(16)
    case_dir = root / (name + "-" + nonce)
    case_dir.mkdir(mode=0o700)
    for name_part in ("home", "data", "config", "cache", "state", "tmp", "directory"):
        (case_dir / name_part).mkdir(mode=0o700)
    write_private(case_dir / "data" / "credential.key", base64.b64encode(secrets.token_bytes(32)))
    password = secrets.token_hex(24)
    expected_authorization = "Basic " + base64.b64encode(("g09:" + password).encode()).decode() if basic else None
    events = []
    failures = []
    lock = threading.Lock()

    class Proxy(http.server.BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *_):
            pass

        def forward(self):
            connection = None
            observed = False
            try:
                require(self.client_address[0] == "127.0.0.1", "Non-loopback proxy peer")
                require(self.path.startswith("/") and not self.path.startswith("//"), "Non-origin request target")
                require(not self.headers.get("Transfer-Encoding"), "Unexpected chunked TUI request")
                length = int(self.headers.get("Content-Length", "0"))
                require(0 <= length <= MAX_BYTES, "Unbounded TUI request")
                incoming = self.rfile.read(length) if length else None
                require(self.headers.get("Authorization") == expected_authorization, "TUI credential mode differs from invocation")
                require(not self.headers.get("Cookie"), "TUI unexpectedly supplied a corporate cookie")
                hop = {"connection", "proxy-connection", "keep-alive", "transfer-encoding", "upgrade",
                       "host", "x-sf-ingress-proof", "forwarded"}
                headers = {key: value for key, value in self.headers.items()
                           if key.lower() not in hop and not key.lower().startswith("x-forwarded-")}
                # The observer acts as the same loopback ingress boundary as the producer.
                # It never supplies a user session, Team selector, fabricated response, or route result.
                headers["Host"] = f"sf-ingress.example.test:{args.port}"
                headers["x-sf-ingress-proof"] = proof
                connection = http.client.HTTPConnection("127.0.0.1", args.port, timeout=15)
                connection.request(self.command, self.path, body=incoming, headers=headers)
                upstream = connection.getresponse()
                body = upstream.read(MAX_BYTES + 1)
                require(len(body) <= MAX_BYTES, "Unbounded TUI upstream response")
                split = urllib.parse.urlsplit(self.path)
                event = {"method": self.command, "path": split.path, "querySha256": digest(split.query.encode()),
                         "invocationDirectoryObserved": nonce in urllib.parse.unquote(self.path),
                         "hasBasic": basic, "hasCorporateCookie": False, "status": upstream.status,
                         "responseBytes": len(body), "responseSha256": digest(body), "source": "actual-upstream"}
                with lock:
                    events.append(event)
                observed = True
                self.send_response(upstream.status)
                for key, value in upstream.getheaders():
                    if key.lower() not in hop and key.lower() != "content-length":
                        self.send_header(key, value)
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Connection", "close")
                self.end_headers()
                try:
                    self.wfile.write(body)
                except (BrokenPipeError, ConnectionResetError):
                    pass
            except (BrokenPipeError, ConnectionResetError) as error:
                if not observed:
                    with lock:
                        failures.append(type(error).__name__ + ": upstream result not observed")
                self.close_connection = True
            except Exception as error:
                with lock:
                    failures.append(type(error).__name__ + ": " + str(error))
                self.close_connection = True
            finally:
                if connection:
                    connection.close()

        do_GET = do_HEAD = do_POST = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = forward

    proxy = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Proxy)
    proxy.daemon_threads = False
    argv = [str(args.binary), "attach", f"http://127.0.0.1:{proxy.server_port}", "--dir", str(case_dir / "directory")]
    if basic:
        argv += ["--username", "g09", "--password", password]
    environment = {
        "PATH": os.environ["PATH"], "HOME": str(case_dir / "home"), "LANG": "C.UTF-8",
        "TERM": "xterm-256color", "COLORTERM": "truecolor", "COLUMNS": "120", "LINES": "40",
        "XDG_DATA_HOME": str(case_dir / "data"), "XDG_CONFIG_HOME": str(case_dir / "config"),
        "XDG_CACHE_HOME": str(case_dir / "cache"), "XDG_STATE_HOME": str(case_dir / "state"),
        "TMPDIR": str(case_dir / "tmp"), "ORCHESTRA_CONFIG_DIR": str(case_dir / "config"),
        "ORCHESTRA_DB": str(case_dir / "data" / "orchestra.db"),
        "ORCHESTRA_CREDENTIAL_KEY_FILE": str(case_dir / "data" / "credential.key"),
        "ORCHESTRA_INHERIT_CREDENTIALS": "0", "ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER": "strict",
    }
    # Fork before starting the observer's thread; the child only chdirs and execs.
    pid, terminal = pty.fork()
    if pid == 0:
        os.chdir(case_dir / "directory")
        os.execve(args.binary, argv, environment)
    thread = threading.Thread(target=proxy.serve_forever)
    thread.start()
    fcntl.ioctl(terminal, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 120, 0, 0))
    transcript = bytearray()
    identity = None
    status = None
    natural_exit = False
    terminal_open = True
    deadline = time.monotonic() + 45
    try:
        while time.monotonic() < deadline:
            if identity is None:
                try:
                    path = Path("/proc") / str(pid) / "exe"
                    if path.resolve() == args.binary:
                        identity = process_identity(pid, args.binary)
                        require(os.readlink(f"/proc/{pid}/fd/0").startswith("/dev/pts/"), "TUI stdin is not an actual PTY")
                except FileNotFoundError:
                    pass
            if terminal_open and select.select([terminal], [], [], 0.05)[0]:
                try:
                    chunk = os.read(terminal, 65536)
                    transcript.extend(chunk)
                    terminal_open = bool(chunk)
                except OSError as error:
                    if error.errno != errno.EIO:
                        raise
                    terminal_open = False
                require(len(transcript) <= MAX_BYTES, "TUI transcript exceeded bounded capture")
            if status is None:
                waited, observed = os.waitpid(pid, os.WNOHANG)
                if waited:
                    status = observed
            if status is not None and not terminal_open:
                break
        natural_exit = status is not None
    finally:
        if status is None:
            try:
                os.killpg(pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            for _ in range(40):
                waited, observed = os.waitpid(pid, os.WNOHANG)
                if waited:
                    status = observed
                    break
                time.sleep(0.05)
            if status is None:
                os.killpg(pid, signal.SIGKILL)
                os.waitpid(pid, 0)
        os.close(terminal)
        proxy.shutdown()
        proxy.server_close()
        thread.join(timeout=5)
        terminal_record = write_private(root / (name + ".pty.raw"), bytes(transcript))
        network_record = write_private(root / (name + ".network.json"), events)
        write_private(root / (name + ".observed.json"), {
            "naturalExit": natural_exit, "process": identity, "waitStatus": status,
            "forwardingFailures": failures, "terminal": terminal_record, "network": network_record,
        })
    require(natural_exit, "TUI did not terminate naturally after bootstrap rejection")
    require(not terminal_open, "PTY remained open after the TUI process exited")
    require(identity is not None, "Did not observe the exact running TUI ELF")
    require(os.WIFEXITED(status), "TUI terminated by a signal")
    require(not failures, "Proxy forwarding failed: " + "; ".join(failures))
    require(transcript and (b"\x1b[" in transcript or b"tui bootstrap failed" in transcript), "No terminal initialization evidence")
    paths = {event["path"] for event in events}
    require("/api/location" in paths and paths.intersection(CATALOG), "Actual TUI project/catalog bootstrap was not observed")
    require(any(event["invocationDirectoryObserved"] for event in events), "TUI request did not carry the invocation-specific directory")
    require(all(event["method"] == "GET" and event["path"].startswith("/api/") and
                event["status"] == 404 and event["responseBytes"] == 0 for event in events),
            "Dedicated host exposed data, effects, or an unexpected result to the generic TUI")
    return {"name": name, "status": "pass", "nonce": nonce, "process": identity,
            "exitCode": os.waitstatus_to_exitcode(status), "bootstrapRequests": sorted(paths),
            "terminal": terminal_record, "network": network_record,
            "genericBootstrapDenied": True, "corporateSessionSuppliedToTui": False,
            "tuiWorktreeFlowsExecuted": False}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--binary", type=Path, required=True)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--factory", type=Path, required=True)
    parser.add_argument("--provider", type=Path, required=True)
    parser.add_argument("--runtime-dir", type=Path, required=True)
    parser.add_argument("--server-pid", type=int, required=True)
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    require(sys.platform == "linux" and os.environ.get("GITHUB_ACTIONS") == "true", "GitHub Actions Linux is required")
    require(os.environ.get("GITHUB_REPOSITORY") == "gustavomhss/Orchestra-SF" and
            os.environ.get("RUNNER_ARCH") == "X64", "Wrong repository or runner architecture")
    for name in ("GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT", "CHECK_RUN_ID"):
        value = os.environ.get(name, "")
        require(value.isascii() and value.isdigit() and int(value) > 0, "Missing concrete job identity: " + name)
    require(os.environ.get("SOURCE_REVISION") == SOURCE, "Wrong frozen product source")
    workflow = os.environ.get("GITHUB_SHA", "")
    require(len(workflow) == 40 and all(char in "0123456789abcdef" for char in workflow), "Missing workflow commit")
    proof = os.environ.get("CI_PROOF", "")
    require(len(proof) == 64 and all(char in "0123456789abcdef" for char in proof), "Missing fixture ingress secret")
    args.binary = args.binary.resolve(strict=True)
    args.factory = args.factory.resolve(strict=True)
    args.provider = args.provider.resolve(strict=True)
    args.runtime_dir = args.runtime_dir.resolve(strict=True)
    require(file_digest(args.binary) == ELF and file_digest(args.archive) == TAR, "Frozen candidate hash mismatch")
    require(file_digest(args.factory) == FACTORY and file_digest(args.provider) == PROVIDER,
            "Packaged Microsoft factory or producer provider hash mismatch")
    server = process_identity(args.server_pid, args.binary)
    command = Path(f"/proc/{args.server_pid}/cmdline").read_bytes().split(b"\0")
    require(b"serve" in command and b"--installation" in command, "Observed server is not the explicit installation host")
    require(command.count(b"--hostname") == 1 and command[command.index(b"--hostname") + 1] == b"127.0.0.1" and
            command.count(b"--port") == 1 and command[command.index(b"--port") + 1] == str(args.port).encode(),
            "Observed host does not own the tested loopback endpoint")
    require(command.count(b"--installation") == 1, "Ambiguous installation arguments")
    require(command[command.index(b"--installation") + 1] == os.fsencode(args.provider),
            "Observed server is not using the frozen producer provider")
    environment = dict(entry.split(b"=", 1) for entry in
                       Path(f"/proc/{args.server_pid}/environ").read_bytes().split(b"\0") if b"=" in entry)
    require(environment.get(b"SF_PROOF_FACTORY") == os.fsencode(args.factory),
            "Observed provider is not attached to the packaged factory")
    require(environment.get(b"SUCAFINA_MICROSOFT_CONFIG") ==
            os.fsencode(args.runtime_dir / "installation" / "installation.json"),
            "Observed host has a different installation configuration")
    args.output_dir.mkdir(mode=0o700, parents=False, exist_ok=False)
    os.umask(0o077)
    observed_controls = controls(args.port, proof)
    before = business_files(args.runtime_dir)
    results = [run_tui(args, args.output_dir, basic, proof) for basic in (False, True)]
    after = business_files(args.runtime_dir)
    require(before == after, "TUI changed files under the inspected business stores")
    require(process_identity(args.server_pid, args.binary) == server, "Microsoft host identity changed")
    # The source's Tui.run prints the bootstrap reason but can exit 0. Status is
    # recorded, never used alone as proof of either permission or successful UI.
    receipt = {
        "schema": "sf-g09-installed-tui-boundary-v1", "status": "pass", "caseName": CASE,
        "artifactId": "14722264806", "sourceSHA": SOURCE, "sourceTreeSHA": TREE,
        "tarSha256": TAR, "elfSha256": ELF,
        "factorySha256": FACTORY, "providerSha256": PROVIDER,
        "runId": os.environ["GITHUB_RUN_ID"], "runAttempt": os.environ["GITHUB_RUN_ATTEMPT"],
        "jobId": os.environ["CHECK_RUN_ID"], "workflowSHA": workflow,
        "harnessSha256": file_digest(__file__), "serverProcess": server,
        "controls": observed_controls, "cases": results,
        "businessFilesUnchanged": True, "businessFilesBefore": before, "businessFilesAfter": after,
        "classifiedOccurrenceIds": [], "classifiedFindingIds": [],
        "scope": "Actual installed TUI bootstrap rejected by the dedicated Microsoft host; no corporate TUI positive",
        "notProven": ["worktree create/move/remove/force-remove", "editor/export",
                      "complete authorization coverage", "33 Solid endpoint attributions", "formal G09 PASS"],
    }
    record = write_private(args.output_dir / "tui-boundary-proof.json", receipt)
    print(json.dumps({"caseName": CASE, "status": "pass", "receipt": record}, sort_keys=True))


if __name__ == "__main__":
    main()
