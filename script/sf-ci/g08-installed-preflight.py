#!/usr/bin/env python3
"""Read-only G08 host witness. Never installs, selects releases, restarts or rolls back."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import pwd
import re
import stat
import subprocess
import sys
import urllib.request

ARCHIVE = "orchestra-sf-entra-linux-x64-baseline.tar.gz"
UNIT = "orchestra-sf.service"
REPOSITORY = Path(__file__).resolve().parents[2]
INSTALLER = REPOSITORY / "sf/azure/vm/install-factory-distribution.py"
IMDS = "http://169.254.169.254/metadata/instance/compute?api-version=2025-04-07"


def require(condition, code):
    if not condition:
        raise RuntimeError(code)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "G08_DUPLICATE_JSON_KEY")
        result[key] = value
    return result


def parse_json(raw):
    return json.loads(raw, object_pairs_hook=unique_object)


def private_root(value):
    root = Path(value)
    info = root.lstat()
    require(root.is_absolute() and root.resolve() == root and not root.is_symlink() and
            stat.S_ISDIR(info.st_mode) and stat.S_IMODE(info.st_mode) == 0o700 and info.st_uid == os.getuid(),
            "G08_PRIVATE_ROOT_REQUIRED")
    workspace = os.environ.get("GITHUB_WORKSPACE")
    require(not workspace or not root.is_relative_to(Path(workspace).resolve()), "G08_PRIVATE_ROOT_OUTSIDE_CHECKOUT")
    return root


@contextmanager
def private_file(root, name, maximum):
    require(re.fullmatch(r"[a-z0-9][a-z0-9.-]*", name), "G08_PRIVATE_FILE_NAME")
    file = root / name
    before = file.lstat()
    require(stat.S_ISREG(before.st_mode) and not file.is_symlink() and before.st_nlink == 1 and
            before.st_uid == os.getuid() and stat.S_IMODE(before.st_mode) == 0o600 and
            0 < before.st_size <= maximum, "G08_PRIVATE_FILE_REQUIRED")
    with os.fdopen(os.open(file, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), "rb") as reader:
        after = os.fstat(reader.fileno())
        require((before.st_dev, before.st_ino, before.st_mode, before.st_uid, before.st_size) ==
                (after.st_dev, after.st_ino, after.st_mode, after.st_uid, after.st_size) and after.st_nlink == 1,
                "G08_PRIVATE_FILE_CHANGED")
        yield reader, after.st_size


def private_json(root, name, maximum=5_000_000):
    with private_file(root, name, maximum) as (reader, size):
        raw = reader.read()
    require(len(raw) == size, "G08_PRIVATE_READ_CHANGED")
    return parse_json(raw), raw


def stream_digest(reader):
    result = hashlib.sha256()
    for chunk in iter(lambda: reader.read(1024 * 1024), b""):
        result.update(chunk)
    return result.hexdigest()


def parse_process(properties, candidate, process_root):
    require(set(properties) == {"MainPID", "ActiveState", "SubState"} and
            properties["ActiveState"] == "active" and properties["SubState"] == "running" and
            re.fullmatch(r"[1-9][0-9]*", properties["MainPID"]), "G08_RUNNING_SERVICE_REQUIRED")
    pid = int(properties["MainPID"])
    proc = process_root / str(pid)
    exe = os.readlink(proc / "exe")
    require(exe == "/opt/orchestra-sf/releases/" + candidate + "/bin/orchestra", "G08_RUNNING_EXE_NOT_INSTALLED_CANDIDATE")
    fields = (proc / "stat").read_text().rsplit(") ", 1)[1].split()
    require(len(fields) > 19 and re.fullmatch(r"[1-9][0-9]*", fields[19]), "G08_PROCESS_START_REQUIRED")
    cgroups = (proc / "cgroup").read_text().splitlines()
    require(any(line.split(":", 2)[-1] == "/system.slice/" + UNIT for line in cgroups), "G08_PROCESS_NOT_IN_SERVICE_CGROUP")
    uid = next((line.split()[1:] for line in (proc / "status").read_text().splitlines() if line.startswith("Uid:")), [])
    expected_uid = pwd.getpwnam("orchestra-sf").pw_uid
    require(expected_uid != 0 and uid == [str(expected_uid)] * 4, "G08_NONPRIVILEGED_SERVICE_REQUIRED")
    return {"unit": UNIT, "pid": pid, "activeState": properties["ActiveState"], "subState": properties["SubState"],
            "exe": exe, "startTicks": fields[19]}


def running_process(candidate):
    response = subprocess.run(
        ["/usr/bin/systemctl", "show", "--property=MainPID", "--property=ActiveState", "--property=SubState", UNIT],
        check=False, capture_output=True, text=True, timeout=15)
    require(response.returncode == 0, "G08_SERVICE_OBSERVATION_FAILED")
    lines = response.stdout.splitlines()
    require(len(lines) == 3 and all("=" in line for line in lines), "G08_SERVICE_PROPERTIES_INVALID")
    return parse_process(dict(line.split("=", 1) for line in lines), candidate, Path("/proc"))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        return None


def actual_vm_id():
    # Azure IMDS requires Metadata:true and proxy bypass. No token endpoint is accessed.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    request = urllib.request.Request(IMDS, headers={"Metadata": "true"})
    with opener.open(request, timeout=15) as response:
        require(response.status == 200 and response.url == IMDS, "G08_IMDS_UNAVAILABLE")
        raw = response.read(131073)
    require(len(raw) <= 131072, "G08_IMDS_RESPONSE_TOO_LARGE")
    value = parse_json(raw)
    require(value.get("osType") == "Linux" and isinstance(value.get("vmId"), str), "G08_IMDS_LINUX_REQUIRED")
    return value["vmId"].lower()


def observe(root, phase):
    require(os.uname().sysname == "Linux" and os.uname().machine == "x86_64" and
            os.environ.get("GITHUB_ACTIONS") == "true" and os.environ.get("CI") == "true" and
            os.environ.get("RUNNER_ENVIRONMENT") == "self-hosted" and
            os.environ.get("GITHUB_REPOSITORY") == "gustavomhss/Orchestra-SF", "G08_PRIVATE_LINUX_ACTIONS_REQUIRED")
    plan, _ = private_json(root, "plan.json", 65536)
    package, package_raw = private_json(root, "package-receipt.json")
    require(plan["schema"] == "sf-g08-private-plan-v1" and plan["scratchRoot"] == str(root) and
            package["schema"] == "sf-g07-package-v1" and package["status"] == "PACKAGE_VERIFIED" and
            package["candidate"] == plan["candidate"] and
            hashlib.sha256(package_raw).hexdigest() == plan["packageReceiptSha256"], "G08_PACKAGE_PLAN_MISMATCH")
    candidate = plan["candidate"]["sha"]
    require(re.fullmatch(r"[0-9a-f]{40}", candidate) and
            os.environ.get("SF_G08_CANDIDATE_SHA") == candidate and
            os.environ.get("SF_G08_CANDIDATE_TREE") == plan["candidate"]["tree"] and
            os.environ.get("SF_G08_INVOCATION_ID") == plan["invocation"]["id"] and
            os.environ.get("GITHUB_RUN_ID") == plan["invocation"]["runId"] and
            os.environ.get("GITHUB_RUN_ATTEMPT") == plan["invocation"]["runAttempt"] and
            os.environ.get("GITHUB_WORKFLOW_SHA") == plan["invocation"]["workflowSha"], "G08_INVOCATION_MISMATCH")
    now = datetime.now(timezone.utc)
    require(plan["reservation"]["environment"] == "qa-isolated" and plan["reservation"]["exclusive"] is True and
            plan["approvals"]["scope"] == "qualification-only" and
            datetime.fromisoformat(plan["reservation"]["startsAt"]) <= now <
            datetime.fromisoformat(plan["reservation"]["endsAt"]), "G08_RESERVED_WINDOW_REQUIRED")
    vm_id = actual_vm_id()
    require(vm_id == plan["reservation"]["vmId"], "G08_RESERVED_VM_MISMATCH")
    require(package["archive"]["file"] == ARCHIVE, "G08_ORIGINAL_INNER_TAR_REQUIRED")
    with private_file(root, ARCHIVE, 3 * 1024 ** 3) as (reader, size):
        archive_sha = stream_digest(reader)
    require(size == package["archive"]["bytes"] and archive_sha == package["archive"]["sha256"], "G08_TAR_BYTES_MISMATCH")

    # Reuse the candidate's actual installer verification, including every installed file/mode/hash.
    # These two functions are read-only; do not call vm_preflight/install/rollback/atomic_current.
    spec = importlib.util.spec_from_file_location("g08_original_installer", INSTALLER)
    require(spec is not None and spec.loader is not None, "G08_ORIGINAL_INSTALLER_REQUIRED")
    installer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(installer)
    require(installer.current_source() == candidate, "G08_CURRENT_RELEASE_MISMATCH")
    installer.check_rollback_release(candidate)
    release = installer.RELEASES / candidate
    with installer.protected_input(release / ".a7-source.json", 131072) as reader:
        release_raw = reader.read()
    source = parse_json(release_raw)
    with installer.protected_input(release / "distribution.json", 5_000_000) as reader:
        manifest_raw = reader.read()
    manifest_sha = hashlib.sha256(manifest_raw).hexdigest()
    require(source["sourceSHA"] == candidate and source["archiveSha256"] == archive_sha and
            source["manifestSha256"] == manifest_sha == package["manifest"]["sha256"], "G08_INSTALLED_RECEIPT_MISMATCH")
    distribution = parse_json(manifest_raw)
    installed = sorted(
        [{"path": entry["path"], "sha256": entry["sha256"], "executable": entry["executable"],
          "bytes": (release / entry["path"]).stat().st_size} for entry in distribution["files"]],
        key=lambda entry: entry["path"])
    require(installed == sorted(package["manifest"]["files"], key=lambda entry: entry["path"]), "G08_INSTALLED_G07_INVENTORY_MISMATCH")
    process = running_process(candidate)
    require(installer.current_source() == candidate, "G08_RELEASE_CHANGED_DURING_OBSERVATION")
    result = {
        "schema": "sf-g08-installed-host-v1", "status": "INSTALLATION_BYTES_AND_PROCESS_VERIFIED",
        "phase": phase, "observedAt": now.isoformat().replace("+00:00", "Z"), "invocationId": plan["invocation"]["id"],
        "candidate": plan["candidate"], "vmId": vm_id, "currentSource": candidate,
        "archiveSha256": archive_sha, "manifestSha256": manifest_sha,
        "installerSha256": hashlib.sha256(INSTALLER.read_bytes()).hexdigest(),
        "releaseReceiptSha256": hashlib.sha256(release_raw).hexdigest(), "process": process,
    }
    output = root / ("host-" + phase + ".json")
    with os.fdopen(os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600), "w") as writer:
        writer.write(json.dumps(result, separators=(",", ":")) + "\n")
        writer.flush()
        os.fsync(writer.fileno())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=("before", "after"))
    args = parser.parse_args()
    observe(private_root(os.environ["SF_G08_PRIVATE_ROOT"]), args.phase)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("G08_INSTALLED_PREFLIGHT_REFUSED", file=sys.stderr)
        sys.exit(1)
