#!/usr/bin/env python3
"""Private, stopped-host checkpoint and isolated clone integrity for G10.

This adapter never starts a service, switches releases, restores over live data,
publishes a recovery pin, or claims the installed Teams rehearsal has passed.
"""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import http.client
import importlib.util
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import sqlite3
import stat
import sys
import tarfile
import tempfile

STATE = Path("/var/lib/orchestra-sf")
CONFIGURATION = Path("/etc/orchestra-sf")
MAX_FILES = 100000
MAX_BYTES = 256 * 1024**3
MAX_MANIFEST = 32 * 1024**2
CHUNK = 1024**2
SHA40 = re.compile(r"[0-9a-f]{40}\Z")
SHA64 = re.compile(r"[0-9a-f]{64}\Z")


def refuse(reason):
    raise ValueError("G10_CHECKPOINT_REFUSED: " + reason)


def canonical_json(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()


def file_identity(info):
    return (info.st_dev, info.st_ino, info.st_mode, info.st_nlink, info.st_uid,
            info.st_gid, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


@contextmanager
def regular_file(path, *, private=False, maximum=MAX_BYTES):
    path = Path(path)
    if not path.is_absolute() or path.resolve() != path:
        refuse("regular file path must be absolute without symlinks")
    with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), "rb") as stream:
        before = os.fstat(stream.fileno())
        if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or before.st_size > maximum:
            refuse("only bounded regular files with one link are admitted")
        if private and (before.st_uid != os.geteuid() or stat.S_IMODE(before.st_mode) != 0o600):
            refuse("private input must be owned by the operator with mode 0600")
        yield stream
        if file_identity(before) != file_identity(os.fstat(stream.fileno())) or \
           file_identity(before) != file_identity(path.lstat()):
            refuse("file changed while being observed")


def digest_stream(stream):
    result = hashlib.sha256()
    for chunk in iter(lambda: stream.read(CHUNK), b""):
        result.update(chunk)
    return result.hexdigest()


def file_digest(path):
    with regular_file(path) as stream:
        return digest_stream(stream)


def private_directory(path, *, empty=False):
    path = Path(path)
    if not path.is_absolute() or path.resolve() != path:
        refuse("private directory path must be absolute without symlinks")
    info = path.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid() or \
       stat.S_IMODE(info.st_mode) != 0o700 or (empty and list(path.iterdir())):
        refuse("expected an operator-owned 0700 directory with admitted contents")
    return path


def private_json(path, maximum=MAX_MANIFEST):
    with regular_file(path, private=True, maximum=maximum) as stream:
        return json.load(stream)


def safe_name(value):
    if not isinstance(value, str) or len(value) > 4096 or not value or \
       PurePosixPath(value).as_posix() != value or value.startswith("/") or "\\" in value or \
       any(part in ("", ".", "..") for part in value.split("/")) or \
       any(ord(char) < 32 for char in value):
        refuse("archive path is not canonical")
    return value


def sqlite_check(path):
    # A cleanly stopped service must settle its journals through the supported
    # shutdown path. Never checkpoint/truncate a live database from this tool.
    for suffix in ("-wal", "-journal"):
        journal = Path(str(path) + suffix)
        if journal.exists() and (journal.is_symlink() or journal.stat().st_size):
            refuse("unsettled SQLite journal: clean shutdown is required")
    database = sqlite3.connect(path.as_uri() + "?mode=ro&immutable=1", uri=True)
    try:
        if database.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
            refuse("SQLite integrity check failed")
    finally:
        database.close()


