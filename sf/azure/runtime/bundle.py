#!/usr/bin/env python3
"""Strict extractor/verifier for an owner-approved immutable Orchestra-SF Linux bundle."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import tarfile
import tempfile

SHA = re.compile(r"^[0-9a-f]{64}$")
COMMIT = re.compile(r"^[0-9a-f]{40}$")
SCHEMA = "orchestra-sf.azure-bundle.v1"


def refuse(reason):
    raise RuntimeError("SF_BUNDLE_REFUSED: " + reason)


def digest(path):
    value = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def normal_name(name):
    if not isinstance(name, str) or not name.startswith("bundle/") or len(name) > 1024:
        refuse("noncanonical archive member")
    raw = name[7:]
    bits = raw.split("/")
    if not raw or any(not x or x in (".", "..") for x in bits) or "\\" in raw or raw.startswith("/"):
        refuse("path traversal or empty member")
    if PurePosixPath(raw).as_posix() != raw:
        refuse("not normalized")
    return raw


def manifest(raw, candidate, tree):
    try:
        doc = json.loads(raw)
    except (UnicodeError, ValueError):
        refuse("malformed manifest")
    if not isinstance(doc, dict) or set(doc) != {"schema", "candidateSha", "treeSha", "target", "files"}:
        refuse("incorrect manifest fields")
    if doc["schema"] != SCHEMA or doc["target"] != "linux-x64" or doc["candidateSha"] != candidate or doc["treeSha"] != tree:
        refuse("manifest revision/target does not match C")
    items = doc["files"]
    if not isinstance(items, list) or not 4 <= len(items) <= 20000:
        refuse("missing or oversized file list")
    index = {}
    for item in items:
        if not isinstance(item, dict) or set(item) != {"path", "sha256", "mode"}:
            refuse("file entry is incomplete")
        name = item["path"]
        if not isinstance(name, str) or normal_name("bundle/" + name) != name or name == "manifest.json" or name in index:
            refuse("invalid or duplicate file entry")
        if not isinstance(item["sha256"], str) or not SHA.fullmatch(item["sha256"]) or item["mode"] not in ("0444", "0555"):
            refuse("file hash/mode invalid")
        index[name] = item
    if not {"bin/orchestra", "web/index.html", "factory/installation.mjs"} <= index.keys():
        refuse("real ELF CLI, Web entry or trusted factory missing")
    if index["bin/orchestra"]["mode"] != "0555" or not any(x.startswith("omni/") for x in index):
        refuse("CLI executable/Omni Linux payload not present")
    return doc, index


def verify_release(folder, candidate, tree, archive_sha):
    if folder.is_symlink() or not folder.is_dir():
        refuse("release root not a real directory")
    mf = folder / "manifest.json"
    if mf.is_symlink() or not mf.is_file():
        refuse("installed manifest absent")
    _, index = manifest(mf.read_text(encoding="utf-8"), candidate, tree)
    seen = set()
    for root, dirs, files in os.walk(folder, followlinks=False):
        for name in dirs + files:
            if (Path(root) / name).is_symlink():
                refuse("installed symlink")
        for name in files:
            f = Path(root) / name
            if not f.is_file():
                refuse("installed special file")
            relative = f.relative_to(folder).as_posix()
            if relative in ("manifest.json", ".archive-sha256"):
                continue
            if relative not in index or digest(f) != index[relative]["sha256"]:
                refuse("installed file not admitted or hash changed: " + relative)
            seen.add(relative)
    if seen != set(index):
        refuse("installed file missing")
    if (folder / ".archive-sha256").read_text().strip() != archive_sha:
        refuse("archive digest receipt differs")
    with (folder / "bin/orchestra").open("rb") as handle:
        elf = handle.read(20)
    if len(elf) < 20 or elf[:4] != b"\x7fELF" or elf[4:6] != b"\x02\x01" or elf[18:20] != b"\x3e\x00":
        refuse("compiled CLI is not ELF 64-bit little-endian x86_64")
    return index


def stage_bundle(archive, expected_hash, candidate, tree, target_root):
    if not COMMIT.fullmatch(candidate) or not COMMIT.fullmatch(tree) or not SHA.fullmatch(expected_hash):
        refuse("sha/tree/digest require exact lower-case hexadecimal")
    if archive.is_symlink() or not archive.is_file() or digest(archive) != expected_hash:
        refuse("untrusted package checksum")
    if target_root.is_symlink() or target_root.stat().st_uid != 0:
        refuse("release root not root-controlled")
    release = target_root / candidate
    if release.exists() or release.is_symlink():
        verify_release(release, candidate, tree, expected_hash)
        return "STAGED_ALREADY_VERIFIED_NO_CHANGES"
    with tarfile.open(archive, "r:*") as tar:
        members = tar.getmembers()
        if len(members) > 21000:
            refuse("archive entry count limit")
        files, expanded = {}, 0
        for m in members:
            if m.isdir():
                if m.name.rstrip("/") not in ("bundle", ""):
                    normal_name(m.name.rstrip("/"))
                continue
            if not m.isfile():  # Reject symlinks, hardlinks, devices, FIFOs.
                refuse("special member or link")
            name = normal_name(m.name)
            if name in files:
                refuse("duplicate tar member")
            expanded += m.size
            if expanded > 5 * 1024**3:
                refuse("archive expansion limit")
            files[name] = m
        mf = files.get("manifest.json")
        if mf is None or mf.size > 5 * 1024**2:
            refuse("missing or oversized manifest")
        doc, index = manifest(tar.extractfile(mf).read().decode("utf-8"), candidate, tree)
        if set(files) != set(index) | {"manifest.json"}:
            refuse("unexpected/missing archive entries")
        tmp = Path(tempfile.mkdtemp(prefix=".verify-", dir=target_root))
        try:
            for name, item in sorted(index.items()):
                dest = tmp / name
                dest.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                handle = os.open(dest, os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o400)
                h = hashlib.sha256()
                with os.fdopen(handle, "wb") as out, tar.extractfile(files[name]) as source:
                    while data := source.read(1024 * 1024):
                        out.write(data)
                        h.update(data)
                    out.flush()
                    os.fsync(out.fileno())
                if h.hexdigest() != item["sha256"]:
                    refuse("file digest mismatch: " + name)
                dest.chmod(int(item["mode"], 8))
            (tmp / "manifest.json").write_text(json.dumps(doc, sort_keys=True) + "\n")
            (tmp / "manifest.json").chmod(0o444)
            (tmp / ".archive-sha256").write_text(expected_hash + "\n")
            (tmp / ".archive-sha256").chmod(0o444)
            for directory, _, _ in os.walk(tmp):
                Path(directory).chmod(0o555)
            verify_release(tmp, candidate, tree, expected_hash)
            os.replace(tmp, release)
            return "STAGED_IMMUTABLE_NOT_ACTIVATED"
        finally:
            if tmp.exists():
                shutil.rmtree(tmp)
