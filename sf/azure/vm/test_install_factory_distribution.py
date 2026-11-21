"""Offline installer acceptance with synthetic packages and a temporary VM layout."""
from argparse import Namespace
from contextlib import redirect_stdout
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import tarfile
import tempfile
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    "factory_installer", Path(__file__).with_name("install-factory-distribution.py")
)
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)

FIRST = "a" * 40
SECOND = "b" * 40
MICROSOFT_ENTRY = "modules/sucafina/Sucafinav1/local/microsoft-entry.ts"
BUNDLE = "bin/local/entry.mjs"
ELF_HEADER = b"\x7fELF\x02\x01" + bytes(12) + b"\x3e\x00"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, data):
    path.write_text(json.dumps(data), encoding="utf-8")
    path.chmod(0o600)


class InstallerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if os.geteuid() != 0:
            raise RuntimeError("Run the temporary-VM tests through the hosted Node wrapper")

    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory(prefix="sf-entra-installer-")))
        self.vm = self.root / "vm"
        self.vm.mkdir()
        self.releases = self.vm / "releases"
        self.current = self.vm / "current"
        self.lock = self.vm / "installer.lock"
        self.preflights = []

        def preflight(fqdn, *, require_maintenance=True):
            self.assertEqual(fqdn, "sf.example.test")
            self.preflights.append(require_maintenance)

        self.enterContext(patch.multiple(
            installer,
            RELEASES=self.releases,
            CURRENT=self.current,
            LOCK=self.lock,
            CADDY=self.vm / "Caddyfile",
            vm_preflight=preflight,
        ))

    def package(self, candidate=FIRST, *, closure_entry=MICROSOFT_ENTRY,
                extra=None, corrupt_payload=False, orchestra=ELF_HEADER):
        bundle = b"export default {}\n"
        contents = {
            "bin/orchestra": orchestra,
            "bin/hugr_omni.node": ELF_HEADER,
            "bin/hugr-omni-supervisor": ELF_HEADER,
            "package.json": b'{"version":"1.0.0"}\n',
            BUNDLE: bundle,
            "bin/local/closure.json": json.dumps({
                "schema": "sf-factory-closure-v1",
                "entry": closure_entry,
                "bundle": {"path": BUNDLE, "sha256": digest(bundle)},
                "inputs": [{"path": closure_entry, "sha256": digest(b"synthetic source")}],
                "assets": [],
            }).encode(),
        }
        executable = {"bin/orchestra", "bin/hugr-omni-supervisor"}
        checksums = {name: digest(payload) for name, payload in contents.items()}
        contents["distribution.json"] = json.dumps({
            "schema": "orchestra-distribution-v1",
            "version": "1.0.0",
            "target": "linux-x64-baseline",
            "files": [
                {"path": name, "sha256": checksum, "executable": name in executable}
                for name, checksum in sorted(checksums.items())
            ],
        }).encode()
        checksums["distribution.json"] = digest(contents["distribution.json"])
        contents["checksums.sha256"] = "".join(
            f"{checksum}  {name}\n" for name, checksum in sorted(checksums.items())
        ).encode()
        if corrupt_payload:
            contents[BUNDLE] = b"payload differs from sealed index"

        package_dir = Path(tempfile.mkdtemp(dir=self.root))
        artifact = package_dir / "orchestra-sf-entra-linux-x64-baseline.tar.gz"
        with tarfile.open(artifact, "w:gz") as archive:
            for name, payload in sorted(contents.items()):
                member = tarfile.TarInfo(name)
                member.size = len(payload)
                archive.addfile(member, io.BytesIO(payload))
            if extra is not None:
                archive.addfile(extra)
        artifact.chmod(0o600)
        receipt = package_dir / "receipt.json"
        archive_digest = digest(artifact.read_bytes())
        write_json(receipt, {
            "schema": "sf-entra-factory-package-v1",
            "proof": "packaged",
            "sourceSHA": candidate,
            "checkoutSHA": candidate,
            "expectedSourceSHA": candidate,
            "archiveFile": artifact.name,
            "archiveSha256": archive_digest,
            "manifestSha256": checksums["distribution.json"],
            "bundleSha256": checksums[BUNDLE],
            "target": "linux-x64-baseline",
            "runID": "123456",
            "runAttempt": "1",
        })
        return Namespace(
            candidate=candidate, artifact=str(artifact), receipt=str(receipt),
            sha256=archive_digest, fqdn="sf.example.test", apply=False, dry_run=True,
        )

    def snapshot(self):
        return {
            path.relative_to(self.vm).as_posix(): (
                path.lstat().st_ino,
                stat.S_IMODE(path.lstat().st_mode),
                os.readlink(path) if path.is_symlink()
                else path.read_bytes() if path.is_file()
                else None,
            )
            for path in sorted(self.vm.rglob("*"))
        }

    def result(self, operation, args, *, apply=False):
        args.apply = apply
        args.dry_run = not apply
        output = io.StringIO()
        with redirect_stdout(output):
            operation(args)
        return json.loads(output.getvalue())

    def test_dry_run_and_refusal_leave_vm_untouched(self):
        args = self.package()
        before = self.snapshot()
        result = self.result(installer.install, args)
        self.assertEqual(result["result"], "DRY_RUN_NO_WRITES")
        self.assertEqual(result["archiveDigest"], args.sha256)
        self.assertEqual(self.preflights, [False])
        self.assertEqual(self.snapshot(), before)

        artifact = Path(args.artifact)
        with artifact.open("ab") as file:
            file.write(b"changed after packaging")
        with self.assertRaisesRegex(RuntimeError, "archive SHA256 mismatch"):
            self.result(installer.install, args, apply=True)
        self.assertEqual(self.preflights, [False])
        self.assertEqual(self.snapshot(), before)

    def test_receipt_identity_and_protected_input(self):
        args = self.package()
        receipt_file = Path(args.receipt)
        valid = json.loads(receipt_file.read_text(encoding="utf-8"))
        for field, value in [
            ("schema", "sf-factory-package-v1"),
            ("proof", "browser-qualified"),
            ("checkoutSHA", SECOND),
            ("sourceSHA", SECOND),
            ("expectedSourceSHA", SECOND),
            ("archiveFile", "legacy.tar.gz"),
            ("target", "linux-arm64"),
            ("archiveSha256", "0" * 64),
            ("runAttempt", "0"),
        ]:
            with self.subTest(field=field):
                write_json(receipt_file, {**valid, field: value})
                with self.assertRaisesRegex(RuntimeError, "receipt|run identity"):
                    self.result(installer.install, args, apply=True)

        write_json(receipt_file, valid)
        receipt_file.chmod(0o622)
        with self.assertRaisesRegex(RuntimeError, "protected file with the expected owner"):
            self.result(installer.install, args, apply=True)
        receipt_file.chmod(0o600)
        substitute = receipt_file.with_name("receipt-link")
        substitute.symlink_to(receipt_file)
        args.receipt = str(substitute)
        with self.assertRaises((OSError, RuntimeError)):
            self.result(installer.install, args, apply=True)
        self.assertEqual(self.preflights, [])
        self.assertEqual(self.snapshot(), {})

    def test_archive_roster_and_factory_identity(self):
        link = tarfile.TarInfo("bin/link")
        link.type = tarfile.SYMTYPE
        link.linkname = "orchestra"
        for extra, error in [
            (tarfile.TarInfo("bin/unlisted"), "file roster"),
            (tarfile.TarInfo("bin/orchestra"), "duplicate"),
            (tarfile.TarInfo("../escape"), "noncanonical"),
            (link, "symlink"),
        ]:
            with self.subTest(member=extra.name):
                with self.assertRaisesRegex(RuntimeError, error):
                    self.result(installer.install, self.package(extra=extra), apply=True)

        with self.assertRaisesRegex(RuntimeError, "closure identity"):
            self.result(installer.install, self.package(closure_entry="local/entry.ts"), apply=True)
        args = self.package()
        receipt_file = Path(args.receipt)
        receipt = json.loads(receipt_file.read_text(encoding="utf-8"))
        write_json(receipt_file, {**receipt, "manifestSha256": "0" * 64})
        with self.assertRaisesRegex(RuntimeError, "manifest SHA256"):
            self.result(installer.install, args, apply=True)
        for apply in (False, True):
            with self.assertRaisesRegex(RuntimeError, "native ELF"):
                self.result(installer.install, self.package(orchestra=b"not ELF"), apply=apply)
        self.assertEqual(self.preflights, [])
        self.assertEqual(self.snapshot(), {})

    def test_apply_installs_once_and_failed_stage_preserves_current(self):
        args = self.package()
        first = self.result(installer.install, args, apply=True)
        self.assertEqual(first["result"], "INSTALLED_NOT_STARTED_CADDY_STILL_503")
        self.assertIsNone(first["previous"])
        self.assertFalse(first["idempotent"])
        self.assertEqual(self.current.readlink(), self.releases / FIRST)
        self.assertEqual(stat.S_IMODE((self.current / "bin/orchestra").stat().st_mode), 0o555)
        self.assertEqual(stat.S_IMODE((self.current / BUNDLE).stat().st_mode), 0o444)
        self.assertEqual(stat.S_IMODE(self.lock.stat().st_mode), 0o600)
        proof = json.loads((self.current / ".a7-source.json").read_text(encoding="utf-8"))
        self.assertEqual(proof["archiveSha256"], args.sha256)
        self.assertEqual((proof["runID"], proof["runAttempt"]), ("123456", "1"))

        before = self.snapshot()
        second = self.result(installer.install, args, apply=True)
        self.assertTrue(second["idempotent"])
        self.assertEqual(self.snapshot(), before)
        for name in ("distribution.json", "checksums.sha256", ".a7-source.json"):
            path = self.current / name
            path.chmod(0o644)
            try:
                with self.assertRaisesRegex(RuntimeError, "metadata permission drift"):
                    self.result(installer.install, args, apply=True)
            finally:
                path.chmod(0o444)
        self.assertEqual(self.snapshot(), before)

        damaged = self.package(SECOND, corrupt_payload=True)
        with self.assertRaisesRegex(RuntimeError, "payload"):
            self.result(installer.install, damaged)
        self.assertEqual(self.snapshot(), before)
        with self.assertRaisesRegex(RuntimeError, "payload"):
            self.result(installer.install, damaged, apply=True)
        self.assertEqual(self.snapshot(), before)

    def test_retry_syncs_release_and_current_entries_after_interrupted_publication(self):
        args = self.package()
        durable_sync = installer.sync_directory

        def fail_release(path):
            if Path(path) == self.releases:
                raise OSError("release fsync failed")
            durable_sync(path)

        with patch.object(installer, "sync_directory", side_effect=fail_release):
            with self.assertRaisesRegex(OSError, "release fsync failed"):
                self.result(installer.install, args, apply=True)
        self.assertFalse(self.current.is_symlink())
        self.assertTrue((self.releases / FIRST).is_dir())

        def fail_current(path):
            if Path(path) == self.vm:
                raise OSError("current fsync failed")
            durable_sync(path)

        with patch.object(installer, "sync_directory", side_effect=fail_current):
            with self.assertRaisesRegex(OSError, "current fsync failed"):
                self.result(installer.install, args, apply=True)
        self.assertEqual(self.current.readlink(), self.releases / FIRST)
        with patch.object(installer, "sync_directory", wraps=durable_sync) as sync:
            self.assertTrue(self.result(installer.install, args, apply=True)["idempotent"])
            self.assertEqual([Path(call.args[0]) for call in sync.call_args_list], [self.releases, self.vm])

    def test_rollback_requires_current_approval_proof_and_retained_release(self):
        first = self.package()
        self.result(installer.install, first, apply=True)
        self.result(installer.install, self.package(SECOND), apply=True)
        with self.assertRaisesRegex(RuntimeError, "requires rollback approval"):
            self.result(installer.install, first, apply=True)
        self.assertEqual(self.current.readlink(), self.releases / SECOND)
        approval = self.root / "approval.json"
        compatibility = self.root / "compatibility.json"
        reviewed = {
            "schema": "orchestra-sf.azure-migration-compatibility.v1",
            "currentCandidate": SECOND,
            "targetCandidate": FIRST,
            "compatible": True,
            "reviewer": "independent-reviewer",
        }
        write_json(compatibility, reviewed)
        write_json(approval, {
            "schema": "orchestra-sf.a7-code-rollback-approval.v1",
            "fromCandidate": SECOND,
            "toCandidate": FIRST,
            "schemaCompatible": True,
            "compatibilityProofSha256": digest(compatibility.read_bytes()),
            "approvedBy": "release-owner",
            "approvedAtUtc": "2026-01-01T00:00:00Z",
            "backupRecoveryPointId": "synthetic-backup",
        })
        args = Namespace(
            from_candidate=SECOND, to_candidate=FIRST, fqdn="sf.example.test",
            approval=str(approval), compatibility_proof=str(compatibility),
            dry_run=True, apply=False,
        )

        before = self.snapshot()
        self.assertEqual(self.result(installer.rollback, args)["result"], "DRY_RUN_NO_WRITES")
        self.assertEqual(self.snapshot(), before)
        write_json(compatibility, {**reviewed, "compatible": False})
        with self.assertRaisesRegex(RuntimeError, "approval|proof"):
            self.result(installer.rollback, args, apply=True)
        self.assertEqual(self.snapshot(), before)
        write_json(compatibility, reviewed)

        source_proof = self.releases / FIRST / ".a7-source.json"
        recorded = source_proof.read_bytes()
        source_proof.write_bytes(recorded.replace(FIRST.encode(), SECOND.encode()))
        modified = self.snapshot()
        with self.assertRaisesRegex(RuntimeError, "release|candidate|proof"):
            self.result(installer.rollback, args, apply=True)
        self.assertEqual(self.snapshot(), modified)
        source_proof.write_bytes(recorded)

        result = self.result(installer.rollback, args, apply=True)
        self.assertEqual(result["result"], "ROLLED_BACK_CODE_ONLY_CADDY_STILL_503")
        self.assertEqual(self.current.readlink(), self.releases / FIRST)
        after = self.snapshot()
        self.assertEqual(
            {path: entry for path, entry in before.items() if path != "current"},
            {path: entry for path, entry in after.items() if path != "current"},
        )
        with self.assertRaisesRegex(RuntimeError, "current release changed"):
            self.result(installer.rollback, args, apply=True)
        self.assertEqual(self.snapshot(), after)


if __name__ == "__main__":
    unittest.main(verbosity=2)
