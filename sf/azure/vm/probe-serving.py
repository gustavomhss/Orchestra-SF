#!/usr/bin/env python3
"""A7 post-cutover/rollback smoke: real listener + public CA TLS + preserved SF URL.

Without --auth-cookie-file this is a *read-only availability smoke*, NOT Entra
qualification or a business transaction. It never creates a session or actor.
"""
import argparse
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import ssl
import stat
import subprocess
import sys
from urllib.parse import urlencode

FQDN = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+\Z")
C = re.compile(r"[a-f0-9]{40}\Z")
RELEASES = Path("/opt/orchestra-sf/releases")
CURRENT = Path("/opt/orchestra-sf/current")


def refuse(reason):
    raise RuntimeError("SF_REAL_SERVING_SMOKE_REFUSED: " + reason)


def private_json(file):
    info = file.lstat()
    if file.is_symlink() or not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or \
       info.st_mode & 0o077 or info.st_size > 65536:
        refuse("only root-owned private configuration/actor files")
    return json.loads(file.read_text("utf-8"))


def read_http(host, uri, public, cookie=None):
    headers = {"Host": host, "Accept": "application/json" if "status" in uri or "context" in uri else "text/html",
               "Accept-Encoding": "identity", "Cache-Control": "no-store"}
    if cookie is not None:
        headers["Cookie"] = cookie
    conn = http.client.HTTPSConnection(host, timeout=20, context=ssl.create_default_context()) if public else \
           http.client.HTTPConnection("127.0.0.1", 4096, timeout=20)
    try:
        conn.request("GET", uri, headers=headers)
        r = conn.getresponse()
        body = r.read(4 * 1024 * 1024 + 1)
        if len(body) > 4 * 1024 * 1024:
            refuse("oversized HTTP response")
        return r.status, r.getheader("content-type", ""), body
    finally:
        conn.close()


def read_status(host, public):
    status, ctype, body = read_http(host, "/sucafina/status", public)
    if status != 200 or "json" not in ctype.lower():
        refuse("real /sucafina/status HTTP 200 JSON required")
    data = json.loads(body)
    if not isinstance(data, dict) or data.get("login") != "configured-unverified":
        refuse("status is not from Microsoft-configured original factory")
    return data


def identity(host, cookie_path, owner_path):
    owner = private_json(owner_path)
    if owner.get("publicOrigin") != "https://" + host or owner.get("mount") != "/sucafina":
        refuse("approved origin/mount mismatch")
    info = cookie_path.lstat()
    if cookie_path.is_symlink() or not stat.S_ISREG(info.st_mode) or \
       info.st_uid != 0 or info.st_mode & 0o077:
        refuse("A8 real session not in root 0600 file")
    header = cookie_path.read_text("utf-8").strip()
    if not header.startswith("Cookie: ") or "\r" in header or "\n" in header:
        refuse("invalid private Microsoft browser cookie")
    path = "/sucafina/api/ui/context?" + urlencode({
        x: owner[x] for x in ("installationId", "projectId", "hostId")
    })
    anonymous, _, _ = read_http(host, path, public=True)
    if anonymous not in (401, 403):
        refuse("anonymous context failed to deny")
    status, content, raw = read_http(host, path, public=True, cookie=header[8:])
    if status != 200 or "json" not in content.lower():
        refuse("real Microsoft installed actor cannot fetch bound context")
    value = json.loads(raw)
    if value.get("status") != "ok" or not isinstance(value.get("value"), dict):
        refuse("installed authority envelope missing")
    ctx = value["value"]
    stamp = ctx.get("stamp")
    if ctx.get("authMode") != "microsoft" or ctx.get("contractRevision") != "sf-native-ui/1" or \
       not isinstance(stamp, dict):
        refuse("context is not original Microsoft-native authority")
    for name in ("installationId", "projectId", "hostId", "principalRef"):
        if stamp.get(name) != owner.get(name):
            refuse("context not bound to expected real actor/host")
    for name in ("policyVersion", "accessRevision"):
        if not isinstance(stamp.get(name), str) or not stamp[name]:
            refuse("missing policy/source version")
    return {"anonymousHttp": anonymous, "authorizedHttp": status, "authMode": "microsoft",
            "binding": "OBSERVED_EXACT_OWNER/PROJECT/INSTALLATION"}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--fqdn", required=True)
    p.add_argument("--candidate", required=True)
    p.add_argument("--local-only", action="store_true")
    p.add_argument("--auth-cookie-file", type=Path)
    p.add_argument("--owner-json", type=Path)
    args = p.parse_args()
    if os.geteuid() != 0 or not FQDN.fullmatch(args.fqdn) or not C.fullmatch(args.candidate):
        refuse("real FQDN/frozen C and root are required")
    actual = CURRENT.resolve(strict=True)
    if not CURRENT.is_symlink() or actual != RELEASES / args.candidate:
        refuse("current symlink does not point to chosen exact C")
    if subprocess.run(["systemctl", "is-active", "--quiet", "orchestra-sf.service"]).returncode != 0:
        refuse("native service not running")
    user = subprocess.check_output(["systemctl", "show", "-P", "User", "orchestra-sf.service"], text=True).strip()
    if user != "orchestra-sf":
        refuse("service not running as nonprivileged orchestra-sf")
    # A port reachable on 0.0.0.0/:: must fail, not be mistaken for loopback.
    ports = [line.split()[3] for line in subprocess.check_output(["ss", "-H", "-lnt"], text=True).splitlines()
             if len(line.split()) >= 4 and line.split()[3].rsplit(":", 1)[-1] == "4096"]
    if not ports or any(value != "127.0.0.1:4096" for value in ports):
        refuse("native port 4096 must be bound solely to 127.0.0.1")
    local = read_status(args.fqdn, public=False)
    if args.local_only:
        if args.auth_cookie_file is not None or args.owner_json is not None:
            refuse("real auth proof requires HTTPS/CA, not local-only")
        print(json.dumps({"proof": "NATIVE_STATUS_ONLY", "candidate": args.candidate,
                          "localHttp": 200, "publicTls": "NOT_TESTED", "goLive": False}, sort_keys=True))
        return
    public = read_status(args.fqdn, public=True)
    if public != local:
        refuse("reverse proxy stripped/re-wrote /sucafina or changed producer response")
    manifest = json.loads((actual / "distribution.json").read_text("utf-8"))
    index = next((x for x in manifest["files"] if x["path"] == "bin/web/index.html"), None)
    if not index:
        refuse("verified build is missing Web index entry")
    status, media, body = read_http(args.fqdn, "/", public=True)
    digest = hashlib.sha256(body).hexdigest()
    if status != 200 or "html" not in media.lower() or digest != index["sha256"]:
        refuse("public TLS Web is not serving frozen C frontend bytes")
    if (args.auth_cookie_file is None) != (args.owner_json is None):
        refuse("real authentication requires both A8 session and owner binding")
    result = {"proof": "REAL_HTTPS_HOST_AND_WEB_BYTES_OBSERVED",
              "candidate": args.candidate, "statusRoute": "/sucafina/status",
              "publicTls": "DEFAULT_CA_VERIFIED", "webSha256": digest,
              "auth": "NOT_RUN", "businessTransaction": "NOT_RUN", "goLive": False}
    if args.auth_cookie_file:
        result["auth"] = identity(args.fqdn, args.auth_cookie_file, args.owner_json)
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, KeyError, subprocess.CalledProcessError) as e:
        print("REAL_SERVING_SMOKE_RED: " + str(e), file=sys.stderr)
        sys.exit(1)
