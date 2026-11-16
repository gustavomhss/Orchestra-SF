#!/usr/bin/env python3
"""Owner-operated AZ-01 VM preflight, stage, and gated activation; no self-approval."""
import argparse
import json
import os
from pathlib import Path
import platform
import re
import stat
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "sf/azure/runtime"))
from bundle import COMMIT, SHA, refuse, stage_bundle, verify_release  # noqa: E402

ETC = Path("/etc/orchestra-sf")
RELEASES = Path("/opt/orchestra-sf/releases")
CURRENT = Path("/opt/orchestra-sf/current")
SERVICE = Path("/etc/systemd/system/orchestra-sf.service")
CADDY = Path("/etc/caddy/Caddyfile")
STATE = Path("/var/lib/orchestra-sf")
LUN = Path("/dev/disk/azure/scsi1/lun0")


def run(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.DEVNULL).strip()


def private_json(file):
    info = file.lstat()
    if not stat.S_ISREG(info.st_mode) or file.is_symlink() or info.st_uid != 0 or info.st_mode & 0o077:
        refuse("root-owned 0600 non-symlink file required: " + str(file))
    return json.loads(file.read_text(encoding="utf-8"))


def atomic_file(dest, contents, mode=0o600):
    fd, tmp = tempfile.mkstemp(prefix=".write-", dir=dest.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as out:
            out.write(contents)
            out.flush()
            os.fsync(out.fileno())
        os.chmod(tmp, mode)
        os.replace(tmp, dest)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def preflight():
    if os.geteuid() != 0 or platform.system() != "Linux" or platform.machine() != "x86_64":
        refuse("operator root on Linux x86_64 Azure required")
    if run("cloud-init", "status") != "status: done":
        refuse("cloud-init not done")
    if not LUN.exists() or not LUN.resolve().is_block_device():
        refuse("Azure LUN0 block device absent")
    if STATE.is_symlink() or run("findmnt", "-n", "-o", "TARGET", "--mountpoint", str(STATE)) != str(STATE):
        refuse("persistent mount missing")
    source = run("findmnt", "-n", "-o", "SOURCE", "--mountpoint", str(STATE))
    if Path(source).resolve() != LUN.resolve() or run("findmnt", "-n", "-o", "FSTYPE", "--mountpoint", str(STATE)) != "ext4":
        refuse("wrong data disk or filesystem")
    if int(run("id", "-u", "orchestra-sf")) == 0 or run("id", "-gn", "orchestra-sf") != "orchestra-sf":
        refuse("non-root service account not provisioned")
    if run("getent", "passwd", "orchestra-sf").split(":")[5] != str(STATE / "home"):
        refuse("unexpected service account HOME")
    if (STATE / "home").is_symlink() or not (STATE / "home").is_dir():
        refuse("private persistent HOME unavailable")
    if not ETC.is_dir() or ETC.is_symlink() or ETC.stat().st_uid != 0 or ETC.stat().st_mode & 0o077:
        refuse("owner-only /etc/orchestra-sf (0700) absent")
    if not CADDY.is_file() or CADDY.is_symlink():
        refuse("Caddy foundation not installed")
    if not RELEASES.exists():
        RELEASES.mkdir(parents=True, mode=0o755)
    if RELEASES.is_symlink() or RELEASES.stat().st_uid != 0:
        refuse("unsafe release directory")


def owner_config():
    obj = private_json(ETC / "owner.json")
    keys = {"schema", "fqdn", "publicOrigin", "port", "mount", "installationId", "projectId", "hostId",
            "principalRef", "diskUuid"}
    if not isinstance(obj, dict) or set(obj) != keys or obj["schema"] != "orchestra-sf.azure-owner.v1":
        refuse("owner configuration has missing/extra fields")
    fqdn = obj["fqdn"]
    if not isinstance(fqdn, str) or len(fqdn) > 253 or not re.fullmatch(
        r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+", fqdn):
        refuse("invalid FQDN")
    if obj["publicOrigin"] != "https://" + fqdn or type(obj["port"]) is not int or not 1024 <= obj["port"] <= 65535:
        refuse("TLS origin/loopback port invalid")
    if not isinstance(obj["mount"], str) or not re.fullmatch(r"/[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*", obj["mount"]):
        refuse("invalid mount")
    for key in ("installationId", "projectId", "hostId", "principalRef"):
        if not isinstance(obj[key], str) or not 1 <= len(obj[key]) <= 256 or "\n" in obj[key] or "\r" in obj[key]:
            refuse("missing binding " + key)
    if not isinstance(obj["diskUuid"], str) or run("blkid", "-s", "UUID", "-o", "value", str(LUN)) != obj["diskUuid"]:
        refuse("data volume UUID does not match owner inventory")
    return obj


def frozen_checkout(candidate, tree):
    if not COMMIT.fullmatch(candidate) or not COMMIT.fullmatch(tree):
        refuse("exact 40-hex C and tree SHA required")
    if run("git", "-C", str(ROOT), "rev-parse", "HEAD") != candidate or \
       run("git", "-C", str(ROOT), "rev-parse", "HEAD^{tree}") != tree or \
       run("git", "-C", str(ROOT), "status", "--porcelain", "--untracked-files=no"):
        refuse("script checkout must be frozen C and have clean tracked files")


def activation_approval(file, candidate, tree, bundle_sha):
    obj = private_json(file)
    if not isinstance(obj, dict) or set(obj) != {"schema", "action", "candidateSha", "treeSha",
                                               "bundleSha256", "approver", "approvedAtUtc"} or \
       obj["schema"] != "orchestra-sf.azure-approval.v1" or obj["action"] != "ACTIVATE" or \
       obj["candidateSha"] != candidate or obj["treeSha"] != tree or obj["bundleSha256"] != bundle_sha or \
       not isinstance(obj["approver"], str) or not obj["approver"].strip() or \
       not isinstance(obj["approvedAtUtc"], str) or not obj["approvedAtUtc"].endswith("Z"):
        refuse("explicit exact-C owner approval file missing/invalid")


def stage(a):
    preflight()
    owner_config()
    frozen_checkout(a.candidate, a.tree)
    if not SHA.fullmatch(a.bundle_sha):
        refuse("archive digest invalid")
    print(stage_bundle(Path(a.bundle).resolve(), a.bundle_sha, a.candidate, a.tree, RELEASES))
    print("AZ-01=STAGED_ONLY; AZ-03=NOT_RUN; AZURE_RELEASE_QUALIFIED=BLOCKED")


def activate(a):
    preflight()
    config = owner_config()
    frozen_checkout(a.candidate, a.tree)
    activation_approval(Path(a.approval), a.candidate, a.tree, a.bundle_sha)
    target = RELEASES / a.candidate
    verify_release(target, a.candidate, a.tree, a.bundle_sha)
    cookie = Path(a.cookie)
    s = cookie.lstat()
    if cookie.is_symlink() or not stat.S_ISREG(s.st_mode) or s.st_uid != 0 or s.st_mode & 0o077:
        refuse("real A8 session cookie must be root-owned private file; no fake identity")
    unit = (ROOT / "sf/azure/runtime/orchestra-sf.service").read_text()
    if SERVICE.exists() and (SERVICE.is_symlink() or SERVICE.read_text() != unit):
        refuse("existing systemd unit differs; manual review before replacing")
    caddy_next = (ROOT / "sf/azure/runtime/Caddyfile.template").read_text()
    caddy_next = caddy_next.replace("__SF_FQDN__", config["fqdn"]).replace("__SF_PORT__", str(config["port"]))
    old = CADDY.read_text()
    if not ((config["fqdn"] + " {") in old and ("respond 503" in old or "# managed-orchestra-sf" in old)):
        refuse("unrecognized Caddy site; do not overwrite unrelated configuration")
    atomic_file(ETC / "Caddyfile.next", caddy_next)
    subprocess.run(["caddy", "validate", "--config", str(ETC / "Caddyfile.next")], check=True)
    if CURRENT.exists() and not CURRENT.is_symlink():
        refuse("current release may only be atomic symlink")
    previous = os.readlink(CURRENT) if CURRENT.is_symlink() else None
    if previous and (CURRENT.parent / previous).resolve().parent != RELEASES:
        refuse("current symlink not a release under managed root")
    if not SERVICE.exists():
        atomic_file(SERVICE, unit, 0o644)
    atomic_file(ETC / "public.env", "SF_FQDN=" + config["fqdn"] + "\nSF_PORT=" + str(config["port"]) + "\n", 0o644)
    temp_link = CURRENT.parent / (".next-" + a.candidate)
    if temp_link.exists() or temp_link.is_symlink():
        refuse("concurrent activation / stale symlink")
    temp_link.symlink_to(target)
    os.replace(temp_link, CURRENT)
    # On failure close public ingress and stop writes. Never automatically downgrade a possibly migrated DB.
    try:
        subprocess.run(["systemctl", "daemon-reload"], check=True)
        subprocess.run(["systemctl", "enable", "--now", "orchestra-sf.service"], check=True)
        subprocess.run(["systemctl", "restart", "orchestra-sf.service"], check=True)
        if run("systemctl", "is-active", "orchestra-sf.service") != "active" or \
           run("systemctl", "show", "-P", "User", "orchestra-sf.service") != "orchestra-sf":
            refuse("non-privileged service inactive")
        atomic_file(ETC / "Caddyfile.previous", old)
        atomic_file(CADDY, caddy_next, 0o644)
        subprocess.run(["systemctl", "reload", "caddy"], check=True)
        subprocess.run([sys.executable, str(ROOT / "sf/azure/runtime/identity_health.py"),
                        "--config", str(ETC / "owner.json"), "--cookie-file", str(cookie),
                        "--release", str(target), "--candidate", a.candidate, "--tree", a.tree], check=True)
    except Exception:
        atomic_file(CADDY, old, 0o644)
        subprocess.run(["systemctl", "reload", "caddy"], check=False)
        subprocess.run(["systemctl", "stop", "orchestra-sf.service"], check=False)
        print("ACTIVATION_FAILED_CADDY_RESTORED_SERVICE_STOPPED_NO_DB_DOWNGRADE", file=sys.stderr)
        raise
    print("AZ01_IDENTITY_READ_OBSERVED; TRANSACTION/RESTORE/F04/AM/RELEASE_NOT_QUALIFIED")
    print("previous_release=" + (previous or "none"))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    actions = p.add_subparsers(dest="action", required=True)
    actions.add_parser("preflight")
    st = actions.add_parser("stage")
    ac = actions.add_parser("activate")
    for s in (st, ac):
        s.add_argument("--candidate", required=True)
        s.add_argument("--tree", required=True)
        s.add_argument("--bundle-sha", required=True)
    st.add_argument("--bundle", required=True)
    ac.add_argument("--approval", required=True)
    ac.add_argument("--cookie", required=True, help="root 0600 actual A8 Microsoft browser session Cookie header file")
    a = p.parse_args()
    try:
        if a.action == "preflight":
            preflight()
            owner_config()
            print("AZURE_VM_PREFLIGHT_ONLY_NOT_RELEASE")
        elif a.action == "stage":
            stage(a)
        else:
            activate(a)
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as e:
        print("BLOCKED/RED: " + str(e), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
