#!/usr/bin/env python3
"""A7: managed Caddy 503/proxy cutover, no path stripping, with pre-reload validation.

Only a single FQDN bootstrap 503 or an exact previously managed file is
accepted. All external traffic stays 503 until the operator explicitly
switches to proxy and the native SF Microsoft host passes preflight.
"""
import argparse
import http.client
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
CADDY = Path("/etc/caddy/Caddyfile")
CURRENT = Path("/opt/orchestra-sf/current")
SHA40 = re.compile(r"[0-9a-f]{40}\Z")
FQDN = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+\Z")


def refuse(reason):
    raise RuntimeError("A7_CADDY_REFUSED: " + reason)


def maintenance(host):
    return "# managed-orchestra-sf-mode: maintenance\n" + host + " {\n    respond 503\n}\n"


def proxy(host):
    template = (REPO / "sf/azure/runtime/Caddyfile.template").read_text("utf-8")
    if template.count("__SF_FQDN__") != 1:
        refuse("proxy template invalid")
    return template.replace("__SF_FQDN__", host)


def trusted_state(content, host):
    bootstrap = re.fullmatch(re.escape(host) + r"\s*\{\s*respond\s+503\s*\}", content.strip())
    if bootstrap:
        return "bootstrap-503"
    if content == maintenance(host):
        return "maintenance-503"
    if content == proxy(host):
        return "managed-proxy"
    refuse("unknown Caddy config: other sites or unreviewed edits, STOP")


def local_native_status(host):
    if subprocess.run(["systemctl", "is-active", "--quiet", "orchestra-sf.service"]).returncode != 0:
        refuse("non-root systemd server is not active")
    target = CURRENT.resolve(strict=True)
    if not CURRENT.is_symlink() or target.parent != Path("/opt/orchestra-sf/releases") or \
       not SHA40.fullmatch(target.name):
        refuse("current does not point to an immutable validated release")
    for name in ("bin/orchestra", "bin/local/entry.mjs", "bin/web/index.html"):
        if not (target / name).is_file():
            refuse("current factory/Web distribution incomplete")
    conn = http.client.HTTPConnection("127.0.0.1", 4096, timeout=15)
    try:
        conn.request("GET", "/sucafina/status", headers={"Host": host,
                     "Accept": "application/json", "Cache-Control": "no-store"})
        response = conn.getresponse()
        body = response.read(8192)
        if response.status != 200 or "json" not in response.getheader("Content-Type", "").lower():
            refuse("real SF status HTTP 200 JSON required before Caddy reload")
        value = json.loads(body)
        if not isinstance(value, dict) or value.get("login") != "configured-unverified":
            refuse("native route not using an explicit Microsoft tenant/client configuration")
    finally:
        conn.close()


def atomic_replace(dest, body):
    fd, tmp = tempfile.mkstemp(prefix=".a7-caddy-", dir=dest.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as out:
            out.write(body)
            out.flush()
            os.fsync(out.fileno())
        os.chmod(tmp, 0o644)
        os.replace(tmp, dest)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--mode", required=True, choices=("maintenance", "proxy"))
    p.add_argument("--fqdn", required=True)
    mode = p.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    a = p.parse_args()
    if os.geteuid() != 0 or not FQDN.fullmatch(a.fqdn):
        refuse("real FQDN and root Run Command required")
    if CADDY.is_symlink() or not CADDY.is_file() or CADDY.stat().st_uid != 0:
        refuse("untrusted /etc/caddy/Caddyfile")
    current_text = CADDY.read_text("utf-8")
    before = trusted_state(current_text, a.fqdn)
    next_text = maintenance(a.fqdn) if a.mode == "maintenance" else proxy(a.fqdn)
    if a.mode == "proxy":
        # Must prove factory binds the externally preserved Host before enabling public traffic.
        local_native_status(a.fqdn)
    if a.dry_run:
        print(json.dumps({"result": "DRY_RUN_NO_WRITES", "from": before,
                          "to": a.mode, "currentSHA": CURRENT.resolve().name if CURRENT.is_symlink() else None}))
        return
    if current_text == next_text:
        print("CADDY_ALREADY_AT_REQUESTED_MODE_NO_CHANGES")
        return
    # Creating the candidate only during --apply guarantees dry-run never writes.
    fd, tmp = tempfile.mkstemp(prefix=".a7-caddy-validate-", dir=CADDY.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as out:
            out.write(next_text)
            out.flush()
            os.fsync(out.fileno())
        os.chmod(tmp, 0o644)
        subprocess.run(["caddy", "validate", "--config", tmp], check=True)
        if CADDY.read_text("utf-8") != current_text:
            refuse("Caddy changed during pre-reload validation")
        atomic_replace(CADDY, next_text)
        try:
            subprocess.run(["systemctl", "reload", "caddy"], check=True)
        except subprocess.CalledProcessError:
            atomic_replace(CADDY, current_text)
            subprocess.run(["systemctl", "reload", "caddy"], check=False)
            refuse("reload failed: prior Caddy config restored, public status must be rechecked")
        print(json.dumps({"result": "CADDY_RELOADED", "from": before, "to": a.mode,
                          "pathPrefix": "/sucafina PRESERVED", "auth": "NOT_PROVEN_BY_STATUS"}))
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError,
            json.JSONDecodeError) as e:
        print("CADDY_RED: " + str(e), file=sys.stderr)
        sys.exit(1)
