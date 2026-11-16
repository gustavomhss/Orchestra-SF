#!/usr/bin/env python3
"""A7 owner-run Linux checkpoint, Azure Backup, isolated restore and gated code rollback.

Never restores over production. A completed Azure job is NOT a completed application restore.
"""
import argparse
from datetime import datetime, timezone
import http.client
import io
import json
import os
from pathlib import Path
import shutil
import sqlite3
import stat
import subprocess
import sys
import tarfile
import tempfile
import time

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "sf/azure/runtime"))
from bundle import COMMIT, SHA, digest, refuse, verify_release  # noqa: E402
sys.path.insert(0, str(ROOT / "sf/azure/vm"))
from deploy import ETC, CURRENT, RELEASES, STATE, atomic_file, owner_config, preflight, private_json  # noqa: E402


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def call_json(*args):
    return json.loads(subprocess.check_output(args, stderr=subprocess.DEVNULL, text=True))


def check_approval(file, action, **expected):
    data = private_json(Path(file))
    if not isinstance(data, dict) or data.get("schema") != "orchestra-sf.azure-recovery-approval.v1" or \
       data.get("action") != action or not isinstance(data.get("approver"), str) or \
       not data["approver"].strip() or not isinstance(data.get("approvedAtUtc"), str) or \
       not data["approvedAtUtc"].endswith("Z"):
        refuse("owner recovery approval required for " + action)
    if any(data.get(k) != v for k, v in expected.items()):
        refuse("approval parameters not bound to exact requested action")
    return data


def sqlite_integrity(home):
    hits = []
    for root, dirs, files in os.walk(home, followlinks=False):
        for name in dirs + files:
            node = Path(root) / name
            if node.is_symlink():
                refuse("durable state contains symlink; inventory/review first")
        for name in files:
            node = Path(root) / name
            with node.open("rb") as stream:
                head = stream.read(16)
            if head != b"SQLite format 3\x00":
                continue
            try:
                db = sqlite3.connect(node.as_uri() + "?mode=ro", uri=True, timeout=5)
                with db:
                    result = db.execute("PRAGMA integrity_check").fetchone()
                db.close()
            except sqlite3.Error as error:
                refuse("SQLite integrity unavailable: " + str(error))
            if result != ("ok",):
                refuse("SQLite integrity not ok")
            hits.append({"relativePath": node.relative_to(home).as_posix(),
                         "sha256": digest(node)})
    if not hits:
        refuse("no actual SQLite store discovered; backup NOT qualified until inventory is known")
    return hits


def output_dir(directory):
    directory = Path(directory).resolve()
    if directory == STATE or STATE in directory.parents or directory.is_symlink():
        refuse("backup must be outside live state volume")
    if not directory.is_dir() or directory.stat().st_uid != 0 or directory.stat().st_mode & 0o077:
        refuse("backup destination must be existing root-owned 0700 directory")
    if directory.stat().st_dev == STATE.stat().st_dev:
        refuse("backup cannot be on same persistent volume")
    return directory


def checkpoint(a):
    preflight()
    owner = owner_config()
    if not COMMIT.fullmatch(a.candidate) or not COMMIT.fullmatch(a.tree):
        refuse("frozen C/tree required")
    receipt = check_approval(a.approval, "QUIESCE_CHECKPOINT",
                             candidateSha=a.candidate, treeSha=a.tree)
    if receipt.get("writesBlockedByOwner") is not True or receipt.get("taskRelayDrainedByOwner") is not True:
        refuse("A8/owner must drain Task/Relay and block admission before checkpoint")
    home = STATE / "home"
    destination = output_dir(a.output_dir)
    subprocess.run(["systemctl", "stop", "orchestra-sf.service"], check=True)
    if subprocess.check_output(["systemctl", "is-active", "orchestra-sf.service"],
                               text=True).strip() == "active":
        refuse("still writing after stop")
    dbs = sqlite_integrity(home)
    name = "checkpoint-" + a.candidate + "-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    fd, tmp = tempfile.mkstemp(prefix=".backup-", suffix=".tar.gz", dir=destination)
    os.close(fd)
    archive = destination / (name + ".tar.gz")
    try:
        with tarfile.open(tmp, mode="w:gz") as tar:
            for root, dirs, files in os.walk(home, followlinks=False):
                for f in sorted(dirs + files):
                    path = Path(root) / f
                    if path.is_symlink() or not (path.is_dir() or path.is_file()):
                        refuse("unadmitted durable file")
                    tar.add(path, arcname="home/" + path.relative_to(home).as_posix(), recursive=False)
        os.chmod(tmp, 0o600)
        os.replace(tmp, archive)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)
    report = {"schema": "orchestra-sf.azure-checkpoint.v1", "candidateSha": a.candidate,
              "treeSha": a.tree, "createdAtUtc": now(), "diskUuid": owner["diskUuid"],
              "archiveSha256": digest(archive), "archiveFile": str(archive),
              "sqlite": dbs, "stoppedQuiesced": True,
              "azureVaultJob": "NOT_RUN", "cloneRestore": "NOT_RUN",
              "applicationRollback": "NOT_RUN", "releaseQualified": False}
    receipt_path = archive.with_suffix(archive.suffix + ".json")
    atomic_file(receipt_path, json.dumps(report, sort_keys=True, indent=2) + "\n")
    print("LOCAL_CONSISTENT_CHECKPOINT_ONLY_SERVICE_REMAINS_STOPPED " + str(receipt_path))


