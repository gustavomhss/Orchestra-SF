#!/usr/bin/env python3
"""Stage and select an immutable Orchestra-SF Azure Entra distribution.

The operator verifies public 503 maintenance and stops the service before apply.
Dry run only reads host and package state.
"""
import argparse
from contextlib import contextmanager
import fcntl
import hashlib
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
ARCHIVE = "orchestra-sf-entra-linux-x64-baseline.tar.gz"
RELEASE_SCHEMA = "orchestra-sf.a7-entra-release-v1"
FACTORY_ENTRY = "modules/sucafina/Sucafinav1/local/microsoft-entry.ts"
REQUIRED = {
    "bin/orchestra", "bin/hugr_omni.node", "bin/hugr-omni-supervisor",
    "package.json", "bin/local/entry.mjs", "bin/local/closure.json",
}


def refuse(reason):
    raise RuntimeError("A7_INSTALL_REFUSED: " + reason)


def sha256(file):
    with file.open("rb") as reader:
        return hash_stream(reader)


def hash_stream(reader):
    result = hashlib.sha256()
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


@contextmanager
def root_input(path, maximum, mode=None):
    with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), "rb") as reader:
        item = os.fstat(reader.fileno())
        if not stat.S_ISREG(item.st_mode) or item.st_uid != 0 or item.st_nlink != 1 or \
           item.st_mode & 0o022 or not 0 < item.st_size <= maximum or \
           (mode is not None and stat.S_IMODE(item.st_mode) != mode):
            refuse("input must be a bounded, protected root-owned file")
        yield reader


def parse_receipt(receipt_path, c, expected_sha):
    with root_input(receipt_path, 131072) as file:
        try:
            receipt = json.load(file)
        except (UnicodeError, ValueError):
            refuse("factory package receipt malformed")
    if not isinstance(receipt, dict) or \
       receipt.get("schema") != "sf-entra-factory-package-v1" or receipt.get("proof") != "packaged" or \
       receipt.get("sourceSHA") != c or receipt.get("checkoutSHA") != c or \
       receipt.get("expectedSourceSHA") != c or \
       receipt.get("archiveSha256") != expected_sha or \
       receipt.get("archiveFile") != ARCHIVE or \
       receipt.get("target") != "linux-x64-baseline" or \
       not SHA64.fullmatch(str(receipt.get("manifestSha256", ""))) or \
       not SHA64.fullmatch(str(receipt.get("bundleSha256", ""))):
        refuse("package receipt does not bind this Entra archive and candidate")
    if "runID" in receipt or "runAttempt" in receipt:
        if any(not isinstance(receipt.get(field), str) or not re.fullmatch(r"[1-9][0-9]*", receipt[field])
               for field in ("runID", "runAttempt")):
            refuse("invalid hosted run identity")
    return receipt


