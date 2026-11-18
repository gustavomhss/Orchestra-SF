#!/usr/bin/env python3
"""Reproducible owner-provided artifact assembler (frozen Linux x64 C only). No auth or secrets."""
import argparse
import gzip
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tarfile
import tempfile

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from bundle import COMMIT, SHA, digest, manifest, refuse  # noqa: E402


def checkout(root, candidate, tree):
    if not COMMIT.fullmatch(candidate) or not COMMIT.fullmatch(tree):
        refuse("C and tree must be exact 40-hex SHAs")
    if subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip() != candidate or \
       subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD^{tree}"], text=True).strip() != tree or \
       subprocess.check_output(["git", "-C", str(root), "status", "--porcelain", "--untracked-files=no"], text=True).strip():
        refuse("package builder must run from clean frozen C")


def add_directory(files, root, target):
    if root.is_symlink() or not root.is_dir():
        refuse("missing/linked build root: " + str(root))
    for walk, dirs, names in os.walk(root, followlinks=False):
        for name in dirs + names:
            if (Path(walk) / name).is_symlink():
                refuse("build output may not contain symlink")
        for name in names:
            source = Path(walk) / name
            if not source.is_file():
                refuse("build output contains special file")
            archive_path = target + "/" + source.relative_to(root).as_posix()
            if archive_path in files:
                refuse("archive file collision")
            files[archive_path] = source


def assemble(a):
    root = HERE.parents[2]  # repo root: sf/azure/runtime/ -> parents[2]
    checkout(root, a.candidate, a.tree)
    if not SHA.fullmatch(a.factory_sha) or not Path(a.factory).is_absolute():
        refuse("owner A8 factory source must be absolute and SHA256-pinned")
    factory = Path(a.factory)
    if factory.is_symlink() or not factory.is_file() or digest(factory) != a.factory_sha:
        refuse("factory hash mismatch or missing")
    if not a.output.is_absolute() or a.output.exists() or a.output.is_symlink():
        refuse("output archive path must be new and absolute")
    cli_root = root / "apps/cli/dist/cli-linux-x64"
    web_root = root / "apps/web/dist"
    files = {}
    add_directory(files, cli_root / "bin", "bin")
    add_directory(files, web_root, "web")
    if "bin/orchestra" not in files or "web/index.html" not in files or \
       "bin/hugr_omni.node" not in files or "bin/hugr-omni-supervisor" not in files:
        refuse("missing compiled Web+CLI+Omni from verified Linux build")
    files["factory/installation.mjs"] = factory
    index = []
    for name in sorted(files):
        source = files[name]
        entry_mode = "0555" if (source.stat().st_mode & 0o111) else "0444"
        if name in ("bin/orchestra", "bin/hugr-omni-supervisor") and entry_mode != "0555":
            refuse("compiled executables must have execute mode")
        index.append({"path": name, "sha256": digest(source), "mode": entry_mode})
    info = {"schema": "orchestra-sf.azure-bundle.v1", "candidateSha": a.candidate,
            "treeSha": a.tree, "target": "linux-x64", "files": index}
    manifest(json.dumps(info), a.candidate, a.tree)
    fd, temp = tempfile.mkstemp(prefix=".sf-package-", dir=a.output.parent)
    try:
        with os.fdopen(fd, "wb") as binary:
            with gzip.GzipFile(fileobj=binary, filename="", mode="wb", mtime=0, compresslevel=6) as compressed:
                with tarfile.open(fileobj=compressed, mode="w") as tar:
                    def append(name, data, mode):
                        member = tarfile.TarInfo("bundle/" + name)
                        member.uid = member.gid = 0
                        member.uname = member.gname = "root"
                        member.mtime = 0
                        member.mode = mode
                        member.size = len(data)
                        tar.addfile(member, io.BytesIO(data))
                    append("manifest.json", (json.dumps(info, sort_keys=True) + "\n").encode(), 0o444)
                    for name, source in sorted(files.items()):
                        append(name, source.read_bytes(),
                               0o555 if next(i["mode"] for i in index if i["path"] == name) == "0555" else 0o444)
            binary.flush()
            os.fsync(binary.fileno())
        os.chmod(temp, 0o600)
        os.replace(temp, a.output)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)
    print(json.dumps({"status": "PACKAGE_BUILT_NOT_DEPLOYED", "C": a.candidate, "tree": a.tree,
                      "sha256": digest(a.output), "fileCount": len(index),
                      "factorySha256": a.factory_sha, "path": str(a.output)}, sort_keys=True))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--candidate", required=True)
    p.add_argument("--tree", required=True)
    p.add_argument("--factory", type=Path, required=True)
    p.add_argument("--factory-sha", required=True)
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    try:
        assemble(a)
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as ex:
        print("PACKAGE_BLOCKED/RED: " + str(ex), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
