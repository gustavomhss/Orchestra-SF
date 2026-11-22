#!/usr/bin/env python3
"""Verify an admitted Actions ZIP and its original Entra tar without installing it."""
import argparse
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import tarfile
import tempfile
import zipfile

ZIP_LIMIT = 3 * 1024 ** 3
EXPANDED_LIMIT = 4 * 1024 ** 3
MEMBER_LIMIT = 3 * 1024 ** 3
MAX_MEMBERS = 25000
TAR_NAME = "orchestra-sf-entra-linux-x64-baseline.tar.gz"
RECEIPT_NAME = "orchestra-sf-entra-package-receipt.json"
HEX40 = re.compile(r"[0-9a-f]{40}\Z")
HEX64 = re.compile(r"[0-9a-f]{64}\Z")
MAP_NAME = re.compile(r"\.map(?:\.(?:gz|br))?\Z", re.I)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha256_file(file):
    digest = hashlib.sha256()
    with Path(file).open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value, "duplicate JSON field")
        value[key] = item
    return value


def read_json(file, maximum=64 * 1024 ** 2):
    item = Path(file).lstat()
    require(stat.S_ISREG(item.st_mode) and item.st_nlink == 1 and 0 < item.st_size <= maximum,
            "JSON must be a bounded regular file")
    return json.loads(Path(file).read_text("utf-8"), object_pairs_hook=unique_object)


def safe_name(name, *, directory=False):
    require(isinstance(name, str) and 0 < len(name) <= 1024 and "\0" not in name,
            "unsafe archive member")
    value = name[:-1] if directory and name.endswith("/") else name
    require(bool(re.fullmatch(r"[A-Za-z0-9_@+./-]+", value)) and not value.startswith("/") and
            "\\" not in value and all(part not in ("", ".", "..") and not part.endswith(".")
                                       for part in value.split("/")), "noncanonical archive member")
    require(PurePosixPath(value).as_posix() == value, "noncanonical archive member")
    return value


def inspect_zip(archive, destination, selected, expected_sha, expected_bytes):
    archive = Path(archive)
    item = archive.lstat()
    require(stat.S_ISREG(item.st_mode) and item.st_nlink == 1 and 0 < item.st_size <= ZIP_LIMIT,
            "ZIP must be a bounded regular file")
    require(item.st_size == expected_bytes and sha256_file(archive) == expected_sha,
            "ZIP identity differs from GitHub metadata")
    for name in selected:
        safe_name(name)
    actual, directories, total = {}, set(), 0
    with zipfile.ZipFile(archive) as zipped:
        members = zipped.infolist()
        require(0 < len(members) <= MAX_MEMBERS, "ZIP member count exceeds limit")
        names = set()
        for member in members:
            require(member.orig_filename == member.filename, "noncanonical ZIP original name")
            name = safe_name(member.filename, directory=member.is_dir())
            require(name not in names, "duplicate ZIP member")
            names.add(name)
            require(not (member.flag_bits & 1), "encrypted ZIP member")
            mode = member.external_attr >> 16
            kind = stat.S_IFMT(mode)
            require(kind in (0, stat.S_IFREG, stat.S_IFDIR), "special ZIP member")
            require(not member.is_dir() or (member.file_size == 0 and kind in (0, stat.S_IFDIR)),
                    "directory with payload or inconsistent type")
            require(member.is_dir() or kind != stat.S_IFDIR, "inconsistent ZIP member type")
            require(0 <= member.file_size <= MEMBER_LIMIT and member.compress_size <= ZIP_LIMIT,
                    "ZIP member byte limit")
            total += member.file_size
            require(total <= EXPANDED_LIMIT, "ZIP decompressed byte limit")
            for parent in PurePosixPath(name).parents:
                require(str(parent) not in actual, "ZIP file used as directory")
            if member.is_dir():
                with zipped.open(member, "r") as source:
                    require(source.read(1) == b"", "ZIP directory payload")
                directories.add(name)
                continue
            require(not any(existing.startswith(name + "/") for existing in set(actual) | directories),
                    "ZIP directory replaced by file")
            output = None
            observed = 0
            digest = hashlib.sha256()
            if name in selected:
                target = Path(destination) / name
                target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                output = target.open("xb")
                os.chmod(target, 0o600)
            try:
                # Read every member, including unselected diagnostics, to check CRC and actual expansion.
                with zipped.open(member, "r") as source:
                    for chunk in iter(lambda: source.read(1024 * 1024), b""):
                        observed += len(chunk)
                        require(observed <= member.file_size and observed <= MEMBER_LIMIT,
                                "ZIP actual expansion exceeds declaration")
                        digest.update(chunk)
                        if output is not None:
                            output.write(chunk)
                require(observed == member.file_size, "ZIP member size mismatch")
            finally:
                if output is not None:
                    output.close()
            actual[name] = {"sha256": digest.hexdigest(), "bytes": observed}
    require(set(selected).issubset(actual), "required package evidence missing from ZIP")
    require(not (set(actual) & directories), "ZIP file/directory collision")
    return actual