def validate_tar(artifact, c, expected_sha, receipt):
    # IMPORTANT: digest is checked BEFORE opening the archive for any mutation.
    if hash_stream(artifact) != expected_sha:
        refuse("archive SHA256 mismatch -- ZERO filesystem changes")
    artifact.seek(0)
    try:
        archive = tarfile.open(fileobj=artifact, mode="r:gz")
    except (tarfile.TarError, OSError):
        refuse("expected *inner* producer factory .tar.gz, not GitHub Actions ZIP")
    try:
        members, total = {}, 0
        for index, member in enumerate(archive):
            if index >= MAX_FILES + 1024:
                refuse("too many tar members")
            name = strict_name(member.name.rstrip("/") if member.isdir() else member.name)
            if member.isdir():
                # Directories may be present in a normal tar, never extracted from it.
                continue
            if not member.isfile() or member.issparse() or name in members:
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
        if not isinstance(files, list) or not len(REQUIRED) <= len(files) <= MAX_FILES:
            refuse("empty or excessive manufacturer file index")
        for entry in files:
            if not isinstance(entry, dict) or set(entry) != {"path", "sha256", "executable"}:
                refuse("incomplete producer entry")
            name = strict_name(entry["path"])
            if name in file_index or (name != "package.json" and not name.startswith("bin/")) or \
               not SHA64.fullmatch(str(entry["sha256"])) or type(entry["executable"]) is not bool:
                refuse("invalid or duplicate producer entry")
            file_index[name] = entry
        if not REQUIRED.issubset(file_index):
            refuse("missing compiled CLI, Omni or trusted Entra factory closure")
        if not file_index["bin/orchestra"]["executable"] or \
           not file_index["bin/hugr-omni-supervisor"]["executable"] or \
           file_index["bin/local/entry.mjs"]["executable"]:
            refuse("compiled executables or factory permissions invalid")
        if set(members) != set(file_index) | {"distribution.json", "checksums.sha256"}:
            refuse("tar contents differ from sealed producer file roster")
        for name in file_index:
            for parent in Path(name).parents:
                if parent.as_posix() in file_index:
                    refuse("producer file also used as a directory")
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
           factory.get("entry") != FACTORY_ENTRY or \
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
    if path.is_symlink() or not path.is_dir() or path.parent != RELEASES or not valid_name or \
       path.stat().st_uid != 0 or stat.S_IMODE(path.stat().st_mode) != 0o555:
        refuse("immutable release path missing or not canonical")
    discovered = {}
    for base, dirs, files in os.walk(path, followlinks=False):
        for name in dirs + files:
            element = Path(base) / name
            if element.is_symlink():
                refuse("installed path contains symlink")
            if element.stat().st_uid != 0:
                refuse("installed release has non-root file/dir")
            if element.is_dir() and stat.S_IMODE(element.stat().st_mode) != 0o555:
                refuse("installed directory permission drift")
        for name in files:
            file = Path(base) / name
            must_file(file, owner=0)
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
    if not isinstance(proof, dict) or proof.get("schema") != RELEASE_SCHEMA or \
       proof.get("sourceSHA") != source or proof.get("archiveSha256") != expected_sha or \
       proof.get("manifestSha256") != expected["distribution.json"]:
        refuse("installed candidate/digest receipt does not match")
    for native in ("bin/orchestra", "bin/hugr_omni.node", "bin/hugr-omni-supervisor"):
        with (path / native).open("rb") as f:
            elf = f.read(20)
        if elf[:4] != b"\x7fELF" or len(elf) < 20 or elf[4:6] != b"\x02\x01" or elf[18:20] != b"\x3e\x00":
            refuse("native ELF not Linux x86_64 ELF64: " + native)
    return proof


def vm_preflight(fqdn, *, require_maintenance=True):
    if os.geteuid() != 0 or os.uname().sysname != "Linux" or os.uname().machine != "x86_64":
        refuse("root on Azure Linux x86_64 required")
    if len(fqdn) > 253 or not FQDN.fullmatch(fqdn):
        refuse("invalid owner FQDN")
    owner = subprocess.run(["/usr/bin/id", "-u", "orchestra-sf"], capture_output=True, text=True)
    if owner.returncode != 0 or owner.stdout.strip() == "0":
        refuse("nonprivileged orchestra-sf account absent")
    parent = RELEASES.parent
    if parent.resolve() != parent or not parent.is_dir() or parent.stat().st_uid != 0 or \
       stat.S_IMODE(parent.stat().st_mode) != 0o755:
        refuse("managed root-owned 0755 /opt/orchestra-sf missing")
    state = Path("/var/lib/orchestra-sf")
    service_uid = int(owner.stdout.strip())
    if state.is_symlink() or not state.is_dir() or state.stat().st_uid != service_uid or \
       stat.S_IMODE(state.stat().st_mode) != 0o700:
        refuse("orchestra-sf persistent data mount is not owner-only")
    mount = subprocess.run(["/usr/bin/findmnt", "-n", "-o", "TARGET", "--mountpoint", str(state)],
                           capture_output=True, text=True)
    if mount.returncode != 0 or mount.stdout.strip() != str(state):
        refuse("/var/lib/orchestra-sf is not independently mounted")
    if RELEASES.is_symlink() or (RELEASES.exists() and (not RELEASES.is_dir() or RELEASES.stat().st_uid != 0 or
       stat.S_IMODE(RELEASES.stat().st_mode) != 0o755)):
        refuse("unsafe release directory")
    with root_input(CADDY, 65536) as file:
        caddy = file.read().decode("utf-8").strip()
    if require_maintenance:
        if not re.fullmatch(r"(?:# managed-orchestra-sf-mode: maintenance\n)?" + re.escape(fqdn) +
                            r"[ \t]*\{\s*respond[ \t]+503\s*\}", caddy):
            refuse("Caddy MUST be in 503 maintenance before changing current")
        service = subprocess.run(["/usr/bin/systemctl", "show", "--property=ActiveState", "--value",
                                  "orchestra-sf.service"], capture_output=True, text=True)
        if service.returncode != 0 or service.stdout.strip() != "inactive":
            refuse("stop the application cleanly before switching live symlink")


