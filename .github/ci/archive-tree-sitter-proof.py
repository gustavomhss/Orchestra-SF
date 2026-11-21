from hashlib import file_digest, sha256
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile

CASE_NAME = "the archived Linux CLI extracts TypeScript and Python symbols with its shipped tree-sitter"
ARTIFACT = "14713077730"
SOURCE = "761abac2f8ee4106db0347189ff304a4a79bf026"
ARCHIVE_SHA = "7a2ab7102528a7de1998b30635bb02e3907ea1afc033e07d71c12cc6906158e9"
CLI_SHA = "79599b0f84749e9e49a8cd5a91506254d11a6d63f1f93402ccaa328572db43c9"

TYPESCRIPT = (
    'import { readFile } from "node:fs/promises"\n'
    "export interface Shape { area(): number }\n"
    "export class Square implements Shape { area() { return 4 } }\n"
    'export function load(file: string) { return readFile(file, "utf8") }\n'
)
PYTHON = "from os import path\n\ndef join(a, b):\n    return path.join(a, b)\n"


def digest(candidate):
    with candidate.open("rb") as stream:
        return file_digest(stream, "sha256").hexdigest()


def main(root):
    archive = root / "input" / "orchestra-sf-entra-linux-x64-baseline.tar.gz"
    if digest(archive) != ARCHIVE_SHA:
        raise ValueError("archive digest differs")
    package = root / "package"
    package.mkdir()
    with tarfile.open(archive, "r:gz") as payload:
        payload.extractall(package, filter="data")
    distribution = json.loads((package / "distribution.json").read_bytes())
    binary_entry = next(entry for entry in distribution["files"] if entry["path"] == "bin/orchestra")
    binary = package / "bin/orchestra"
    if binary.is_symlink() or not binary.is_file() or binary_entry["executable"] is not True:
        raise ValueError("archive does not declare a regular executable CLI")
    if binary_entry["sha256"] != CLI_SHA or digest(binary) != CLI_SHA:
        raise ValueError("archived executable digest differs")
    # Apply the executable mode from the validated manifest, as the installer does.
    binary.chmod(0o555)
    if digest(binary) != CLI_SHA:
        raise ValueError("staged executable digest differs")

    expected = {
        entry["path"]: entry["sha256"]
        for entry in distribution["files"]
        if entry["path"].startswith("bin/tree-sitter/")
    }
    actual = {
        item.relative_to(package).as_posix(): digest(item)
        for item in (package / "bin/tree-sitter").rglob("*")
        if item.is_file()
    }
    native = {
        "bin/tree-sitter/tree-sitter/prebuilds/linux-x64/tree-sitter.node",
        "bin/tree-sitter/tree-sitter-python/prebuilds/linux-x64/tree-sitter-python.node",
        "bin/tree-sitter/tree-sitter-typescript/prebuilds/linux-x64/tree-sitter-typescript.node",
    }
    if expected != actual or not native <= actual.keys():
        raise ValueError("Tree-sitter companion inventory differs")

    workspace = root / "workspace"
    workspace.mkdir()
    evidence = root / "evidence"
    evidence.mkdir()
    observations = {
        "sample.ts": symbols(binary, workspace, evidence, "sample.ts", TYPESCRIPT),
        "sample.py": symbols(binary, workspace, evidence, "sample.py", PYTHON),
    }
    result = {
        "schema": "sf-archive-tree-sitter-proof-v1",
        "caseName": CASE_NAME,
        "status": "pass",
        "sourceSha256": {"probe": digest(Path(__file__))},
        "sourceSHA": SOURCE,
        "workflowSHA": os.environ["GITHUB_SHA"],
        "runId": os.environ["GITHUB_RUN_ID"],
        "runAttempt": os.environ["GITHUB_RUN_ATTEMPT"],
        "job": os.environ["GITHUB_JOB"],
        "checkRunId": os.environ["CHECK_RUN_ID"],
        "artifactId": ARTIFACT,
        "archiveSha256": ARCHIVE_SHA,
        "binarySha256": CLI_SHA,
        "companions": actual,
        "observations": observations,
    }
    (evidence / "proof.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(CASE_NAME + ": PASS", flush=True)


def symbols(binary, workspace, evidence, name, source):
    fixture = workspace / name
    fixture.write_text(source, encoding="utf-8")
    completed = subprocess.run(
        [str(binary), "debug", "symbols", str(fixture)],
        cwd=workspace,
        env={
            "PATH": "/usr/bin:/bin",
            "HOME": str(workspace),
            "TMPDIR": str(workspace),
            "XDG_CONFIG_HOME": str(workspace / "config"),
            "XDG_DATA_HOME": str(workspace / "data"),
            "XDG_CACHE_HOME": str(workspace / "cache"),
            "XDG_STATE_HOME": str(workspace / "state"),
            "ORCHESTRA_DISABLE_MODELS_FETCH": "1",
            "ORCHESTRA_INHERIT_CREDENTIALS": "0",
            "ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER": "0",
        },
        capture_output=True,
        timeout=90,
    )
    if completed.returncode != 0:
        raise ValueError(f"{name}: archived CLI exited with {completed.returncode}: {completed.stderr.decode('utf-8', 'replace')[:2000]}")
    observed = json.loads(completed.stdout)
    if observed.get("coverage", {}).get("complete") is not True:
        raise ValueError(f"{name}: extraction coverage is incomplete")
    if name == "sample.ts":
        expected = ["interface Shape", "class Square", "function load"]
        actual = [f"{item['kind']} {item['name']}" for item in observed["symbols"]]
        if actual != expected or observed["imports"] != [{"from": "node:fs/promises", "names": ["readFile"]}]:
            raise ValueError("TypeScript symbols or imports differ")
    elif [item["name"] for item in observed["symbols"]] != ["join"]:
        raise ValueError("Python symbols differ")
    output = evidence / (name + ".result.json")
    output.write_bytes(completed.stdout)
    return {"fixtureSha256": digest(fixture), "stdoutSha256": sha256(completed.stdout).hexdigest()}


if __name__ == "__main__":
    main(Path(sys.argv[1]).resolve())