def clone_imds():
    conn = http.client.HTTPConnection("169.254.169.254", timeout=3)
    try:
        conn.request("GET", "/metadata/instance/compute?api-version=2021-02-01",
                     headers={"Metadata": "true"})
        response = conn.getresponse()
        if response.status != 200:
            refuse("isolated VM IMDS unavailable")
        doc = json.loads(response.read(16384))
        return doc.get("resourceId")
    finally:
        conn.close()


def verify_clone(a):
    if os.geteuid() != 0 or sys.platform != "linux":
        refuse("root required for isolated clone integrity")
    role = private_json(Path(a.clone_role))
    if not isinstance(role, dict) or role.get("schema") != "orchestra-sf.isolated-clone.v1" or \
       not role.get("sourceVmResourceId") or not role.get("cloneVmResourceId") or \
       role["cloneVmResourceId"].lower() == role["sourceVmResourceId"].lower() or \
       clone_imds().lower() != role["cloneVmResourceId"].lower():
        refuse("IMDS has not proven this machine is a separate isolated Azure VM")
    if role.get("networkEgressFenced") is not True or role.get("credentialsDisabled") is not True:
        refuse("clone must have egress fenced and credentials disabled by owner/A8")
    target = Path(a.target)
    if target != Path("/mnt/orchestra-sf-restore") or target.is_symlink() or not target.is_dir() or \
       target.stat().st_uid != 0 or target.stat().st_mode & 0o077 or list(target.iterdir()):
        refuse("only empty root-owned 0700 /mnt/orchestra-sf-restore permitted")
    checkpoint = private_json(Path(a.receipt))
    if checkpoint.get("schema") != "orchestra-sf.azure-checkpoint.v1" or \
       checkpoint.get("archiveSha256") != digest(Path(a.archive)) or \
       not isinstance(checkpoint.get("archiveFile"), str) or not Path(checkpoint["archiveFile"]).is_absolute():
        refuse("checkpoint digest/source mismatch")
    if subprocess.run(["systemctl", "is-active", "--quiet", "orchestra-sf.service"]).returncode == 0:
        refuse("clone app service must remain stopped")
    with tarfile.open(a.archive, "r:*") as tar:
        for member in tar:
            raw = member.name
            parts = raw.split("/")
            if len(parts) < 2 or parts[0] != "home" or any(x in ("", ".", "..") for x in parts):
                refuse("restore archive contains unsafe path")
            if not (member.isfile() or member.isdir()) or member.issym() or member.islnk():
                refuse("restore refuses links, devices, sockets")
            dest = target.joinpath(*parts)
            if member.isdir():
                dest.mkdir(parents=True, exist_ok=True, mode=0o700)
                dest.chmod(0o700)
            else:
                dest.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                fd = os.open(dest, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
                with os.fdopen(fd, "wb") as out, tar.extractfile(member) as source:
                    shutil.copyfileobj(source, out, 1024 * 1024)
                    out.flush()
                    os.fsync(out.fileno())
    dbs = sqlite_integrity(target / "home")
    before = {i["relativePath"] for i in checkpoint["sqlite"]}
    after = {i["relativePath"] for i in dbs}
    if before != after:
        refuse("restored database inventory differs")
    print(json.dumps({"proofClass": "CLONE_FILE_RESTORE_INTEGRITY_ONLY", "candidateSha": checkpoint["candidateSha"],
                      "sourceArchiveSha256": checkpoint["archiveSha256"], "dbCount": len(dbs),
                      "businessReadWrite": "NOT_RUN", "azureRestoreJob": "NOT_VERIFIED_HERE",
                      "releaseQualified": False}, sort_keys=True))


def az_args(a):
    for key in ("resource_group", "vault", "container", "item"):
        if not getattr(a, key):
            refuse("actual Azure backup source fields required")
    return ["--resource-group", a.resource_group, "--vault-name", a.vault]


def azure_backup(a):
    from datetime import datetime
    if datetime.strptime(a.retain_until, "%d-%m-%Y").date() <= datetime.now(timezone.utc).date():
        refuse("future UTC backup retention date required")
    receipt = private_json(Path(a.checkpoint_receipt))
    if receipt.get("schema") != "orchestra-sf.azure-checkpoint.v1" or receipt.get("stoppedQuiesced") is not True or \
       not COMMIT.fullmatch(str(receipt.get("candidateSha", ""))) or \
       receipt.get("archiveSha256") != digest(Path(receipt.get("archiveFile", ""))):
        refuse("real immutable local application checkpoint required before Azure backup")
    if subprocess.run(["systemctl", "is-active", "--quiet", "orchestra-sf.service"]).returncode == 0:
        refuse("service was restarted; Azure backup would not be app-quiesced")
    check_approval(a.approval, "AZURE_BACKUP", resourceGroup=a.resource_group, vault=a.vault,
                   container=a.container, item=a.item, candidateSha=receipt["candidateSha"])
    item = call_json("az", "backup", "item", "show", *az_args(a), "--container-name", a.container,
                     "--name", a.item, "--backup-management-type", "AzureIaasVM", "-o", "json")
    if item.get("properties", {}).get("protectionState") not in ("Protected", "ProtectionConfigured"):
        refuse("vault item is not actually protected")
    result = call_json("az", "backup", "protection", "backup-now", *az_args(a),
                       "--container-name", a.container, "--item-name", a.item,
                       "--backup-management-type", "AzureIaasVM", "--retain-until", a.retain_until, "-o", "json")
    job_name = result.get("name")
    if not isinstance(job_name, str) or not job_name:
        refuse("Azure did not return a real job ID")
    subprocess.run(["az", "backup", "job", "wait", *az_args(a), "--name", job_name, "--timeout", "7200"], check=True)
    job = call_json("az", "backup", "job", "show", *az_args(a), "--name", job_name, "-o", "json")
    prop = job.get("properties", {})
    if prop.get("status") != "Completed" or prop.get("operation") != "Backup":
        refuse("Backup job did not finish as a real Backup")
    print(json.dumps({"proofClass": "AZURE_BACKUP_JOB_COMPLETED", "job": job_name,
                      "vault": a.vault, "container": a.container, "item": a.item,
                      "recoveryPointMatch": "OWNER_MUST_VERIFY",
                      "applicationConsistent": "NOT_INFERRED", "releaseQualified": False}, sort_keys=True))


def azure_restore_disks(a):
    if a.source_group == a.target_group:
        refuse("source and isolated target resource groups MUST differ")
    check_approval(a.approval, "RESTORE_DISKS_ISOLATED", resourceGroup=a.source_group,
                   targetResourceGroup=a.target_group, recoveryPoint=a.recovery_point)
    point = call_json("az", "backup", "recoverypoint", "show", "--resource-group", a.source_group,
                      "--vault-name", a.vault, "--container-name", a.container,
                      "--item-name", a.item, "--name", a.recovery_point,
                      "--backup-management-type", "AzureIaasVM", "-o", "json")
    if not isinstance(point, dict) or not point.get("name"):
        refuse("named recovery point not found")
    result = call_json("az", "backup", "restore", "restore-disks",
                       "--resource-group", a.source_group, "--vault-name", a.vault,
                       "--container-name", a.container, "--item-name", a.item,
                       "--rp-name", a.recovery_point, "--storage-account", a.storage_account,
                       "--target-resource-group", a.target_group,
                       "--restore-mode", "AlternateLocation", "-o", "json")
    job_name = result.get("name")
    if not isinstance(job_name, str) or not job_name:
        refuse("Azure restore did not return job ID")
    subprocess.run(["az", "backup", "job", "wait", "--resource-group", a.source_group,
                    "--vault-name", a.vault, "--name", job_name, "--timeout", "7200"], check=True)
    result = call_json("az", "backup", "job", "show", "--resource-group", a.source_group,
                       "--vault-name", a.vault, "--name", job_name, "-o", "json")
    prop = result.get("properties", {})
    if prop.get("status") != "Completed" or prop.get("operation") != "Restore":
        refuse("Azure Restore job is not Completed")
    print(json.dumps({"proofClass": "AZURE_ISOLATED_DISK_RESTORE_JOB_COMPLETED",
                      "job": job_name, "recoveryPoint": a.recovery_point,
                      "sourceRG": a.source_group, "targetRG": a.target_group,
                      "vmMounted": False, "sqliteVerified": False, "applicationQualified": False}, sort_keys=True))


def rollback_code(a):
    preflight()
    owner_config()
    if not COMMIT.fullmatch(a.target_candidate) or not COMMIT.fullmatch(a.target_tree) or \
       not SHA.fullmatch(a.target_archive_sha):
        refuse("immutable rollback target absent")
    target = RELEASES / a.target_candidate
    verify_release(target, a.target_candidate, a.target_tree, a.target_archive_sha)
    current = CURRENT.resolve(strict=True)
    if current.parent != RELEASES or not COMMIT.fullmatch(current.name) or current == target:
        refuse("current is not distinct known release")
    approval = check_approval(a.approval, "ROLLBACK_CODE_COMPATIBLE",
                              currentCandidate=current.name, targetCandidate=a.target_candidate)
    if not isinstance(approval.get("schemaCompatibilityProofSha256"), str) or \
       not SHA.fullmatch(approval["schemaCompatibilityProofSha256"]) or \
       approval.get("writesBlockedByOwner") is not True:
        refuse("independent migration compatibility and write quiescence required")
    proof = private_json(Path(a.compatibility_proof))
    if digest(Path(a.compatibility_proof)) != approval["schemaCompatibilityProofSha256"] or \
       proof.get("schema") != "orchestra-sf.azure-migration-compatibility.v1" or \
       proof.get("currentCandidate") != current.name or \
       proof.get("targetCandidate") != a.target_candidate or \
       proof.get("compatible") is not True or \
       not isinstance(proof.get("reviewer"), str) or not proof.get("reviewer"):
        refuse("signed reviewed migration compatibility evidence missing or unbound")
    cookie = Path(a.cookie)
    if not cookie.is_file():
        refuse("live actor session necessary after rollback")
    subprocess.run(["systemctl", "stop", "orchestra-sf.service"], check=True)
    link = CURRENT.parent / (".rollback-" + a.target_candidate)
    if link.exists() or link.is_symlink():
        refuse("stale concurrent rollback")
    link.symlink_to(target)
    os.replace(link, CURRENT)
    try:
        subprocess.run(["systemctl", "start", "orchestra-sf.service"], check=True)
        subprocess.run([sys.executable, str(ROOT / "sf/azure/runtime/identity_health.py"),
                        "--config", str(ETC / "owner.json"), "--cookie-file", str(cookie),
                        "--release", str(target), "--candidate", a.target_candidate,
                        "--tree", a.target_tree], check=True)
    except Exception:
        subprocess.run(["systemctl", "stop", "orchestra-sf.service"], check=False)
        print("ROLLBACK_FAILED_SERVICE_STOPPED_NO_AUTOMATIC_DB_RESTORE", file=sys.stderr)
        raise
    print("CODE_ROLLBACK_IDENTITY_READ_OBSERVED; DB_RESTORE_AND_AZ03_NOT_INFERRED")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    s = p.add_subparsers(dest="action", required=True)
    ck = s.add_parser("checkpoint")
    for flag in ("candidate", "tree", "output-dir", "approval"):
        ck.add_argument("--" + flag, required=True)
    clone = s.add_parser("verify-clone")
    for flag in ("clone-role", "receipt", "archive", "target"):
        clone.add_argument("--" + flag, required=True)
    ab = s.add_parser("vault-backup")
    for flag in ("resource-group", "vault", "container", "item", "retain-until", "approval"):
        ab.add_argument("--" + flag, required=True)
    ab.add_argument("--checkpoint-receipt", required=True)
    ar = s.add_parser("vault-restore-disks")
    for flag in ("source-group", "target-group", "vault", "container", "item", "recovery-point",
                 "storage-account", "approval"):
        ar.add_argument("--" + flag, required=True)
    rb = s.add_parser("rollback-code")
    for flag in ("target-candidate", "target-tree", "target-archive-sha", "approval", "cookie", "compatibility-proof"):
        rb.add_argument("--" + flag, required=True)
    a = p.parse_args()
    try:
        {"checkpoint": checkpoint, "verify-clone": verify_clone, "vault-backup": azure_backup,
         "vault-restore-disks": azure_restore_disks, "rollback-code": rollback_code}[a.action](a)
    except (OSError, ValueError, RuntimeError, sqlite3.Error, subprocess.CalledProcessError, KeyError, AttributeError) as e:
        print("RECOVERY_RED/BLOCKED: " + str(e), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