def current_source():
    if CURRENT.exists() and not CURRENT.is_symlink():
        refuse("current path must not be a directory/file")
    if not CURRENT.is_symlink():
        return None
    target = Path(os.readlink(CURRENT))
    if target.parent != RELEASES or not SHA40.fullmatch(target.name) or target.is_symlink() or not target.is_dir():
        refuse("untrusted current symlink or candidate")
    return target.name


def atomic_current(candidate):
    temp = CURRENT.parent / (".current-" + candidate + "-" + str(os.getpid()))
    if temp.exists() or temp.is_symlink():
        refuse("concurrent/current temp path conflict")
    temp.symlink_to(RELEASES / candidate)
    try:
        os.replace(temp, CURRENT)
        sync_directory(CURRENT.parent)
    finally:
        if temp.is_symlink():
            temp.unlink()


def sync_directory(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


@contextmanager
def install_lock():
    fd = os.open(LOCK, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC, 0o600)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_nlink != 1 or \
           stat.S_IMODE(info.st_mode) != 0o600:
            refuse("unsafe installer lock")
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        os.close(fd)


def install(a):
    if not SHA40.fullmatch(a.candidate) or not SHA64.fullmatch(a.sha256):
        refuse("expected exact candidate 40-hex and archive SHA256 64-hex")
    artifact = Path(a.artifact)
    receipt_file = Path(a.receipt)
    if not artifact.is_absolute() or not receipt_file.is_absolute():
        refuse("operator must pass absolute artifact and receipt files")
    # The receipt and archive digest are checked before changing the host.
    receipt = parse_receipt(receipt_file, a.candidate, a.sha256)
    with root_input(artifact, MAX_BYTES) as reader:
        install_archive(a, reader, receipt)


def install_archive(a, artifact, receipt):
    archive, members, entries, manifest_bytes = validate_tar(artifact, a.candidate, a.sha256, receipt)
    try:
        vm_preflight(a.fqdn, require_maintenance=not a.dry_run)
        old = current_source()
        target = RELEASES / a.candidate
        if target.exists() or target.is_symlink():
            check_release(target, a.candidate, a.sha256, entries, manifest_bytes)
        if a.dry_run:
            for name, entry in entries.items():
                with archive.extractfile(members[name]) as source:
                    if hash_stream(source) != entry["sha256"]:
                        refuse("archive payload differs from manifest: " + name)
            print(json.dumps({"result": "DRY_RUN_NO_WRITES", "candidate": a.candidate,
                              "archiveDigest": a.sha256, "current": old, "targetExists": target.exists()}))
            return
        if not a.apply:
            refuse("explicit --apply required for any mutation")
        with install_lock():
            vm_preflight(a.fqdn)
            old = current_source()
            if not RELEASES.exists():
                RELEASES.mkdir(mode=0o755)
                RELEASES.chmod(0o755)
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
                            os.fchmod(out.fileno(), 0o555 if entry["executable"] else 0o444)
                            os.fsync(out.fileno())
                        if h.hexdigest() != entry["sha256"]:
                            refuse("archive payload changed while staging: " + name)
                    for key in ("distribution.json", "checksums.sha256"):
                        dest = temp / key
                        with os.fdopen(os.open(dest, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o444), "wb") as out, \
                             archive.extractfile(members[key]) as source:
                            shutil.copyfileobj(source, out, 1024 * 1024)
                            out.flush()
                            os.fchmod(out.fileno(), 0o444)
                            os.fsync(out.fileno())
                    with (temp / ".a7-source.json").open("x", encoding="utf-8") as proof:
                        json.dump({"schema": RELEASE_SCHEMA, "sourceSHA": a.candidate, "archiveSha256": a.sha256,
                                   "manifestSha256": receipt["manifestSha256"],
                                   **{key: receipt[key] for key in ("runID", "runAttempt") if key in receipt}},
                                  proof, sort_keys=True)
                        proof.flush()
                        os.fchmod(proof.fileno(), 0o444)
                        os.fsync(proof.fileno())
                    if sha256(temp / "distribution.json") != receipt["manifestSha256"]:
                        refuse("staged distribution.json changed")
                    for folder, _, _ in os.walk(temp, topdown=False):
                        Path(folder).chmod(0o555)
                        sync_directory(folder)
                    # No invalid/tampered factory release can be published even momentarily.
                    check_release(temp, a.candidate, a.sha256, entries, manifest_bytes, staging=True)
                    os.rename(temp, target)
                    sync_directory(RELEASES)
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


def check_rollback_approval(a):
    approval_file = Path(a.approval)
    proof_file = Path(a.compatibility_proof)
    if not approval_file.is_absolute() or not proof_file.is_absolute():
        refuse("rollback approval/proof must be absolute private files")
    with root_input(approval_file, 65536, 0o600) as file:
        approval = json.load(file)
    with root_input(proof_file, 65536, 0o600) as file:
        proof_bytes = file.read()
        proof = json.loads(proof_bytes)
    if not isinstance(approval, dict) or \
       approval.get("schema") != "orchestra-sf.a7-code-rollback-approval.v1" or \
       approval.get("fromCandidate") != a.from_candidate or \
       approval.get("toCandidate") != a.to_candidate or \
       approval.get("schemaCompatible") is not True or \
       approval.get("compatibilityProofSha256") != hashlib.sha256(proof_bytes).hexdigest() or \
       not isinstance(approval.get("approvedBy"), str) or not approval["approvedBy"].strip() or \
       not isinstance(approval.get("approvedAtUtc"), str) or not approval["approvedAtUtc"].endswith("Z") or \
       not isinstance(approval.get("backupRecoveryPointId"), str) or not approval["backupRecoveryPointId"]:
        refuse("owner approval must bind exact rollback C, reviewed compatibility, recovery point")
    if not isinstance(proof, dict) or \
       proof.get("schema") != "orchestra-sf.azure-migration-compatibility.v1" or \
       proof.get("currentCandidate") != a.from_candidate or \
       proof.get("targetCandidate") != a.to_candidate or \
       proof.get("compatible") is not True or \
       not isinstance(proof.get("reviewer"), str) or not proof["reviewer"].strip() or \
       proof["reviewer"] == approval["approvedBy"]:
        refuse("independently reviewed compatibility proof missing")
    return approval


def rollback(a):
    if not SHA40.fullmatch(a.from_candidate) or not SHA40.fullmatch(a.to_candidate) or \
       a.from_candidate == a.to_candidate:
        refuse("rollback from/to must be distinct exact frozen SHAs")
    vm_preflight(a.fqdn, require_maintenance=not a.dry_run)
    if current_source() != a.from_candidate:
        refuse("current release changed: expected --from-candidate")
    check_rollback_approval(a)
    check_rollback_release(a.to_candidate)
    if a.dry_run:
        print(json.dumps({"result": "DRY_RUN_NO_WRITES", "from": a.from_candidate, "to": a.to_candidate}))
        return
    if not a.apply:
        refuse("rollback requires explicit --apply")
    with install_lock():
        vm_preflight(a.fqdn)
        if current_source() != a.from_candidate:
            refuse("concurrent release switch")
        check_rollback_approval(a)
        check_rollback_release(a.to_candidate)
        atomic_current(a.to_candidate)
        print(json.dumps({"result": "ROLLED_BACK_CODE_ONLY_CADDY_STILL_503",
                          "from": a.from_candidate, "to": a.to_candidate,
                          "data": "UNTOUCHED_SCHEMA_COMPATIBILITY_REQUIRED"}))


def check_rollback_release(candidate):
    target = RELEASES / candidate
    if not target.is_dir() or target.is_symlink():
        refuse("retained previous release absent")
    with root_input(target / ".a7-source.json", 131072) as file:
        proof = json.load(file)
    if not isinstance(proof, dict) or proof.get("schema") != RELEASE_SCHEMA or \
       proof.get("sourceSHA") != candidate or \
       not SHA64.fullmatch(str(proof.get("archiveSha256", ""))):
        refuse("previous release lacks an immutable Entra receipt")
    with root_input(target / "distribution.json", 5_000_000) as file:
        manifest_bytes = file.read()
    if hashlib.sha256(manifest_bytes).hexdigest() != proof.get("manifestSha256"):
        refuse("rollback manifest SHA256 differs from receipt")
    distribution = json.loads(manifest_bytes)
    file_index = {e["path"]: e for e in distribution["files"]}
    check_release(target, candidate, proof["archiveSha256"], file_index, manifest_bytes)


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
    roll.add_argument("--approval", required=True)
    roll.add_argument("--compatibility-proof", required=True)
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
