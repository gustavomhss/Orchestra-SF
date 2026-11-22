#!/usr/bin/env python3
"""Read-only G08 host witness. Never installs, selects releases, restarts or rolls back."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import http.client
import ipaddress
import importlib.util
import json
import os
from pathlib import Path
import pwd
import re
import stat
import ssl
import socket
import struct
import subprocess
import sys
import urllib.request
from urllib.parse import urlsplit

ARCHIVE = "orchestra-sf-entra-linux-x64-baseline.tar.gz"
UNIT = "orchestra-sf.service"
REPOSITORY = Path(__file__).resolve().parents[2]
INSTALLER = REPOSITORY / "sf/azure/vm/install-factory-distribution.py"
IMDS = "http://169.254.169.254/metadata/instance/compute?api-version=2025-04-07"


def require(condition, code):
    if not condition:
        raise RuntimeError(code)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "G08_DUPLICATE_JSON_KEY")
        result[key] = value
    return result


def parse_json(raw):
    return json.loads(raw, object_pairs_hook=unique_object)


def private_root(value):
    root = Path(value)
    info = root.lstat()
    require(root.is_absolute() and root.resolve() == root and not root.is_symlink() and
            stat.S_ISDIR(info.st_mode) and stat.S_IMODE(info.st_mode) == 0o700 and info.st_uid == os.getuid(),
            "G08_PRIVATE_ROOT_REQUIRED")
    workspace = os.environ.get("GITHUB_WORKSPACE")
    require(not workspace or not root.is_relative_to(Path(workspace).resolve()), "G08_PRIVATE_ROOT_OUTSIDE_CHECKOUT")
    return root


@contextmanager
def private_file(root, name, maximum):
    require(re.fullmatch(r"[a-z0-9][a-z0-9.-]*", name), "G08_PRIVATE_FILE_NAME")
    file = root / name
    before = file.lstat()
    require(stat.S_ISREG(before.st_mode) and not file.is_symlink() and before.st_nlink == 1 and
            before.st_uid == os.getuid() and stat.S_IMODE(before.st_mode) == 0o600 and
            0 < before.st_size <= maximum, "G08_PRIVATE_FILE_REQUIRED")
    with os.fdopen(os.open(file, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), "rb") as reader:
        after = os.fstat(reader.fileno())
        require((before.st_dev, before.st_ino, before.st_mode, before.st_uid, before.st_size) ==
                (after.st_dev, after.st_ino, after.st_mode, after.st_uid, after.st_size) and after.st_nlink == 1,
                "G08_PRIVATE_FILE_CHANGED")
        yield reader, after.st_size


def private_json(root, name, maximum=5_000_000):
    with private_file(root, name, maximum) as (reader, size):
        raw = reader.read()
    require(len(raw) == size, "G08_PRIVATE_READ_CHANGED")
    return parse_json(raw), raw


def stream_digest(reader):
    result = hashlib.sha256()
    for chunk in iter(lambda: reader.read(1024 * 1024), b""):
        result.update(chunk)
    return result.hexdigest()


def parse_process(properties, candidate, process_root):
    require(set(properties) == {"MainPID", "ActiveState", "SubState"} and
            properties["ActiveState"] == "active" and properties["SubState"] == "running" and
            re.fullmatch(r"[1-9][0-9]*", properties["MainPID"]), "G08_RUNNING_SERVICE_REQUIRED")
    pid = int(properties["MainPID"])
    proc = process_root / str(pid)
    exe = os.readlink(proc / "exe")
    require(exe == "/opt/orchestra-sf/releases/" + candidate + "/bin/orchestra", "G08_RUNNING_EXE_NOT_INSTALLED_CANDIDATE")
    fields = (proc / "stat").read_text().rsplit(") ", 1)[1].split()
    require(len(fields) > 19 and re.fullmatch(r"[1-9][0-9]*", fields[19]), "G08_PROCESS_START_REQUIRED")
    cgroups = (proc / "cgroup").read_text().splitlines()
    require(any(line.split(":", 2)[-1] == "/system.slice/" + UNIT for line in cgroups), "G08_PROCESS_NOT_IN_SERVICE_CGROUP")
    uid = next((line.split()[1:] for line in (proc / "status").read_text().splitlines() if line.startswith("Uid:")), [])
    expected_uid = pwd.getpwnam("orchestra-sf").pw_uid
    require(expected_uid != 0 and uid == [str(expected_uid)] * 4, "G08_NONPRIVILEGED_SERVICE_REQUIRED")
    return {"unit": UNIT, "pid": pid, "activeState": properties["ActiveState"], "subState": properties["SubState"],
            "exe": exe, "startTicks": fields[19]}


def running_process(candidate):
    response = subprocess.run(
        ["/usr/bin/systemctl", "show", "--property=MainPID", "--property=ActiveState", "--property=SubState", UNIT],
        check=False, capture_output=True, text=True, timeout=15)
    require(response.returncode == 0, "G08_SERVICE_OBSERVATION_FAILED")
    lines = response.stdout.splitlines()
    require(len(lines) == 3 and all("=" in line for line in lines), "G08_SERVICE_PROPERTIES_INVALID")
    result = parse_process(dict(line.split("=", 1) for line in lines), candidate, Path("/proc"))
    boot_id = Path("/proc/sys/kernel/random/boot_id").read_text().strip()
    require(re.fullmatch(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", boot_id), "G08_BOOT_ID_REQUIRED")
    result["bootId"] = boot_id
    return result



def bounded_process_bytes(file, maximum):
    with file.open("rb") as reader:
        raw = reader.read(maximum + 1)
    require(0 < len(raw) <= maximum, "G08_PROCESS_METADATA_TOO_LARGE")
    return raw


def service_input(file, owner, maximum):
    require(file.is_absolute() and file.resolve() == file and file.parent.resolve() == file.parent,
            "G08_SERVICE_CONFIG_PATH_REQUIRED")
    directory = file.parent.stat()
    require(directory.st_uid == owner and stat.S_ISDIR(directory.st_mode) and
            stat.S_IMODE(directory.st_mode) == 0o700, "G08_PRIVATE_SERVICE_DIRECTORY_REQUIRED")
    with os.fdopen(os.open(file, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), "rb") as reader:
        info = os.fstat(reader.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_uid == owner and
                stat.S_IMODE(info.st_mode) == 0o600 and 0 < info.st_size <= maximum, "G08_PRIVATE_SERVICE_FILE_REQUIRED")
        raw = reader.read(maximum + 1)
    require(len(raw) == info.st_size, "G08_SERVICE_FILE_CHANGED")
    return raw


def validate_launch(argv, exe, factory_real, factory_sha, package):
    expected_factory = "/opt/orchestra-sf/releases/" + package["candidate"]["sha"] + "/bin/local/entry.mjs"
    require(len(argv) == 8 and argv[1:7] == ["serve", "--hostname", "127.0.0.1", "--port", "4096", "--installation"] and
            Path(argv[0]).is_absolute() and Path(argv[7]).is_absolute(), "G08_ORIGINAL_SERVICE_ARGV_REQUIRED")
    require(exe == "/opt/orchestra-sf/releases/" + package["candidate"]["sha"] + "/bin/orchestra" and
            factory_real == expected_factory and package["factory"]["path"] == "bin/local/entry.mjs" and
            factory_sha == package["factory"]["sha256"], "G08_RUNNING_FACTORY_MISMATCH")
    return expected_factory


def validate_configuration(config, target):
    require(config.get("version") == 1 and config.get("deployment") == "azure-https" and
            config.get("authentication") == "microsoft" and config.get("teams") == "direct" and
            config.get("origin") == target["publicOrigin"] and config.get("mount") == target["mount"] and
            config.get("tenantId", "").lower() == target["tenantId"] and
            config.get("listenerOrigin") == "http://127.0.0.1:4096", "G08_LOADED_DESCRIPTOR_TARGET_MISMATCH")
    ingress = urlsplit(config["ingressOrigin"])
    require(ingress.scheme == "http" and ingress.hostname and not ingress.username and not ingress.password and
            config["ingressOrigin"] == "http://" + ingress.netloc, "G08_INGRESS_ORIGIN_INVALID")
    return ingress.netloc


def listener_from_tables(tcp, tcp6, owned):
    listeners = []
    for family, table in [("v4", tcp), ("v6", tcp6)]:
        for row in table.splitlines()[1:]:
            fields = row.split()
            require(len(fields) >= 10, "G08_SOCKET_TABLE_INVALID")
            if fields[3] == "0A" and fields[1].split(":")[-1].upper() == "1000":
                listeners.append((family, fields[1].upper(), fields[9]))
    require(len(listeners) == 1 and listeners[0][0] == "v4" and listeners[0][1] == "0100007F:1000" and
            listeners[0][2] in owned, "G08_UNIQUE_PID_LOOPBACK_LISTENER_REQUIRED")
    return listeners[0][2]


def listener_socket(pid):
    proc = Path("/proc") / str(pid)
    require((Path("/proc/self/ns/net")).stat().st_ino == (proc / "ns/net").stat().st_ino,
            "G08_OBSERVER_AND_SERVICE_NETWORK_NAMESPACE_DIFFER")
    owned = set()
    for file in (proc / "fd").iterdir():
        try:
            value = os.readlink(file)
        except FileNotFoundError:
            continue  # Unrelated file descriptors may close while observing; the listening inode must still exist.
        match = re.fullmatch(r"socket:\[([1-9][0-9]*)\]", value)
        if match:
            owned.add(match[1])
    return listener_from_tables((proc / "net/tcp").read_text(), (proc / "net/tcp6").read_text(), owned)


def validate_discovery(value, target):
    require(isinstance(value, dict) and isinstance(value.get("installations"), list) and
            len(value["installations"]) == 1, "G08_UNIQUE_ORIGINAL_DISCOVERY_REQUIRED")
    descriptor = value["installations"][0]
    expected = {
        "contractRevision": "sf-team-profile/1", "authMode": "microsoft",
        "installationId": target["installationId"], "tenantId": target["tenantId"],
        "projectId": target["projectId"], "hostId": target["hostId"],
        "publicOrigin": target["publicOrigin"], "mount": target["mount"],
    }
    require(descriptor == expected, "G08_ORIGINAL_DISCOVERY_TARGET_MISMATCH")
    return descriptor


def discovery_request(connection, host, proof=None, assigned=None):
    # The only credential header is sent to the already verified loopback listener.
    headers = {"Host": host, "Cache-Control": "no-cache", "Pragma": "no-cache", "Accept": "application/json"}
    if proof is not None:
        require(isinstance(connection, http.client.HTTPConnection) and
                not isinstance(connection, http.client.HTTPSConnection) and connection.host == "127.0.0.1" and
                connection.port == 4096, "G08_INGRESS_PROOF_MUST_STAY_LOOPBACK")
        headers["X-SF-Ingress-Proof"] = proof
    try:
        connection.connect()
        if assigned is not None:
            require(isinstance(connection, http.client.HTTPSConnection) and
                    str(ipaddress.ip_address(connection.sock.getpeername()[0])) in assigned,
                    "G08_HTTPS_PEER_NOT_RESERVED_VM")
        connection.request("GET", "/api/sucafina/installations?select=current&contractRevision=sf-team-profile%2F1", headers=headers)
        response = connection.getresponse()
        require(response.status == 200 and response.getheader("Content-Type", "").split(";")[0].lower() == "application/json",
                "G08_ORIGINAL_DISCOVERY_HTTP_FAILED")
        raw = response.read(65537)
        require(len(raw) <= 65536, "G08_DISCOVERY_TOO_LARGE")
        return parse_json(raw)
    finally:
        connection.close()



def assigned_addresses():
    endpoint = "http://169.254.169.254/metadata/instance/network?api-version=2025-04-07"
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    with opener.open(urllib.request.Request(endpoint, headers={"Metadata": "true"}), timeout=15) as response:
        require(response.status == 200 and response.url == endpoint, "G08_IMDS_NETWORK_UNAVAILABLE")
        raw = response.read(131073)
    require(len(raw) <= 131072, "G08_IMDS_NETWORK_TOO_LARGE")
    result = set()
    for interface in parse_json(raw)["interface"]:
        for family in ["ipv4", "ipv6"]:
            for address in interface.get(family, {}).get("ipAddress", []):
                for key in ["privateIpAddress", "publicIpAddress", "ipAddress"]:
                    value = address.get(key)
                    if value:
                        parsed = ipaddress.ip_address(value)
                        require(not parsed.is_loopback and not parsed.is_unspecified, "G08_IMDS_INTERFACE_ADDRESS_INVALID")
                        result.add(str(parsed))
    require(result, "G08_IMDS_ASSIGNED_ADDRESS_REQUIRED")
    return sorted(result)


def caddy_process():
    response = subprocess.run(
        ["/usr/bin/systemctl", "show", "--property=MainPID", "--property=ActiveState", "--property=SubState", "caddy.service"],
        check=False, capture_output=True, text=True, timeout=15)
    require(response.returncode == 0, "G08_CADDY_SERVICE_UNAVAILABLE")
    values = dict(line.split("=", 1) for line in response.stdout.splitlines())
    require(set(values) == {"MainPID", "ActiveState", "SubState"} and values["ActiveState"] == "active" and
            values["SubState"] == "running" and re.fullmatch(r"[1-9][0-9]*", values["MainPID"]), "G08_CADDY_NOT_RUNNING")
    pid, uid = int(values["MainPID"]), pwd.getpwnam("caddy").pw_uid
    proc = Path("/proc") / str(pid)
    require(uid != 0 and os.readlink(proc / "exe") == "/usr/bin/caddy" and
            (proc / "ns/net").stat().st_ino == Path("/proc/self/ns/net").stat().st_ino, "G08_ORIGINAL_CADDY_PROCESS_REQUIRED")
    identities = next((line.split()[1:] for line in (proc / "status").read_text().splitlines() if line.startswith("Uid:")), [])
    require(identities == [str(uid)] * 4 and any(line.split(":", 2)[-1] == "/system.slice/caddy.service"
            for line in (proc / "cgroup").read_text().splitlines()), "G08_CADDY_SERVICE_IDENTITY_MISMATCH")
    argv = bounded_process_bytes(proc / "cmdline", 65536)
    require(argv.rstrip(b"\0").decode().split("\0") ==
            ["/usr/bin/caddy", "run", "--config", "/etc/caddy/Caddyfile"], "G08_ORIGINAL_CADDY_ARGV_REQUIRED")
    ticks = (proc / "stat").read_text().rsplit(") ", 1)[1].split()[19]
    owned = set()
    for file in (proc / "fd").iterdir():
        try:
            match = re.fullmatch(r"socket:\[([1-9][0-9]*)\]", os.readlink(file))
        except FileNotFoundError:
            continue
        if match:
            owned.add(match[1])
    listeners = {"tcp": [], "udp": []}
    for protocol in ("tcp", "udp"):
        for suffix in ("", "6"):
            for row in (proc / "net" / (protocol + suffix)).read_text().splitlines()[1:]:
                fields = row.split()
                if fields[1].split(":")[-1].upper() == "01BB" and (protocol == "udp" or fields[3] == "0A"):
                    require(fields[9] in owned, "G08_HTTPS_LISTENER_NOT_OWNED_BY_CADDY")
                    listeners[protocol].append(fields[9])
    require(listeners["tcp"], "G08_CADDY_HTTPS_LISTENER_REQUIRED")
    return {"unit": "caddy.service", "pid": pid, "uid": uid, "exe": "/usr/bin/caddy", "startTicks": ticks,
            "listeners": {key: sorted(set(value)) for key, value in listeners.items()}}


class CaddyConnection(http.client.HTTPConnection):
    def __init__(self, process):
        super().__init__("localhost", timeout=15)
        self.expected_process = process

    def connect(self):
        file = Path("/run/caddy/admin.sock")
        info, parent = file.lstat(), file.parent.stat()
        require(file.resolve() == file and not file.is_symlink() and stat.S_ISSOCK(info.st_mode) and
                info.st_uid == self.expected_process["uid"] and parent.st_uid == info.st_uid and
                stat.S_IMODE(parent.st_mode) == 0o700, "G08_PRIVATE_CADDY_ADMIN_SOCKET_REQUIRED")
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(15)
        self.sock.connect(str(file))
        peer_pid, peer_uid, _ = struct.unpack("3i", self.sock.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
        require(peer_pid == self.expected_process["pid"] and peer_uid == self.expected_process["uid"],
                "G08_CADDY_ADMIN_PEER_MISMATCH")


def validate_caddy_servers(servers, hostname, ingress_host):
    require(isinstance(servers, dict), "G08_CADDY_SERVERS_REQUIRED")
    selected = [server for server in servers.values()
                if any(address in (":443", "0.0.0.0:443", "[::]:443") for address in server.get("listen", []))]
    require(len(selected) == 1, "G08_UNIQUE_HTTPS_SERVER_REQUIRED")
    proxy_count = 0

    def handlers(entries):
        nonlocal proxy_count
        require(isinstance(entries, list) and entries, "G08_CADDY_HANDLERS_REQUIRED")
        for entry in entries:
            kind = entry.get("handler")
            require(kind in ("subroute", "headers", "encode", "reverse_proxy", "static_response"), "G08_CADDY_UNVERIFIED_CONTENT_HANDLER")
            if kind == "subroute":
                require(not entry.get("errors"), "G08_CADDY_UNVERIFIED_ERROR_ROUTE")
                routes(entry.get("routes", []), False)
            if kind == "reverse_proxy":
                require(entry.get("upstreams") == [{"dial": "127.0.0.1:4096"}] and
                        not any(key in entry for key in ("dynamic_upstreams", "rewrite", "handle_response", "transport")),
                        "G08_CADDY_UPSTREAM_NOT_INSTALLED_LISTENER")
                request = entry.get("headers", {}).get("request", {})
                header = {key.lower(): value for key, value in request.get("set", {}).items()}
                require(header.get("host") == [ingress_host] and
                        header.get("x-sf-ingress-proof") == ["{env.SF_INGRESS_PROOF}"] and
                        "forwarded" in [key.lower() for key in request.get("delete", [])],
                        "G08_CADDY_ORIGINAL_INGRESS_HEADERS_REQUIRED")
                proxy_count += 1
            if kind == "static_response":
                status = entry.get("status_code")
                require(str(status).isdigit() and 400 <= int(status) <= 599,
                        "G08_CADDY_STATIC_SUCCESS_CONTENT_FORBIDDEN")

    def routes(entries, top):
        require(isinstance(entries, list) and entries, "G08_CADDY_ROUTES_REQUIRED")
        for entry in entries:
            if top:
                require(entry.get("match") == [{"host": [hostname]}], "G08_CADDY_HOST_ROUTE_NOT_EXCLUSIVE")
            handlers(entry.get("handle"))

    require(not selected[0].get("errors"), "G08_CADDY_UNVERIFIED_ERROR_ROUTE")
    routes(selected[0].get("routes"), True)
    require(proxy_count > 0, "G08_CADDY_ORIGINAL_REVERSE_PROXY_REQUIRED")


def active_caddy(target, ingress_host):
    process = caddy_process()
    connection = CaddyConnection(process)
    try:
        connection.request("GET", "/config/apps/http/servers", headers={"Accept": "application/json"})
        response = connection.getresponse()
        require(response.status == 200, "G08_ACTIVE_CADDY_CONFIG_UNAVAILABLE")
        raw = response.read(1_048_577)
    finally:
        connection.close()
    require(len(raw) <= 1_048_576, "G08_CADDY_CONFIG_TOO_LARGE")
    config = parse_json(raw)
    validate_caddy_servers(config, urlsplit(target["publicOrigin"]).hostname, ingress_host)
    require(caddy_process() == process, "G08_CADDY_CHANGED_DURING_OBSERVATION")
    return process, hashlib.sha256(json.dumps(config, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def runtime_binding(process, package, target):
    proc = Path("/proc") / str(process["pid"])
    argv_raw = bounded_process_bytes(proc / "cmdline", 65536)
    require(argv_raw.endswith(b"\0"), "G08_PROCESS_ARGV_INVALID")
    argv = argv_raw[:-1].decode("utf-8").split("\0")
    require(len(argv) == 8, "G08_ORIGINAL_SERVICE_ARGV_REQUIRED")
    require(str(Path(argv[0]).resolve()) == process["exe"], "G08_PROCESS_ARGV_EXE_MISMATCH")
    factory = Path(argv[7])
    factory_real = str(factory.resolve())
    require(argv[1:7] == ["serve", "--hostname", "127.0.0.1", "--port", "4096", "--installation"] and
            factory_real == "/opt/orchestra-sf/releases/" + package["candidate"]["sha"] + "/bin/local/entry.mjs",
            "G08_RUNNING_FACTORY_PATH_MISMATCH")
    with Path(factory_real).open("rb") as reader:
        factory_sha = stream_digest(reader)
    validate_launch(argv, process["exe"], factory_real, factory_sha, package)
    # Observe only the two required environment entries; never retain or print the process environment.
    environment = {}
    for field in bounded_process_bytes(proc / "environ", 1_048_576).split(b"\0"):
        name, separator, value = field.partition(b"=")
        if name in (b"SUCAFINA_MICROSOFT_CONFIG", b"SUCAFINA_NATIVE_TEAM_WEB"):
            require(separator and name not in environment, "G08_RUNTIME_ENVIRONMENT_AMBIGUOUS")
            environment[name] = value.decode("utf-8")
    require(environment.get(b"SUCAFINA_NATIVE_TEAM_WEB") == "1" and b"SUCAFINA_MICROSOFT_CONFIG" in environment,
            "G08_ORIGINAL_NATIVE_MICROSOFT_FACTORY_REQUIRED")
    config_file = Path(environment[b"SUCAFINA_MICROSOFT_CONFIG"])
    owner = pwd.getpwnam("orchestra-sf").pw_uid
    config_raw = service_input(config_file, owner, 262144)
    config = parse_json(config_raw)
    ingress_host = validate_configuration(config, target)
    ingress_addresses = assigned_addresses()
    proxy, proxy_config_sha = active_caddy(target, ingress_host)
    inode = listener_socket(process["pid"])
    # No Entra client secret, session key, cookie or token is read. The private ingress proof is used only locally.
    proof = re.sub(r"\r?\n\Z", "", service_input(config_file.parent / "ingress-secret.txt", owner, 66).decode("ascii"))
    require(re.fullmatch(r"[a-f0-9]{64}", proof), "G08_PRIVATE_INGRESS_PROOF_INVALID")
    local = validate_discovery(discovery_request(
        http.client.HTTPConnection("127.0.0.1", 4096, timeout=30), ingress_host, proof), target)
    public = urlsplit(target["publicOrigin"])
    require(public.scheme == "https" and public.hostname and public.port is None and
            target["publicOrigin"] == "https://" + public.netloc and not public.username and not public.password,
            "G08_PUBLIC_HTTPS_ORIGIN_INVALID")
    # HTTPSConnection verifies the certificate and does not follow redirects or inherit proxy settings.
    remote = validate_discovery(discovery_request(
        http.client.HTTPSConnection(public.hostname, 443, context=ssl.create_default_context(), timeout=30),
        public.netloc, assigned=ingress_addresses), target)
    require(local == remote and listener_socket(process["pid"]) == inode, "G08_LOOPBACK_HTTPS_BINDING_CHANGED")
    descriptor_sha = hashlib.sha256(json.dumps(local, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return {
        "status": "LOOPBACK_PID_AND_HTTPS_BOUND",
        "factoryPath": factory_real, "factorySha256": factory_sha, "argvSha256": hashlib.sha256(argv_raw).hexdigest(),
        "configurationPath": str(config_file), "configurationSha256": hashlib.sha256(config_raw).hexdigest(),
        "listenerOrigin": config["listenerOrigin"], "listenerInode": inode,
        "descriptor": local, "loopbackDiscoverySha256": descriptor_sha, "httpsDiscoverySha256": descriptor_sha,
        "ingressAddresses": ingress_addresses, "caddyProcess": proxy, "caddyConfigSha256": proxy_config_sha,
    }

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        return None


def actual_vm_id():
    # Azure IMDS requires Metadata:true and proxy bypass. No token endpoint is accessed.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    request = urllib.request.Request(IMDS, headers={"Metadata": "true"})
    with opener.open(request, timeout=15) as response:
        require(response.status == 200 and response.url == IMDS, "G08_IMDS_UNAVAILABLE")
        raw = response.read(131073)
    require(len(raw) <= 131072, "G08_IMDS_RESPONSE_TOO_LARGE")
    value = parse_json(raw)
    require(value.get("osType") == "Linux" and isinstance(value.get("vmId"), str), "G08_IMDS_LINUX_REQUIRED")
    return value["vmId"].lower()



def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def az02_process(value, package):
    require(isinstance(value, dict) and set(value) ==
            {"pid", "startTicks", "bootId", "executable", "factorySha256"}, "G08_AZ02_PROCESS_SHAPE_REQUIRED")
    require(type(value["pid"]) is int and value["pid"] > 0 and
            isinstance(value["startTicks"], str) and re.fullmatch(r"[1-9][0-9]*", value["startTicks"]) and
            isinstance(value["bootId"], str) and re.fullmatch(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", value["bootId"]) and
            value["executable"] == "/opt/orchestra-sf/releases/" + package["candidate"]["sha"] + "/bin/orchestra" and
            value["factorySha256"] == package["factory"]["sha256"], "G08_AZ02_ORIGINAL_PROCESS_REQUIRED")
    return value


def phase_process(process, binding, package):
    require(isinstance(process, dict) and process.get("unit") == UNIT and
            process.get("activeState") == "active" and process.get("subState") == "running" and
            binding.get("status") == "LOOPBACK_PID_AND_HTTPS_BOUND", "G08_AZ02_RUNNING_HOST_REQUIRED")
    return az02_process({
        "pid": process["pid"], "startTicks": process["startTicks"], "bootId": process["bootId"],
        "executable": process["exe"], "factorySha256": binding["factorySha256"],
    }, package)


def validate_az02_restart_phase(phase, private, private_raw, plan, plan_raw, package):
    public_keys = {"schema", "phase", "status", "proofClass", "liveQualified", "installedTeamsProof", "g08Closed",
                   "finalCandidate", "candidate", "archiveSha256", "invocation", "source", "counts", "cases", "scope",
                   "hostPlanSha256", "privateEvidenceSha256"}
    require(isinstance(phase, dict) and set(phase) == public_keys and
            phase["schema"] == "sf.az02.teams-proof.v2" and phase["phase"] == "after-restart" and
            phase["status"] == "PASS" and phase["proofClass"] == "OWNER_OPERATED_HTTPS_OBSERVATIONS" and
            all(phase[key] is False for key in ("liveQualified", "installedTeamsProof", "g08Closed", "finalCandidate")),
            "G08_ORIGINAL_AZ02_RESTART_PHASE_REQUIRED")
    require(isinstance(private, dict) and set(private) ==
            {"schema", "phase", "candidate", "archiveSha256", "invocation", "details"} and
            private["schema"] == "sf.az02.private-observations.v2" and private["phase"] == "after-restart",
            "G08_ORIGINAL_AZ02_PRIVATE_OBSERVATION_REQUIRED")
    for value in (phase, private):
        require(value["candidate"] == plan["candidate"] == package["candidate"] and
                value["archiveSha256"] == package["archive"]["sha256"] and
                value["invocation"] == plan["invocation"], "G08_AZ02_SOURCE_TAR_INVOCATION_MISMATCH")
    require(phase["hostPlanSha256"] == sha256(plan_raw) and
            phase["privateEvidenceSha256"] == sha256(private_raw), "G08_AZ02_ORIGINAL_BYTES_MISMATCH")
    source = phase["source"]
    require(isinstance(source, dict) and source.get("legacySha") == "687759276c2c9121c2cfd20a5994b277ceb7ee4d" and
            source.get("contractRevision") == "sf-team-profile/1" and source.get("legacyCaseCount") == 32 and
            source.get("currentCaseCount") == 37, "G08_AZ02_SOURCE_CONTRACT_MISMATCH")
    counts = phase["counts"]
    require(isinstance(counts, dict) and all(type(value) is int for value in counts.values()) and
            counts == {"total": 1, "passed": 1, "failed": 0, "skipped": 0}, "G08_AZ02_EXACT_RESTART_CASE_REQUIRED")
    cases = phase["cases"]
    require(isinstance(cases, list) and len(cases) == 1 and isinstance(cases[0], dict) and
            set(cases[0]) == {"id", "expected", "observed", "status"} and
            cases[0]["id"] == "REPLAY_AFTER_RESTART" and cases[0]["status"] == "PASS" and
            cases[0]["observed"] in ("401", "403") and
            cases[0]["expected"] == "native process change and same revoked cookie denied on fresh host",
            "G08_AZ02_ORIGINAL_REPLAY_REFUSAL_REQUIRED")
    details = private["details"]
    require(isinstance(details, list) and len(details) == 1 and isinstance(details[0], dict) and
            set(details[0]) == {"role", "cookieSha256", "before", "after", "freshHost"} and
            details[0]["role"] == "requester" and isinstance(details[0]["cookieSha256"], str) and
            re.fullmatch(r"[0-9a-f]{64}", details[0]["cookieSha256"]), "G08_AZ02_ORIGINAL_RESTART_DETAILS_REQUIRED")
    return details[0]


def az02_restart_binding(root, plan, plan_raw, package):
    # Files alone cannot authenticate past execution. The canonical workflow/aggregate must
    # establish the original runPhase job and these exact bytes; live process/HTTPS are read again below.
    before_host, before_raw = private_json(root, "host-before.json")
    phase, phase_raw = private_json(root, "az02-phase.json")
    private, private_raw = private_json(root, "az02-private.json")
    detail = validate_az02_restart_phase(phase, private, private_raw, plan, plan_raw, package)
    require(isinstance(before_host, dict) and before_host.get("schema") == "sf-g08-installed-host-v1" and
            before_host.get("status") == "INSTALLATION_BYTES_AND_PROCESS_VERIFIED" and before_host.get("phase") == "before" and
            before_host.get("candidate") == plan["candidate"] and before_host.get("currentSource") == plan["candidate"]["sha"] and
            before_host.get("invocationId") == plan["invocation"]["id"] and before_host.get("vmId") == plan["reservation"]["vmId"] and
            before_host.get("archiveSha256") == package["archive"]["sha256"] and
            before_host.get("manifestSha256") == package["manifest"]["sha256"] and
            before_host.get("installerSha256") == package["verification"]["installerSha256"] and
            isinstance(before_host.get("releaseReceiptSha256"), str) and
            re.fullmatch(r"[0-9a-f]{64}", before_host["releaseReceiptSha256"]),
            "G08_AZ02_ORIGINAL_BEFORE_HOST_MISMATCH")
    observed_at = datetime.fromisoformat(before_host["observedAt"].replace("Z", "+00:00"))
    require(datetime.fromisoformat(plan["reservation"]["startsAt"]) <= observed_at <= datetime.now(timezone.utc) and
            observed_at < datetime.fromisoformat(plan["reservation"]["endsAt"]), "G08_AZ02_BEFORE_OUTSIDE_WINDOW")
    validate_discovery({"installations": [before_host["binding"]["descriptor"]]}, plan["target"])
    before = az02_process(detail["before"], package)
    after = az02_process(detail["after"], package)
    require(before == phase_process(before_host["process"], before_host["binding"], package),
            "G08_AZ02_BEFORE_PROCESS_MISMATCH")
    require(any(before[key] != after[key] for key in ("pid", "startTicks", "bootId")), "G08_AZ02_PROCESS_DID_NOT_RESTART")
    fresh = detail["freshHost"]
    require(isinstance(fresh, dict) and isinstance(fresh.get("hostId"), str) and
            re.fullmatch(r"[A-Za-z0-9._:-]{8,128}", fresh["hostId"]) and fresh["hostId"] != plan["target"]["hostId"],
            "G08_AZ02_FRESH_HOST_REQUIRED")
    target = {**plan["target"], "hostId": fresh["hostId"]}
    validate_discovery({"installations": [fresh]}, target)
    producer = REPOSITORY / "sf/azure/identity/az02-proof.cjs"
    return target, {
        "schema": "sf-g08-az02-restart-v1",
        "status": "AZ02_TRANSITION_INPUTS_BOUND_NOT_LIVE",
        "candidate": plan["candidate"], "archiveSha256": package["archive"]["sha256"], "invocation": plan["invocation"],
        "planSha256": sha256(plan_raw), "hostBeforeSha256": sha256(before_raw),
        "releaseReceiptSha256": before_host["releaseReceiptSha256"],
        "az02PhaseSha256": sha256(phase_raw), "az02PrivateSha256": sha256(private_raw),
        "producerSourceSha256": sha256(producer.read_bytes()),
        "oldHostId": plan["target"]["hostId"], "newHostId": target["hostId"],
        "before": before, "after": after, "cookieSha256": detail["cookieSha256"],
        "requiresOriginalWorkflowChain": True, "liveQualified": False,
    }


def complete_az02_restart_observation(root, restart, process, binding, package):
    require(phase_process(process, binding, package) == restart["after"] and
            binding["descriptor"]["hostId"] == restart["newHostId"], "G08_AZ02_CURRENT_PROCESS_OR_HOST_CHANGED")
    for name, key in (("plan.json", "planSha256"), ("host-before.json", "hostBeforeSha256"),
                      ("az02-phase.json", "az02PhaseSha256"), ("az02-private.json", "az02PrivateSha256")):
        _, raw = private_json(root, name)
        require(sha256(raw) == restart[key], "G08_AZ02_INPUT_CHANGED_DURING_OBSERVATION")
    require(sha256((REPOSITORY / "sf/azure/identity/az02-proof.cjs").read_bytes()) == restart["producerSourceSha256"],
            "G08_AZ02_PRODUCER_CHANGED_DURING_OBSERVATION")
    return {**restart, "status": "AZ02_PROCESS_AND_HOST_TRANSITION_REOBSERVED"}


def observe(root, phase):
    require(phase in ("before", "after", "after-restart"), "G08_OBSERVER_PHASE_REQUIRED")
    require(os.uname().sysname == "Linux" and os.uname().machine == "x86_64" and
            os.environ.get("GITHUB_ACTIONS") == "true" and os.environ.get("CI") == "true" and
            os.environ.get("RUNNER_ENVIRONMENT") == "self-hosted" and
            os.environ.get("GITHUB_REPOSITORY") == "gustavomhss/Orchestra-SF", "G08_PRIVATE_LINUX_ACTIONS_REQUIRED")
    plan, plan_raw = private_json(root, "plan.json", 65536)
    package, package_raw = private_json(root, "package-receipt.json")
    require(plan["schema"] == "sf-g08-private-plan-v1" and plan["scratchRoot"] == str(root) and
            package["schema"] == "sf-g07-package-v1" and package["status"] == "PACKAGE_VERIFIED" and
            package["candidate"] == plan["candidate"] and
            hashlib.sha256(package_raw).hexdigest() == plan["packageReceiptSha256"], "G08_PACKAGE_PLAN_MISMATCH")
    candidate = plan["candidate"]["sha"]
    require(re.fullmatch(r"[0-9a-f]{40}", candidate) and
            os.environ.get("SF_G08_CANDIDATE_SHA") == candidate and
            os.environ.get("SF_G08_CANDIDATE_TREE") == plan["candidate"]["tree"] and
            os.environ.get("SF_G08_INVOCATION_ID") == plan["invocation"]["id"] and
            os.environ.get("GITHUB_RUN_ID") == plan["invocation"]["runId"] and
            os.environ.get("GITHUB_RUN_ATTEMPT") == plan["invocation"]["runAttempt"] and
            os.environ.get("GITHUB_WORKFLOW_SHA") == plan["invocation"]["workflowSha"], "G08_INVOCATION_MISMATCH")
    now = datetime.now(timezone.utc)
    require(plan["reservation"]["environment"] == "qa-isolated" and plan["reservation"]["exclusive"] is True and
            plan["approvals"]["scope"] == "qualification-only" and
            datetime.fromisoformat(plan["reservation"]["startsAt"]) <= now <
            datetime.fromisoformat(plan["reservation"]["endsAt"]), "G08_RESERVED_WINDOW_REQUIRED")
    vm_id = actual_vm_id()
    require(vm_id == plan["reservation"]["vmId"], "G08_RESERVED_VM_MISMATCH")
    require(package["archive"]["file"] == ARCHIVE, "G08_ORIGINAL_INNER_TAR_REQUIRED")
    with private_file(root, ARCHIVE, 3 * 1024 ** 3) as (reader, size):
        archive_sha = stream_digest(reader)
    require(size == package["archive"]["bytes"] and archive_sha == package["archive"]["sha256"], "G08_TAR_BYTES_MISMATCH")

    # Reuse the candidate's actual installer verification, including every installed file/mode/hash.
    # These two functions are read-only; do not call vm_preflight/install/rollback/atomic_current.
    require(hashlib.sha256(INSTALLER.read_bytes()).hexdigest() == package["verification"]["installerSha256"],
            "G08_G07_INSTALLER_SOURCE_MISMATCH")
    spec = importlib.util.spec_from_file_location("g08_original_installer", INSTALLER)
    require(spec is not None and spec.loader is not None, "G08_ORIGINAL_INSTALLER_REQUIRED")
    installer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(installer)
    require(installer.current_source() == candidate, "G08_CURRENT_RELEASE_MISMATCH")
    installer.check_rollback_release(candidate)
    release = installer.RELEASES / candidate
    with installer.protected_input(release / ".a7-source.json", 131072) as reader:
        release_raw = reader.read()
    source = parse_json(release_raw)
    with installer.protected_input(release / "distribution.json", 5_000_000) as reader:
        manifest_raw = reader.read()
    manifest_sha = hashlib.sha256(manifest_raw).hexdigest()
    require(source["sourceSHA"] == candidate and source["archiveSha256"] == archive_sha and
            source["manifestSha256"] == manifest_sha == package["manifest"]["sha256"], "G08_INSTALLED_RECEIPT_MISMATCH")
    distribution = parse_json(manifest_raw)
    installed = sorted(
        [{"path": entry["path"], "sha256": entry["sha256"], "executable": entry["executable"],
          "bytes": (release / entry["path"]).stat().st_size} for entry in distribution["files"]],
        key=lambda entry: entry["path"])
    require(installed == sorted(package["manifest"]["files"], key=lambda entry: entry["path"]), "G08_INSTALLED_G07_INVENTORY_MISMATCH")
    target, restart = (az02_restart_binding(root, plan, plan_raw, package) if phase == "after-restart"
                       else (plan["target"], None))
    process = running_process(candidate)
    binding = runtime_binding(process, package, target)
    require(running_process(candidate) == process, "G08_PROCESS_CHANGED_DURING_BINDING")
    require(installer.current_source() == candidate, "G08_RELEASE_CHANGED_DURING_OBSERVATION")
    result = {
        "schema": "sf-g08-installed-host-v1", "status": "INSTALLATION_BYTES_AND_PROCESS_VERIFIED",
        "phase": phase, "observedAt": now.isoformat().replace("+00:00", "Z"), "invocationId": plan["invocation"]["id"],
        "candidate": plan["candidate"], "vmId": vm_id, "currentSource": candidate,
        "archiveSha256": archive_sha, "manifestSha256": manifest_sha,
        "installerSha256": hashlib.sha256(INSTALLER.read_bytes()).hexdigest(),
        "releaseReceiptSha256": hashlib.sha256(release_raw).hexdigest(), "process": process, "binding": binding,
    }
    if restart is not None:
        require(result["releaseReceiptSha256"] == restart["releaseReceiptSha256"],
                "G08_AZ02_INSTALLED_RECEIPT_CHANGED")
        result["target"] = target
        result["restart"] = complete_az02_restart_observation(root, restart, process, binding, package)
        require(running_process(candidate) == process and installer.current_source() == candidate,
                "G08_AZ02_FINAL_PROCESS_OR_RELEASE_CHANGED")
    output = root / ("host-after.json" if phase == "after-restart" else "host-" + phase + ".json")
    with os.fdopen(os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600), "w") as writer:
        writer.write(json.dumps(result, separators=(",", ":")) + "\n")
        writer.flush()
        os.fsync(writer.fileno())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=("before", "after", "after-restart"))
    args = parser.parse_args()
    observe(private_root(os.environ["SF_G08_PRIVATE_ROOT"]), args.phase)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        code = re.search(r"G08_[A-Z0-9_]+", str(error))
        print(code.group(0) if code else "G08_INSTALLED_PREFLIGHT_REFUSED", file=sys.stderr)
        sys.exit(1)
