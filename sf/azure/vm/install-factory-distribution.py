#!/usr/bin/env python3
"""A7: fail-closed, idempotent installation of *actual* SF factory CI distribution.

This tool stages an immutable producer tar and atomically selects current. It
NEVER starts a service, exposes a port, changes Caddy, or creates credentials.
The operator must first put the public site into verified 503 maintenance and
stop the app. --dry-run does not write files, locks, or change symlinks.
"""
import argparse
import fcntl
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile

RELEASES = Path("/opt/orchestra-sf/releases")
CURRENT = Path("/opt/orchestra-sf/current")
CADDY = Path("/etc/caddy/Caddyfile")
LOCK = Path("/run/lock/orchestra-sf-a7-install.lock")
SHA40 = re.compile(r"[0-9a-f]{40}\Z")
SHA64 = re.compile(r"[0-9a-f]{64}\Z")
FQDN = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+\Z")
MAX_FILES = 20000
MAX_BYTES = 3 * 1024**3
REQUIRED = {
    "bin/orchestra", "bin/hugr_omni.node", "bin/hugr-omni-supervisor",
    "bin/web/index.html", "bin/local/entry.mjs", "bin/local/closure.json",
    "bin/product/ai/manifests/resident.json",
}


def refuse(reason):
    raise RuntimeError("A7_INSTALL_REFUSED: " + reason)