def require_provenance(admission, native, proof, inputs, members, manifest, ledger, web):
    candidate, producer = admission["candidate"], admission["producer"]
    require(admission.get("schema") == "sf-g07-admission-v1" and admission.get("status") == "VERIFIED_SOURCE" and
            admission.get("productionCutover") is False, "live source admission missing")
    require(HEX40.fullmatch(candidate["sha"]) and HEX40.fullmatch(candidate["tree"]), "candidate identity")
    require(isinstance(producer.get("operatorLogin"), str) and producer["operatorLogin"],
            "observed Release operator account missing")
    require(native.get("schema") == "sf-entra-factory-package-v1" and native.get("proof") == "packaged",
            "native package receipt schema")
    for field in ("sourceSHA", "checkoutSHA", "expectedSourceSHA"):
        require(native.get(field) == candidate["sha"], "native package source mismatch")
    require(native.get("runID") == producer["runId"] and native.get("runAttempt") == producer["runAttempt"],
            "native package run/attempt mismatch")
    require(native.get("archiveFile") == TAR_NAME and native.get("target") == "linux-x64-baseline",
            "native package role/target mismatch")
    require(native.get("archiveSha256") == members[TAR_NAME]["sha256"], "native receipt tar digest mismatch")
    require(proof.get("schema") in ("sf-linux-compile-provenance-v1", "sf-linux-compile-provenance-v2"),
            "unsupported compiler provenance schema")
    require(proof.get("sourceSHA") == candidate["sha"] and proof.get("sourceTreeSHA") == candidate["tree"] and
            proof.get("workflowSHA") == producer["workflowSha"], "compiler source/tree/workflow mismatch")
    require(proof.get("runId") == producer["runId"] and proof.get("runAttempt") == producer["runAttempt"] and
            proof.get("checkRunId") == producer["checkRunId"], "compiler producing run/attempt/check-run mismatch")
    require(proof.get("job") == producer["jobName"], "compiler producer job mismatch")
    require(proof.get("target") == "linux-x64-baseline" and
            proof.get("archiveSha256") == native["archiveSha256"] and
            proof.get("manifestSha256") == native["manifestSha256"], "compiler artifact identity mismatch")
    for field in ("bun", "bunRevision"):
        require(isinstance(proof.get(field), str) and 0 < len(proof[field]) <= 128, "compiler toolchain missing")
    require(isinstance(proof.get("bunArchiveSha256"), str) and HEX64.fullmatch(proof["bunArchiveSha256"]),
            "compiler distribution digest missing")
    require(inputs.get("sourceSHA") == candidate["sha"] and inputs.get("channel") == "prod" and
            inputs.get("brand") == "sucafina" and type(inputs.get("viteEnvironmentInputs")) is int and
            inputs.get("viteEnvironmentInputs") == 0,
            "production Sucafina build inputs not proved")
    files = {entry["path"]: entry for entry in manifest["files"]}
    require(proof.get("binary") == {"path": "bin/orchestra", "sha256": files["bin/orchestra"]["sha256"]},
            "compiled ELF not bound to tar")
    for field, name in (("ledger", "compile-evidence.json"), ("webManifest", "web-build-manifest.json")):
        require(proof.get(field) == {"file": name, "sha256": members[name]["sha256"]},
                "compiler supporting evidence hash mismatch")
    require(ledger.get("schema") == "orchestra-compile-evidence-v2" and
            ledger.get("target") == "linux-x64-baseline" and ledger.get("bun") == proof["bun"] and
            ledger.get("binary", {}).get("sha256") == files["bin/orchestra"]["sha256"] and
            isinstance(ledger.get("inputs"), list) and len(ledger["inputs"]) > 0 and
            isinstance(ledger.get("metafile", {}).get("outputs"), dict) and len(ledger["metafile"]["outputs"]) > 0,
            "compiler ledger not bound to compiled bytes")
    require(isinstance(web, dict) and any(isinstance(entry, dict) and entry.get("isEntry") is True
                                        for entry in web.values()), "Web build manifest has no entry")
    for entry in web.values():
        require(isinstance(entry, dict) and isinstance(entry.get("file"), str) and
                "bin/web/" + safe_name(entry["file"]) in files, "Web build manifest member absent from tar")
    if proof["schema"] == "sf-linux-compile-provenance-v2":
        maps = proof.get("cliSourceMaps")
        require(isinstance(maps, dict), "v2 external compiler map identity missing")
        for file_field, hash_field in (("file", "sha256"), ("index", "indexSha256")):
            name = safe_name(maps.get(file_field))
            require(name in members and maps.get(hash_field) == members[name]["sha256"],
                    "v2 compiler map evidence hash mismatch")