def inventory(roots):
    if not isinstance(roots, dict) or not roots:
        refuse("nonempty source roots required")
    entries = []
    databases = []
    total = 0
    for label, root in sorted(roots.items()):
        if safe_name(label) != label or "/" in label or label.startswith("."):
            refuse("source label must be a single visible component")
        root = Path(root)
        if not root.is_absolute() or root.resolve() != root or not root.is_dir():
            refuse("source root must be a real directory")
        device = root.stat().st_dev
        paths = [root]
        for directory, folders, files in os.walk(root, followlinks=False):
            folders.sort()
            files.sort()
            paths.extend(Path(directory) / name for name in folders + files)
            if len(paths) + len(entries) > MAX_FILES:
                refuse("inventory limit exceeded")
        for path in sorted(paths):
            info = path.lstat()
            name = safe_name(label if path == root else label + "/" + path.relative_to(root).as_posix())
            if info.st_dev != device or not (stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode)):
                refuse("source contains a link, special file or unadmitted nested mount")
            entry = {"path": name, "kind": "directory", "mode": stat.S_IMODE(info.st_mode),
                     "uid": info.st_uid, "gid": info.st_gid}
            if stat.S_ISREG(info.st_mode):
                with regular_file(path) as stream:
                    sqlite = stream.read(16) == b"SQLite format 3\x00"
                    stream.seek(0)
                    entry.update(kind="file", size=info.st_size, sha256=digest_stream(stream))
                total += info.st_size
                if total > MAX_BYTES:
                    refuse("inventory byte limit exceeded")
                if sqlite:
                    sqlite_check(path)
                    databases.append(name)
            entries.append(entry)
    if not databases:
        refuse("no actual SQLite store found in the complete source inventory")
    return {"schema": "orchestra-sf.checkpoint-inventory.v2", "entries": entries,
            "sqlite": databases, "bytes": total}


def write_private(path, value):
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600), "wb") as out:
        out.write(canonical_json(value))
        out.flush()
        os.fsync(out.fileno())