def sha256(file):
    result = hashlib.sha256()
    with file.open("rb") as reader:
        for chunk in iter(lambda: reader.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def strict_name(value):
    if not isinstance(value, str) or len(value) > 1024 or not value or \
       not re.fullmatch(r"[A-Za-z0-9_@+./-]+", value) or \
       value.startswith("/") or "\\" in value or \
       any(piece in ("", ".", "..") or piece.endswith(".") for piece in value.split("/")):
        refuse("noncanonical archive path")
    return value


def must_file(path, owner=None, max_size=None):
    item = path.lstat()
    if path.is_symlink() or not stat.S_ISREG(item.st_mode) or item.st_nlink != 1 or \
       (owner is not None and item.st_uid != owner) or \
       (max_size is not None and item.st_size > max_size):
        refuse("untrusted file identity/path")
    return item


def parse_receipt(receipt_path, c, expected_sha):
    must_file(receipt_path, max_size=131072)
    try:
        receipt = json.loads(receipt_path.read_text("utf-8"))
    except (UnicodeError, ValueError):
        refuse("factory run receipt malformed")
    if not isinstance(receipt, dict) or \
       receipt.get("schema") != "sf-factory-package-proof-v1" or \
       receipt.get("sourceSHA") != c or receipt.get("checkoutSHA") != c or \
       receipt.get("expectedSourceSHA") != c or \
       receipt.get("archiveSha256") != expected_sha or \
       receipt.get("archiveFile") != "orchestra-sf-factory-linux-x64-baseline.tar.gz" or \
       receipt.get("target") != "linux-x64-baseline" or \
       receipt.get("checkedEndpoint") != "/sucafina/status" or \
       receipt.get("status") != 200 or receipt.get("extractedOutsideCheckout") is not True or \
       not SHA64.fullmatch(str(receipt.get("manifestSha256", ""))) or \
       not SHA64.fullmatch(str(receipt.get("bundleSha256", ""))) or \
       not isinstance(receipt.get("runID"), str) or not receipt["runID"].isdigit() or \
       not isinstance(receipt.get("runAttempt"), str) or not receipt["runAttempt"].isdigit():
        refuse("factory proof does not bind real candidate/CI tar and extracted status")
    return receipt


def validate_tar(artifact, c, expected_sha, receipt):
    # IMPORTANT: digest is checked BEFORE opening the archive for any mutation.
    must_file(artifact, max_size=MAX_BYTES)
    if sha256(artifact) != expected_sha:
        refuse("archive SHA256 mismatch -- ZERO filesystem changes")
    try:
        archive = tarfile.open(artifact, "r:gz")
    except (tarfile.TarError, OSError):
        refuse("expected *inner* producer factory .tar.gz, not GitHub Actions ZIP")
    try:
        members, total = {}, 0
        if len(archive.getmembers()) > MAX_FILES + 1024:
            refuse("too many tar members")
        for member in archive.getmembers():
            name = strict_name(member.name.rstrip("/") if member.isdir() else member.name)
            if member.isdir():
                # Directories may be present in a normal tar, never extracted from it.
                continue
            if not member.isfile() or member.issym() or member.islnk() or name in members:
                refuse("duplicate, symlink, hardlink or special member in archive")
            total += member.size
            if member.size < 0 or total > MAX_BYTES:
                refuse("archive expands beyond limit")
            members[name] = member
        meta = members.get("distribution.json")
        checksums = members.get("checksums.sha256")
        if not meta or not checksums or meta.size > 5_000_000 or checksums.size > 2_000_000:
            refuse("distribution manifest/checksum table missing or oversized")
        manifest_bytes = archive.extractfile(meta).read()
        if hashlib.sha256(manifest_bytes).hexdigest() != receipt["manifestSha256"]:
            refuse("distribution manifest SHA256 differs from CI proof")
        try:
            manifest = json.loads(manifest_bytes)
        except (UnicodeError, ValueError):
            refuse("invalid distribution JSON")
        if not isinstance(manifest, dict) or set(manifest) != {"schema", "version", "target", "files"} or \
           manifest["schema"] != "orchestra-distribution-v1" or manifest["target"] != "linux-x64-baseline" or \
           not isinstance(manifest["version"], str) or not manifest["version"]:
            refuse("wrong distribution target/schema")
        file_index = {}
        files = manifest["files"]
        if not isinstance(files, list) or not 8 <= len(files) <= MAX_FILES:
            refuse("empty or excessive manufacturer file index")
        for entry in files:
            if not isinstance(entry, dict) or set(entry) != {"path", "sha256", "executable"}:
                refuse("incomplete producer entry")
            name = strict_name(entry["path"])
            if name in file_index or name in ("distribution.json", "checksums.sha256") or \
               not SHA64.fullmatch(str(entry["sha256"])) or type(entry["executable"]) is not bool:
                refuse("invalid or duplicate producer entry")
            file_index[name] = entry
        if not REQUIRED.issubset(file_index):
            refuse("missing compiled binary/Web/Omni and trusted factory closure")
        if not file_index["bin/orchestra"]["executable"] or \
           not file_index["bin/hugr-omni-supervisor"]["executable"] or \
           file_index["bin/local/entry.mjs"]["executable"]:
            refuse("compiled executables or factory permissions invalid")
        if set(members) != set(file_index) | {"distribution.json", "checksums.sha256"}:
            refuse("tar contents differ from sealed producer file roster")
        table = archive.extractfile(checksums).read()
        # Producer checksums includes the distribution.json entry as well.
        table_entries = {**{name: entry["sha256"] for name, entry in file_index.items()},
                         "distribution.json": hashlib.sha256(manifest_bytes).hexdigest()}
        expected_table = "".join(f"{table_entries[name]}  {name}\n" for name in sorted(table_entries))
        if table != expected_table.encode("ascii"):
            refuse("producer checksums.sha256 table drift")
        closure = members["bin/local/closure.json"]
        if closure.size > 5_000_000:
            refuse("factory closure oversized")
        try:
            factory = json.loads(archive.extractfile(closure).read())
        except (UnicodeError, ValueError):
            refuse("factory closure unreadable")
        if not isinstance(factory, dict) or factory.get("schema") != "sf-factory-closure-v1" or \
           not isinstance(factory.get("bundle"), dict) or \
           factory["bundle"].get("path") != "bin/local/entry.mjs" or \
           factory["bundle"].get("sha256") != receipt["bundleSha256"] or \
           file_index["bin/local/entry.mjs"]["sha256"] != receipt["bundleSha256"]:
            refuse("CI factory bundle/source closure identity mismatch")
        return archive, members, file_index, manifest_bytes
    except Exception:
        archive.close()
        raise


def check_release(path, source, expected_sha, file_index, manifest_bytes, *, staging=False):
    valid_name = path.name == source or (staging and path.name.startswith(".factory-staging-"))
    if path.is_symlink() or not path.is_dir() or path.parent != RELEASES or not valid_name:
        refuse("immutable release path missing or not canonical")
    discovered = {}
    for base, dirs, files in os.walk(path, followlinks=False):
        for name in dirs + files:
            element = Path(base) / name
            if element.is_symlink():
                refuse("installed path contains symlink")
            if element.stat().st_uid != 0:
                refuse("installed release has non-root file/dir")
        for name in files:
            file = Path(base) / name
            if not file.is_file():
                refuse("installed special file")
            relative = file.relative_to(path).as_posix()
            if relative == ".a7-source.json":
                continue
            discovered[relative] = sha256(file)
            if relative in file_index:
                mode = 0o555 if file_index[relative]["executable"] else 0o444
                if stat.S_IMODE(file.stat().st_mode) != mode:
                    refuse("installed permission drift")
    expected = {key: row["sha256"] for key, row in file_index.items()}
    expected["distribution.json"] = hashlib.sha256(manifest_bytes).hexdigest()
    expected["checksums.sha256"] = hashlib.sha256(
        "".join(f"{expected[key]}  {key}\n" for key in sorted(expected) if key != "checksums.sha256").encode()
    ).hexdigest()
    if discovered != expected:
        refuse("installed release files/digests changed or incomplete")
    proof_path = path / ".a7-source.json"
    must_file(proof_path, owner=0, max_size=131072)
    proof = json.loads(proof_path.read_text("utf-8"))
    if proof.get("sourceSHA") != source or proof.get("archiveSha256") != expected_sha or \
       proof.get("manifestSha256") != expected["distribution.json"]:
        refuse("installed candidate/digest receipt does not match")
    with (path / "bin/orchestra").open("rb") as f:
        elf = f.read(20)
    if elf[:4] != b"\x7fELF" or len(elf) < 20 or elf[4:6] != b"\x02\x01" or elf[18:20] != b"\x3e\x00":
        refuse("CLI not Linux x86_64 ELF64")
    return proof


def vm_preflight(fqdn, *, require_maintenance=True):
    if os.geteuid() != 0 or os.uname().sysname != "Linux" or os.uname().machine != "x86_64":
        refuse("root on Azure Linux x86_64 required")
    if not FQDN.fullmatch(fqdn):
        refuse("invalid owner FQDN")
    owner = subprocess.run(["id", "-u", "orchestra-sf"], capture_output=True, text=True)
    if owner.returncode != 0 or owner.stdout.strip() == "0":
        refuse("nonprivileged orchestra-sf account absent")
    parent = RELEASES.parent
    if parent.is_symlink() or not parent.is_dir() or parent.stat().st_uid != 0 or \
       stat.S_IMODE(parent.stat().st_mode) != 0o755:
        refuse("managed root-owned 0755 /opt/orchestra-sf missing")
    state = Path("/var/lib/orchestra-sf")
    service_uid = int(owner.stdout.strip())
    if state.is_symlink() or not state.is_dir() or state.stat().st_uid != service_uid or \
       stat.S_IMODE(state.stat().st_mode) != 0o700:
        refuse("orchestra-sf persistent data mount is not owner-only")
    mount = subprocess.run(["findmnt", "-n", "-o", "TARGET", "--mountpoint", str(state)],
                           capture_output=True, text=True)
    if mount.returncode != 0 or mount.stdout.strip() != str(state):
        refuse("/var/lib/orchestra-sf is not independently mounted")
    if RELEASES.exists() and (RELEASES.is_symlink() or not RELEASES.is_dir() or RELEASES.stat().st_uid != 0):
        refuse("unsafe release directory")
    if not CADDY.is_file() or CADDY.is_symlink() or CADDY.stat().st_uid != 0:
        refuse("root-owned Caddy foundation not ready")
    # Operator must independently put public traffic into fail-closed 503 maintenance.
    caddy = CADDY.read_text("utf-8").strip()
    accepted = re.fullmatch(re.escape(fqdn) + r"\s*\{\s*respond\s+503\s*\}", caddy)
    managed = "# managed-orchestra-sf-mode: maintenance" in caddy and \
              caddy.count("{") >= 1 and fqdn + " {" in caddy and "respond 503" in caddy
    if require_maintenance:
        if not (accepted or managed):
            refuse("Caddy MUST be in 503 maintenance before changing current")
        if subprocess.run(["systemctl", "is-active", "--quiet", "orchestra-sf.service"]).returncode == 0:
            refuse("stop the application cleanly before switching live symlink")


def current_source():
    if CURRENT.exists() and not CURRENT.is_symlink():
        refuse("current path must not be a directory/file")
    if not CURRENT.is_symlink():
        return None
    target = CURRENT.resolve(strict=True)
    if target.parent != RELEASES or not SHA40.fullmatch(target.name) or target.is_symlink():
        refuse("untrusted current symlink or candidate")
    return target.name


def atomic_current(candidate):
    temp = CURRENT.parent / (".current-" + candidate + "-" + str(os.getpid()))
    if temp.exists() or temp.is_symlink():
        refuse("concurrent/current temp path conflict")
    temp.symlink_to(RELEASES / candidate)
    try:
        os.replace(temp, CURRENT)
        fd = os.open(CURRENT.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    finally:
        if temp.is_symlink():
            temp.unlink()


def install(a):
    if not SHA40.fullmatch(a.candidate) or not SHA64.fullmatch(a.sha256):
        refuse("expected exact candidate 40-hex and archive SHA256 64-hex")
    artifact = Path(a.artifact)
    receipt_file = Path(a.receipt)
    if not artifact.is_absolute() or not receipt_file.is_absolute():
        refuse("operator must pass absolute artifact and receipt files")
    # Digests and CI proof validation happen BEFORE any installer-owned writes.
    receipt = parse_receipt(receipt_file, a.candidate, a.sha256)
    archive, members, entries, manifest_bytes = validate_tar(artifact, a.candidate, a.sha256, receipt)
    try:
        vm_preflight(a.fqdn, require_maintenance=not a.dry_run)
        old = current_source()
        target = RELEASES / a.candidate
        if target.exists() or target.is_symlink():
            check_release(target, a.candidate, a.sha256, entries, manifest_bytes)
        if a.dry_run:
            print(json.dumps({"result": "DRY_RUN_NO_WRITES", "candidate": a.candidate,
                              "archiveDigest": a.sha256, "current": old, "targetExists": target.exists()}))
            return
        if not a.apply:
            refuse("explicit --apply required for any mutation")
        with os.fdopen(os.open(LOCK, os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600), "w") as mutex:
            fcntl.flock(mutex.fileno(), fcntl.LOCK_EX)
            vm_preflight(a.fqdn)
            old = current_source()
            if not RELEASES.exists():
                RELEASES.mkdir(mode=0o755)
            if not target.exists():
                temp = Path(tempfile.mkdtemp(prefix=".factory-staging-", dir=RELEASES))
                try:
                    # The tar was verified before entry; do not trust its permissions.
                    for name, entry in sorted(entries.items()):
                        destination = temp / name
                        destination.parent.mkdir(parents=True, mode=0o755, exist_ok=True)
                        fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
                        h = hashlib.sha256()
                        with os.fdopen(fd, "wb") as out, archive.extractfile(members[name]) as source:
                            while data := source.read(1024 * 1024):
                                h.update(data)
                                out.write(data)
                            out.flush()
                            os.fsync(out.fileno())
                        if h.hexdigest() != entry["sha256"]:
                            refuse("archive payload changed while staging: " + name)
                        destination.chmod(0o555 if entry["executable"] else 0o444)
                    for key in ("distribution.json", "checksums.sha256"):
                        dest = temp / key
                        with os.fdopen(os.open(dest, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o400), "wb") as out:
                            source = archive.extractfile(members[key])
                            shutil.copyfileobj(source, out, 1024 * 1024)
                            out.flush()
                            os.fsync(out.fileno())
                    (temp / ".a7-source.json").write_text(json.dumps({
                        "schema": "orchestra-sf.a7-ci-release-v1",
                        "sourceSHA": a.candidate, "archiveSha256": a.sha256,
                        "manifestSha256": receipt["manifestSha256"],
                        "runID": receipt["runID"], "runAttempt": receipt["runAttempt"]
                    }, sort_keys=True) + "\n")
                    (temp / ".a7-source.json").chmod(0o444)
                    if sha256(temp / "distribution.json") != receipt["manifestSha256"]:
                        refuse("staged distribution.json changed")
                    for folder, _, _ in os.walk(temp):
                        Path(folder).chmod(0o555)
                    # No invalid/tampered factory release can be published even momentarily.
                    check_release(temp, a.candidate, a.sha256, entries, manifest_bytes, staging=True)
                    os.rename(temp, target)
                finally:
                    if temp.exists():
                        shutil.rmtree(temp)
            check_release(target, a.candidate, a.sha256, entries, manifest_bytes)
            if old != a.candidate:
                atomic_current(a.candidate)
            print(json.dumps({"result": "INSTALLED_NOT_STARTED_CADDY_STILL_503",
                              "candidate": a.candidate, "previous": old,
                              "archiveDigest": a.sha256, "idempotent": old == a.candidate}))
    finally:
        archive.close()


def rollback(a):
    if not SHA40.fullmatch(a.from_candidate) or not SHA40.fullmatch(a.to_candidate) or \
       a.from_candidate == a.to_candidate:
        refuse("rollback from/to must be distinct exact frozen SHAs")
    vm_preflight(a.fqdn, require_maintenance=not a.dry_run)
    if current_source() != a.from_candidate:
        refuse("current release changed: expected --from-candidate")
    target = RELEASES / a.to_candidate
    if not target.is_dir() or target.is_symlink():
        refuse("retained previous release absent")
    proof = json.loads((target / ".a7-source.json").read_text("utf-8"))
    if proof.get("schema") != "orchestra-sf.a7-ci-release-v1" or \
       proof.get("sourceSHA") != a.to_candidate or \
       not SHA64.fullmatch(str(proof.get("archiveSha256", ""))):
        refuse("previous release not an A7-verified immutable artifact")
    distribution = json.loads((target / "distribution.json").read_text("utf-8"))
    file_index = {e["path"]: e for e in distribution["files"]}
    check_release(target, a.to_candidate, proof["archiveSha256"], file_index,
                  (target / "distribution.json").read_bytes())
    if a.dry_run:
        print(json.dumps({"result": "DRY_RUN_NO_WRITES", "from": a.from_candidate, "to": a.to_candidate}))
        return
    if not a.apply:
        refuse("rollback requires explicit --apply")
    with open(LOCK, "a+", encoding="ascii") as mutex:
        fcntl.flock(mutex.fileno(), fcntl.LOCK_EX)
        vm_preflight(a.fqdn)
        if current_source() != a.from_candidate:
            refuse("concurrent release switch")
        atomic_current(a.to_candidate)
        print(json.dumps({"result": "ROLLED_BACK_CODE_ONLY_CADDY_STILL_503",
                          "from": a.from_candidate, "to": a.to_candidate,
                          "data": "UNTOUCHED_SCHEMA_COMPATIBILITY_REQUIRED"}))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    commands = p.add_subparsers(dest="command", required=True)
    ins = commands.add_parser("install")
    ins.add_argument("--artifact", required=True)
    ins.add_argument("--sha256", required=True)
    ins.add_argument("--receipt", required=True)
    ins.add_argument("--candidate", required=True)
    roll = commands.add_parser("rollback")
    roll.add_argument("--from-candidate", required=True)
    roll.add_argument("--to-candidate", required=True)
    for cmd in (ins, roll):
        cmd.add_argument("--fqdn", required=True)
        mode = cmd.add_mutually_exclusive_group(required=True)
        mode.add_argument("--dry-run", action="store_true")
        mode.add_argument("--apply", action="store_true")
    a = p.parse_args()
    try:
        {"install": install, "rollback": rollback}[a.command](a)
    except (OSError, ValueError, KeyError, RuntimeError, tarfile.TarError, json.JSONDecodeError) as err:
        print("INSTALL_BLOCKED: " + str(err), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
