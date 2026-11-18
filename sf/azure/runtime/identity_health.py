#!/usr/bin/env python3
"""Real HTTPS + Web-byte + Microsoft context binding probe. Read-only; not a transaction."""
import argparse
import hashlib
import http.client
import json
import os
from pathlib import Path
import ssl
import stat
import subprocess
import sys
from urllib.parse import urlencode, urlsplit

from bundle import refuse, verify_release


def private_text(path):
    st = path.lstat()
    if not stat.S_ISREG(st.st_mode) or path.is_symlink() or st.st_uid != 0 or st.st_mode & 0o077:
        refuse("private root-owned session/config file required")
    if st.st_size == 0 or st.st_size > 16384:
        refuse("missing/oversized private input")
    return path.read_text(encoding="utf-8")


def fetch(origin, path, cookie=None):
    url = urlsplit(origin)
    if url.scheme != "https" or not url.hostname or url.username or url.password or url.port is not None:
        refuse("actual public HTTPS origin required")
    # No proxy / no insecure TLS / no redirects. Entra cookies stay confined to the host.
    connection = http.client.HTTPSConnection(url.hostname, timeout=15, context=ssl.create_default_context())
    headers = {"Accept": "application/json" if "/api/ui/context" in path else "text/html",
               "Accept-Encoding": "identity", "Cache-Control": "no-store"}
    if cookie is not None:
        headers["Cookie"] = cookie
    try:
        connection.request("GET", path, headers=headers)
        response = connection.getresponse()
        body = response.read(2 * 1024 * 1024 + 1)
        if len(body) > 2 * 1024 * 1024:
            refuse("response too large")
        return response.status, response.getheader("Content-Type", ""), body
    finally:
        connection.close()


def check_socket(port):
    if subprocess.check_output(["systemctl", "is-active", "orchestra-sf.service"], text=True).strip() != "active":
        refuse("systemd unit inactive")
    user = subprocess.check_output(["systemctl", "show", "-P", "User", "orchestra-sf.service"], text=True).strip()
    if user != "orchestra-sf" or os.getuid() != 0:
        refuse("probe requires root; server must be non-root")
    lines = subprocess.check_output(["ss", "-H", "-lnt"], text=True).splitlines()
    bound = [line.split()[3] for line in lines if len(line.split()) >= 4 and line.split()[3].endswith(":" + str(port))]
    if not bound or any(x != "127.0.0.1:" + str(port) for x in bound):
        refuse("host API is not loopback-only")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--config", required=True, type=Path)
    p.add_argument("--cookie-file", required=True, type=Path)
    p.add_argument("--release", required=True, type=Path)
    p.add_argument("--candidate", required=True)
    p.add_argument("--tree", required=True)
    args = p.parse_args()
    owner = json.loads(private_text(args.config))
    required = {"schema", "fqdn", "publicOrigin", "port", "mount", "installationId",
                "projectId", "hostId", "principalRef", "diskUuid"}
    if not isinstance(owner, dict) or set(owner) != required or owner["schema"] != "orchestra-sf.azure-owner.v1":
        refuse("unexpected owner identity contract")
    release = args.release.resolve(strict=True)
    if Path("/opt/orchestra-sf/current").resolve(strict=True) != release:
        refuse("current release differs from expected C")
    files = verify_release(release, args.candidate, args.tree, (release / ".archive-sha256").read_text().strip())
    check_socket(owner["port"])
    raw_cookie = private_text(args.cookie_file).strip()
    if not raw_cookie.startswith("Cookie: ") or "\n" in raw_cookie or "\r" in raw_cookie:
        refuse("A8 must provide one real browser Cookie header, not a bearer or mock")
    cookie = raw_cookie[8:]
    if not cookie or any(x in cookie for x in "\r\n"):
        refuse("empty/invalid Microsoft session")
    origin = owner["publicOrigin"]
    # The actual HTML bytes served by the immutable CLI must match the frozen Web file.
    status, media, body = fetch(origin, "/")
    if status != 200 or "text/html" not in media.lower() or hashlib.sha256(body).hexdigest() != files["web/index.html"]["sha256"]:
        refuse("Web/TLS is not serving exact frozen frontend bytes")
    query = urlencode({k: owner[k] for k in ("installationId", "projectId", "hostId")})
    url = owner["mount"] + "/api/ui/context?" + query
    anonymous, _, _ = fetch(origin, url)
    if anonymous not in (401, 403):
        refuse("anonymous UI context did not fail closed")
    status, media, raw = fetch(origin, url, cookie)
    if status != 200 or "json" not in media.lower():
        refuse("real Microsoft browser session unavailable")
    value = json.loads(raw)
    if not isinstance(value, dict) or value.get("status") != "ok" or not isinstance(value.get("value"), dict):
        refuse("context is not a positive producer envelope")
    context = value["value"]
    if context.get("contractRevision") != "sf-native-ui/1" or context.get("authMode") != "microsoft":
        refuse("context not backed by Microsoft-authenticated installation")
    stamp = context.get("stamp")
    if not isinstance(stamp, dict):
        refuse("no owner/source stamp")
    for field in ("installationId", "projectId", "hostId", "principalRef"):
        if stamp.get(field) != owner[field]:
            refuse("context identity binding differs: " + field)
    for field in ("policyVersion", "accessRevision"):
        if not isinstance(stamp.get(field), str) or not stamp[field]:
            refuse("missing live revision " + field)
    if not isinstance(context.get("destinations"), list) or not context["destinations"]:
        refuse("native capability destinations unavailable")
    print(json.dumps({
        "proofClass": "AZ01_WEB_BYTES_AND_MS_CONTEXT_OBSERVED_READ_ONLY",
        "candidateSha": args.candidate, "treeSha": args.tree,
        "tls": "VERIFIED_DEFAULT_CA", "webDigest": "MATCHED_C",
        "anonymousContext": anonymous, "authenticatedContext": status,
        "identity": "MICROSOFT_MODE_AND_EXACT_OWNER_BINDING",
        "transaction": "NOT_RUN", "AZ03": "NOT_RUN", "releaseQualified": False
    }, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, ValueError, KeyError, json.JSONDecodeError, subprocess.CalledProcessError) as e:
        print("IDENTITY_HEALTH_RED: " + str(e), file=sys.stderr)
        sys.exit(1)