def checkpoint_files(roots, destination, binding):
    destination = private_directory(destination)
    if any(destination == root or root in destination.parents for root in roots.values()):
        refuse("checkpoint destination must be outside every source root")
    observed = inventory(roots)
    manifest = canonical_json(observed)
    if len(manifest) > MAX_MANIFEST:
        refuse("inventory exceeds the bounded receipt format")
    fd, temporary = tempfile.mkstemp(prefix=".checkpoint-", dir=destination)
    archive = Path(temporary + ".tar.gz")
    try:
        with os.fdopen(fd, "wb") as stream:
            with tarfile.open(fileobj=stream, mode="w:gz", format=tarfile.PAX_FORMAT) as output:
                metadata = tarfile.TarInfo(".inventory.json")
                metadata.size = len(manifest)
                metadata.mode = 0o600
                output.addfile(metadata, io.BytesIO(manifest))
                for entry in observed["entries"]:
                    member = tarfile.TarInfo(entry["path"])
                    member.mode = 0o700 if entry["kind"] == "directory" else 0o600
                    if entry["kind"] == "directory":
                        member.type = tarfile.DIRTYPE
                        output.addfile(member)
                        continue
                    label, relative = entry["path"].split("/", 1)
                    member.size = entry["size"]
                    with regular_file(roots[label] / relative) as source:
                        output.addfile(member, source)
            stream.flush()
            os.fsync(stream.fileno())
        if inventory(roots) != observed:
            refuse("source changed during checkpoint; no receipt can be issued")
        receipt = {"schema": "orchestra-sf.teams-checkpoint.v2", "binding": binding,
                   "createdAtUtc": datetime.now(timezone.utc).isoformat(),
                   "archive": {"sha256": file_digest(Path(temporary)), "bytes": Path(temporary).stat().st_size},
                   "manifestSha256": hashlib.sha256(manifest).hexdigest(),
                   "entryCount": len(observed["entries"]), "sqliteCount": len(observed["sqlite"]),
                   "proofClass": "FILES_CHECKPOINT_INTEGRITY_ONLY", "releaseQualified": False,
                   "businessRecovery": "NOT_RUN", "keyDecryption": "NOT_RUN"}
        verify_checkpoint(Path(temporary), receipt)
        os.rename(temporary, archive)
        write_private(Path(str(archive) + ".json"), receipt)
        directory_fd = os.open(destination, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
        return archive, receipt
    finally:
        Path(temporary).unlink(missing_ok=True)


def verify_checkpoint(archive, receipt, target=None):
    if receipt.get("schema") != "orchestra-sf.teams-checkpoint.v2" or \
       receipt.get("releaseQualified") is not False or \
       not SHA64.fullmatch(str(receipt.get("archive", {}).get("sha256", ""))) or \
       not SHA64.fullmatch(str(receipt.get("manifestSha256", ""))):
        refuse("checkpoint receipt is missing or malformed")
    with regular_file(archive, private=True) as source:
        if os.fstat(source.fileno()).st_size != receipt["archive"].get("bytes") or \
           digest_stream(source) != receipt["archive"]["sha256"]:
            refuse("checkpoint archive hash or size differs")
        source.seek(0)
        with tarfile.open(fileobj=source, mode="r:gz") as package:
            first = package.next()
            if first is None or first.name != ".inventory.json" or not first.isfile() or \
               first.size > MAX_MANIFEST or first.size <= 0:
                refuse("checkpoint inventory must be the first bounded regular member")
            manifest_bytes = package.extractfile(first).read(MAX_MANIFEST + 1)
            if hashlib.sha256(manifest_bytes).hexdigest() != receipt["manifestSha256"]:
                refuse("checkpoint inventory hash differs")
            manifest = json.loads(manifest_bytes)
            entries = manifest.get("entries")
            if manifest.get("schema") != "orchestra-sf.checkpoint-inventory.v2" or not isinstance(entries, list) or \
               not 0 < len(entries) <= MAX_FILES or len(entries) != receipt.get("entryCount"):
                refuse("checkpoint inventory count differs")
            expected = {safe_name(entry["path"]): entry for entry in entries}
            if len(expected) != len(entries):
                refuse("duplicate inventory paths")
            for name, entry in expected.items():
                parent = PurePosixPath(name).parent.as_posix()
                if (parent == "." and entry.get("kind") != "directory") or \
                   (parent != "." and expected.get(parent, {}).get("kind") != "directory"):
                    refuse("inventory lacks an explicit parent directory")
            seen = set()
            total = 0
            for member in iter(package.next, None):
                name = safe_name(member.name)
                if name in seen or name not in expected or member.issparse():
                    refuse("duplicate, extra or sparse archive member")
                entry = expected[name]
                seen.add(name)
                if entry.get("kind") == "directory":
                    if not member.isdir() or member.size:
                        refuse("archive directory differs from inventory")
                    if target is not None:
                        (target / name).mkdir(mode=0o700, parents=True, exist_ok=True)
                    continue
                if entry.get("kind") != "file" or not member.isfile() or member.size != entry.get("size") or \
                   not SHA64.fullmatch(str(entry.get("sha256", ""))):
                    refuse("archive file differs from inventory")
                total += member.size
                if total > MAX_BYTES:
                    refuse("archive decompressed byte limit exceeded")
                digest = hashlib.sha256()
                output = None
                try:
                    if target is not None:
                        (target / name).parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                        output = os.fdopen(os.open(target / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600), "wb")
                    with package.extractfile(member) as payload:
                        for chunk in iter(lambda: payload.read(CHUNK), b""):
                            digest.update(chunk)
                            if output is not None:
                                output.write(chunk)
                    if output is not None:
                        output.flush()
                        os.fsync(output.fileno())
                finally:
                    if output is not None:
                        output.close()
                if digest.hexdigest() != entry["sha256"]:
                    refuse("archive file hash differs from inventory")
            if seen != set(expected) or total != manifest.get("bytes") or \
               len(manifest.get("sqlite", [])) != receipt.get("sqliteCount") or not manifest.get("sqlite"):
                refuse("incomplete checkpoint inventory")
            return manifest


def restore_clone_files(archive, receipt, target):
    target = private_directory(target, empty=True)
    verify_checkpoint(archive, receipt)
    staging = Path(tempfile.mkdtemp(prefix=".restore-", dir=target))
    try:
        manifest = verify_checkpoint(archive, receipt, staging)
        for name in manifest["sqlite"]:
            if name not in {entry["path"] for entry in manifest["entries"] if entry["kind"] == "file"}:
                refuse("SQLite inventory points outside restored files")
            sqlite_check(staging / name)
        roots = {entry["path"]: staging / entry["path"] for entry in manifest["entries"] if "/" not in entry["path"]}
        restored = inventory(roots)
        content = lambda item: {key: item[key] for key in ("path", "kind", "size", "sha256") if key in item}
        if [content(entry) for entry in restored["entries"]] != [content(entry) for entry in manifest["entries"]] or \
           restored["sqlite"] != manifest["sqlite"]:
            refuse("restored files or SQLite roster differ from the complete inventory")
        os.rename(staging, target / "restored")
        return {"schema": "orchestra-sf.teams-clone-integrity.v2", "binding": receipt["binding"],
                "sourceArchiveSha256": receipt["archive"]["sha256"],
                "manifestSha256": receipt["manifestSha256"], "entryCount": receipt["entryCount"],
                "sqliteCount": receipt["sqliteCount"], "proofClass": "ISOLATED_CLONE_FILE_INTEGRITY_ONLY",
                "businessRecovery": "NOT_RUN", "keyDecryption": "NOT_RUN", "releaseQualified": False}
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def installer_module():
    spec = importlib.util.spec_from_file_location("g10_installer", Path(__file__).resolve().parents[1] / "vm/install-factory-distribution.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def azure_identity():
    connection = http.client.HTTPConnection("169.254.169.254", timeout=3)
    try:
        connection.request("GET", "/metadata/instance/compute?api-version=2021-02-01", headers={"Metadata": "true"})
        response = connection.getresponse()
        body = response.read(16385)
        if response.status != 200 or len(body) > 16384:
            refuse("bounded Azure VM identity unavailable")
        identity = json.loads(body).get("resourceId")
        if not isinstance(identity, str) or not re.fullmatch(r"/subscriptions/[^/]+/resourceGroups/[^/]+/providers/Microsoft.Compute/virtualMachines/[^/]+", identity, re.IGNORECASE):
            refuse("Azure VM identity invalid")
        return identity.lower()
    finally:
        connection.close()


def admission(file, command):
    if os.geteuid() != 0 or sys.platform != "linux" or os.uname().machine != "x86_64":
        refuse("root Linux x64 required for the operational adapter")
    reservation = private_json(Path(file))
    if reservation.get("schema") != "orchestra-sf.g10-reservation.v1" or \
       reservation.get("environment") != "isolated-qa" or reservation.get("disposable") is not True or \
       reservation.get("action") != command or not reservation.get("authorizationRef") or \
       not reservation.get("authorizedBy") or reservation.get("productionCutover") is not False:
        refuse("action-bound isolated QA reservation required")
    expires = datetime.fromisoformat(str(reservation.get("expiresAtUtc", "")).replace("Z", "+00:00"))
    if expires.tzinfo is None or expires <= datetime.now(timezone.utc):
        refuse("reservation has expired")
    if azure_identity() != str(reservation.get("vmResourceId", "")).lower():
        refuse("running Azure VM is not the reserved VM")
    candidate = reservation.get("candidate", {})
    if not SHA40.fullmatch(str(candidate.get("sha", ""))) or not SHA40.fullmatch(str(candidate.get("tree", ""))) or \
       not SHA64.fullmatch(str(reservation.get("archiveSha256", ""))):
        refuse("exact final C/T/inner tar hash required")
    return reservation


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    checkpoint = commands.add_parser("checkpoint")
    checkpoint.add_argument("--output-dir", required=True)
    checkpoint.add_argument("--g07-receipt", required=True)
    clone = commands.add_parser("verify-clone")
    clone.add_argument("--archive", required=True)
    clone.add_argument("--receipt", required=True)
    clone.add_argument("--target", required=True)
    for command in (checkpoint, clone):
        command.add_argument("--reservation", required=True)
    args = parser.parse_args()
    reservation = admission(args.reservation, args.command)
    installer = installer_module()
    with installer.install_lock():
        installer.vm_preflight(reservation["fqdn"])
        if args.command == "verify-clone":
            receipt = private_json(Path(args.receipt))
            binding = receipt.get("binding", {})
            if binding.get("candidate") != reservation["candidate"] or \
               binding.get("archiveSha256") != reservation["archiveSha256"] or \
               binding.get("vmResourceId", "").lower() == reservation["vmResourceId"].lower() or \
               binding.get("vmResourceId", "").lower() != str(reservation.get("sourceVmResourceId", "")).lower() or \
               reservation.get("networkEgressFenced") is not True or reservation.get("credentialsDisabled") is not True:
                refuse("clone must be a distinct reserved VM with exact source binding and isolation")
            target = private_directory(Path(args.target), empty=True)
            if target == STATE or STATE in target.parents or target == CONFIGURATION or CONFIGURATION in target.parents:
                refuse("clone restore cannot target live state or configuration")
            result = restore_clone_files(Path(args.archive), receipt, target)
            write_private(target / "clone-receipt.json", result)
            print(json.dumps({"result": result["proofClass"], "releaseQualified": False}))
            return
        if installer.current_source() != reservation["candidate"]["sha"]:
            refuse("current release is not the reserved candidate")
        installer.check_rollback_release(reservation["candidate"]["sha"])
        with installer.protected_input(installer.CURRENT / ".a7-source.json", 131072) as stream:
            installed = json.load(stream)
        g07 = private_json(Path(args.g07_receipt))
        if g07.get("schema") != "sf-g07-package-v1" or g07.get("candidate") != reservation["candidate"] or \
           g07.get("archive", {}).get("sha256") != reservation["archiveSha256"] or \
           g07.get("verification", {}).get("status") != "PACKAGE_VERIFIED" or \
           installed["archiveSha256"] != reservation["archiveSha256"] or \
           installed["manifestSha256"] != g07.get("manifest", {}).get("sha256"):
            refuse("installed bytes differ from the G07 receipt or reservation")
        roots = {"state": STATE, "configuration": CONFIGURATION}
        registry = Path(reservation["externalRegisterPath"])
        if not registry.is_absolute() or registry.resolve() != registry or not registry.is_file() or \
           any(registry == root or root in registry.parents for root in roots.values()):
            refuse("monotonic recovery authority must exist outside restored roots")
        key = Path(reservation["keyFile"])
        if not key.is_absolute() or not any(root in key.parents for root in roots.values()):
            refuse("key must be in the complete private backup inventory")
        with regular_file(key, maximum=65536) as stream:
            if not stream.read(1):
                refuse("authorized backup key is not readable")
        if reservation.get("writesBlocked") is not True or reservation.get("taskRelayDrained") is not True or \
           not SHA64.fullmatch(str(reservation.get("writerFenceEvidenceSha256", ""))):
            refuse("owner's writer fence and Task/Relay drain evidence required")
        destination = private_directory(Path(args.output_dir))
        if destination.stat().st_dev == STATE.stat().st_dev:
            refuse("backup destination must be on a different volume from durable state")
        binding = {"candidate": reservation["candidate"], "archiveSha256": reservation["archiveSha256"],
                   "vmResourceId": reservation["vmResourceId"], "installedManifestSha256": installed["manifestSha256"],
                   "reservationSha256": file_digest(Path(args.reservation)),
                   "writerFence": {"evidenceSha256": reservation["writerFenceEvidenceSha256"], "source": "OPERATOR_ATTESTATION"},
                   "service": "OBSERVED_INACTIVE", "key": "READABLE_IN_PRIVATE_INVENTORY"}
        archive, receipt = checkpoint_files(roots, destination, binding)
        print(json.dumps({"result": receipt["proofClass"], "archiveFile": str(archive),
                          "archiveSha256": receipt["archive"]["sha256"], "releaseQualified": False}))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, RuntimeError, sqlite3.Error, tarfile.TarError) as error:
        print("G10_CHECKPOINT_BLOCKED: " + str(error), file=sys.stderr)
        sys.exit(1)