def verify_package(archive, admission_file, installer_file, output):
    admission = read_json(admission_file, 262144)
    producer = admission["producer"]
    for field in ("sourceProofFile", "buildInputsFile"):
        require(isinstance(producer[field], str) and re.fullmatch(r"[A-Za-z0-9_-]+\.json", producer[field]),
                "supplementary evidence must use a plain JSON filename")
    selected = {TAR_NAME, RECEIPT_NAME, producer["sourceProofFile"], producer["buildInputsFile"],
                "compile-evidence.json", "web-build-manifest.json"}
    output = Path(output)
    require(output.is_absolute() and output.resolve() == output and not output.exists(), "new absolute output required")
    require(Path(installer_file).is_absolute(), "candidate installer path must be absolute")
    with tempfile.TemporaryDirectory(prefix="g07-verification-", dir=output.parent) as scratch:
        scratch = Path(scratch)
        members = inspect_zip(archive, scratch, selected, producer["zipSha256"], producer["zipBytes"])
        native = read_json(scratch / RECEIPT_NAME, 131072)
        proof = read_json(scratch / producer["sourceProofFile"], 1048576)
        inputs = read_json(scratch / producer["buildInputsFile"], 65536)
        ledger = read_json(scratch / "compile-evidence.json")
        web = read_json(scratch / "web-build-manifest.json", 8 * 1024 ** 2)
        spec = importlib.util.spec_from_file_location("g07_original_installer", installer_file)
        require(spec is not None and spec.loader is not None, "candidate installer unavailable")
        installer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(installer)
        observed = io.StringIO()
        with contextlib.redirect_stdout(observed):
            installer.verify(argparse.Namespace(artifact=str(scratch / TAR_NAME),
                receipt=str(scratch / RECEIPT_NAME), candidate=admission["candidate"]["sha"],
                sha256=members[TAR_NAME]["sha256"]))
        result = json.loads(observed.getvalue(), object_pairs_hook=unique_object)
        require(result == {"result": "PACKAGE_VERIFIED", "candidate": admission["candidate"]["sha"],
                           "archiveDigest": members[TAR_NAME]["sha256"]}, "candidate installer did not verify package")
        with tarfile.open(scratch / TAR_NAME, "r:gz") as tar:
            manifest_raw = tar.extractfile("distribution.json").read(5_000_001)
            require(len(manifest_raw) <= 5_000_000, "manifest byte limit")
            manifest = json.loads(manifest_raw, object_pairs_hook=unique_object)
            require(hashlib.sha256(manifest_raw).hexdigest() == native["manifestSha256"], "manifest digest mismatch")
            index = {entry["path"]: entry for entry in manifest["files"]}
            require("bin/web/index.html" in index and any(name.startswith("bin/web/") and name.endswith(".js")
                                                       for name in index), "final Microsoft package lacks built Web")
            inventory = []
            for entry in manifest["files"]:
                name = safe_name(entry["path"])
                require(not MAP_NAME.search(name), "public payload contains source maps")
                member = tar.getmember(name)
                inventory.append({**entry, "bytes": member.size})
                if name.startswith("bin/web/") and name.endswith((".js", ".css", ".html")):
                    with tar.extractfile(member) as stream:
                        tail = b""
                        for block in iter(lambda: stream.read(1024 * 1024), b""):
                            normalized = re.sub(rb"\s+", b"", tail + block)
                            require(b"sourcemappingurl=data:" not in normalized.lower(),
                                    "public Web contains an inline source map")
                            tail = normalized[-64:]
            require_provenance(admission, native, proof, inputs, members, manifest, ledger, web)
        receipt = {
            "schema": "sf-g07-package-v1", "status": "PACKAGE_VERIFIED",
            "candidate": admission["candidate"],
            "archive": {"file": TAR_NAME, "sha256": native["archiveSha256"], "bytes": members[TAR_NAME]["bytes"]},
            "artifact": {"id": producer["artifactId"], "name": producer["artifactName"],
                         "zipSha256": producer["zipSha256"], "zipBytes": producer["zipBytes"]},
            "manifest": {"sha256": native["manifestSha256"], "files": inventory},
            "factory": {"path": "bin/local/entry.mjs", "sha256": native["bundleSha256"]},
            "producer": {"workflowSha": producer["workflowSha"], "workflowPath": producer["workflowPath"],
                         "runId": producer["runId"], "runAttempt": producer["runAttempt"], "jobId": producer["jobId"],
                         "checkRunId": producer["checkRunId"], "jobName": producer["jobName"],
                         "operatorLogin": producer["operatorLogin"],
                         "toolchain": {"bun": proof["bun"], "bunRevision": proof["bunRevision"],
                                       "bunArchiveSha256": proof["bunArchiveSha256"]}},
            "acknowledgements": admission["acknowledgements"],
            "verification": {"status": "PACKAGE_VERIFIED", "admissionSha256": sha256_file(admission_file),
                             "installerSha256": sha256_file(installer_file), "zipMembers": len(members),
                             "sourceProofSha256": members[producer["sourceProofFile"]]["sha256"],
                             "buildInputsSha256": members[producer["buildInputsFile"]]["sha256"],
                             "candidateInstallerInvoked": True},
            "installation": None, "g07Closed": False, "productionCutover": False
        }
        output.mkdir(mode=0o700)
        for name, value in (("g07-package-receipt.json", receipt), ("g07-zip-inventory.json", members)):
            file = output / name
            with file.open("x", encoding="utf-8") as stream:
                os.chmod(file, 0o600)
                json.dump(value, stream, indent=2, sort_keys=True)
                stream.write("\n")
        return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zip", required=True)
    parser.add_argument("--admission", required=True)
    parser.add_argument("--installer", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    require(os.environ.get("GITHUB_ACTIONS") == "true", "qualification must execute in GitHub Actions")
    receipt = verify_package(args.zip, args.admission, args.installer, args.out)
    print(json.dumps({"status": receipt["status"], "candidate": receipt["candidate"],
                      "archiveSha256": receipt["archive"]["sha256"], "installed": False, "g07Closed": False}))


if __name__ == "__main__":
    main()
