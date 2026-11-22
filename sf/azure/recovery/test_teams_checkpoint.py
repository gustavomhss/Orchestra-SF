"""Real filesystem/SQLite controls; these do not impersonate an installed Azure VM."""
from datetime import datetime, timezone
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sqlite3
import stat
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("checkpoint", Path(__file__).with_name("teams-checkpoint.py"))
checkpoint = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(checkpoint)


class CheckpointTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="sf-g10-component-")
        self.root = Path(self.temporary.name).resolve()
        self.roots = {"state": self.root / "state", "configuration": self.root / "configuration"}
        self.destination = self.root / "backup"
        self.clone = self.root / "clone"
        for directory in [*self.roots.values(), self.destination, self.clone]:
            directory.mkdir(mode=0o700)
        self.database = self.roots["state"] / "installation.sqlite"
        with sqlite3.connect(self.database) as db:
            db.executescript("CREATE TABLE effects (id TEXT PRIMARY KEY, receipt TEXT NOT NULL);"
                             "INSERT INTO effects VALUES ('original', 'receipt-original');")
        self.database.chmod(0o600)
        (self.roots["state"] / "empty").mkdir(mode=0o700)
        (self.roots["state"] / "attachments").mkdir(mode=0o700)
        (self.roots["state"] / "attachments" / "private.bin").write_bytes(bytes(range(256)) * 80)
        (self.roots["configuration"] / "runtime.env").write_text("COMPONENT_FIXTURE_ONLY=1\n")
        self.binding = {"candidate": {"sha": "a" * 40, "tree": "b" * 40},
                        "archiveSha256": "c" * 64, "service": "NOT_OBSERVED_IN_COMPONENT_TEST"}

    def tearDown(self):
        self.temporary.cleanup()

    def make(self):
        return checkpoint.checkpoint_files(self.roots, self.destination, self.binding)

    def rewrite_archive(self, archive, receipt, change):
        with tarfile.open(archive, "r:gz") as source:
            members = [(member, source.extractfile(member).read() if member.isfile() else None)
                       for member in source.getmembers()]
        altered = self.destination / "altered.tar.gz"
        with tarfile.open(altered, "w:gz") as target:
            for member, data in change(members):
                target.addfile(member, io.BytesIO(data) if data is not None else None)
        altered.chmod(0o600)
        # Simulate a replaced outer checksum to ensure the inner inventory still
        # detects tampered payloads, rosters and path types independently.
        bound = {**receipt, "archive": {"sha256": checkpoint.file_digest(altered), "bytes": altered.stat().st_size}}
        return altered, bound

    def test_roundtrip_includes_database_attachment_configuration_and_empty_directory(self):
        archive, receipt = self.make()
        manifest = checkpoint.verify_checkpoint(archive, receipt)
        result = checkpoint.restore_clone_files(archive, receipt, self.clone)
        self.assertEqual(result["proofClass"], "ISOLATED_CLONE_FILE_INTEGRITY_ONLY")
        self.assertFalse(result["releaseQualified"])
        self.assertEqual(result["businessRecovery"], "NOT_RUN")
        self.assertEqual(result["keyDecryption"], "NOT_RUN")
        self.assertEqual(manifest["sqlite"], ["state/installation.sqlite"])
        self.assertEqual(receipt["entryCount"], 7)
        restored = self.clone / "restored"
        self.assertTrue((restored / "state/empty").is_dir())
        self.assertEqual((restored / "state/attachments/private.bin").read_bytes(), bytes(range(256)) * 80)
        self.assertEqual((restored / "configuration/runtime.env").read_bytes(), b"COMPONENT_FIXTURE_ONLY=1\n")
        with sqlite3.connect(restored / "state/installation.sqlite") as db:
            self.assertEqual(db.execute("SELECT id, receipt FROM effects").fetchall(), [("original", "receipt-original")])
        self.assertEqual(stat.S_IMODE(archive.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE((restored / "state/installation.sqlite").stat().st_mode), 0o600)

    def test_clone_never_overwrites_original_post_checkpoint_data(self):
        archive, receipt = self.make()
        with sqlite3.connect(self.database) as db:
            db.execute("INSERT INTO effects VALUES ('later', 'receipt-later')")
        original = checkpoint.file_digest(self.database)
        checkpoint.restore_clone_files(archive, receipt, self.clone)
        self.assertEqual(checkpoint.file_digest(self.database), original)
        with sqlite3.connect(self.database) as db:
            self.assertEqual(db.execute("SELECT count(*) FROM effects").fetchone(), (2,))
        with sqlite3.connect(self.clone / "restored/state/installation.sqlite") as db:
            self.assertEqual(db.execute("SELECT count(*) FROM effects").fetchone(), (1,))

    def test_symlink_hardlink_and_special_files_are_refused(self):
        node = self.roots["state"] / "unadmitted"
        for kind in ("symlink", "hardlink", "fifo"):
            with self.subTest(kind=kind):
                if kind == "symlink":
                    node.symlink_to(self.database)
                elif kind == "hardlink":
                    os.link(self.database, node)
                else:
                    os.mkfifo(node)
                try:
                    with self.assertRaises((ValueError, OSError)):
                        self.make()
                finally:
                    node.unlink()
        self.assertEqual(list(self.destination.iterdir()), [])

    def test_nonempty_sqlite_journal_requires_clean_shutdown(self):
        Path(str(self.database) + "-wal").write_bytes(b"unsettled-wal")
        with self.assertRaisesRegex(ValueError, "unsettled SQLite journal"):
            self.make()

    def test_missing_or_corrupt_database_cannot_produce_a_receipt(self):
        self.database.unlink()
        with self.assertRaisesRegex(ValueError, "no actual SQLite"):
            self.make()
        self.database.write_bytes(b"SQLite format 3\x00" + b"corrupt" * 100)
        with self.assertRaises(sqlite3.DatabaseError):
            self.make()
        self.assertEqual(list(self.destination.iterdir()), [])

    def test_backup_destination_inside_source_is_refused(self):
        nested = self.roots["state"] / "nested-backup"
        nested.mkdir(mode=0o700)
        with self.assertRaisesRegex(ValueError, "outside every source"):
            checkpoint.checkpoint_files(self.roots, nested, self.binding)

    def test_changed_archive_is_refused_before_clone_writes(self):
        archive, receipt = self.make()
        with archive.open("ab") as stream:
            stream.write(b"changed")
        with self.assertRaisesRegex(ValueError, "hash or size differs"):
            checkpoint.restore_clone_files(archive, receipt, self.clone)
        self.assertEqual(list(self.clone.iterdir()), [])

    def test_changed_payload_is_refused_even_with_updated_outer_digest(self):
        archive, receipt = self.make()
        def alter(members):
            return [(member, b"X" * len(data) if member.name.endswith("private.bin") else data)
                    for member, data in members]
        modified, bound = self.rewrite_archive(archive, receipt, alter)
        with self.assertRaisesRegex(ValueError, "file hash differs"):
            checkpoint.restore_clone_files(modified, bound, self.clone)
        self.assertEqual(list(self.clone.iterdir()), [])

    def test_missing_duplicate_extra_and_traversal_members_are_refused(self):
        archive, receipt = self.make()
        extra = tarfile.TarInfo("state/extra")
        extra.size = 1
        traversal = tarfile.TarInfo("state/../../outside")
        traversal.size = 1
        changes = {
            "missing": lambda members: members[:-1],
            "duplicate": lambda members: members + [members[-1]],
            "extra": lambda members: members + [(extra, b"x")],
            "traversal": lambda members: members + [(traversal, b"x")],
            "duplicate-inventory": lambda members: [members[0], members[0], *members[1:]],
        }
        for name, change in changes.items():
            with self.subTest(name=name):
                altered, bound = self.rewrite_archive(archive, receipt, change)
                with self.assertRaises(ValueError):
                    checkpoint.restore_clone_files(altered, bound, self.clone)
                self.assertEqual(list(self.clone.iterdir()), [])
                altered.unlink()

    def test_link_archive_member_cannot_escape_clone(self):
        archive, receipt = self.make()
        def alter(members):
            for member, data in members:
                if member.name.endswith("private.bin"):
                    member.type = tarfile.SYMTYPE
                    member.linkname = "/etc/passwd"
                    member.size = 0
                    yield member, None
                else:
                    yield member, data
        altered, bound = self.rewrite_archive(archive, receipt, alter)
        with self.assertRaisesRegex(ValueError, "file differs"):
            checkpoint.restore_clone_files(altered, bound, self.clone)
        self.assertEqual(list(self.clone.iterdir()), [])

    def test_source_mutation_during_copy_has_no_published_receipt(self):
        original_add = tarfile.TarFile.addfile
        changed = False
        def addfile(package, member, fileobj=None):
            nonlocal changed
            result = original_add(package, member, fileobj)
            if member.name.endswith("private.bin") and not changed:
                changed = True
                (self.roots["configuration"] / "runtime.env").write_bytes(b"changed-after-copy")
            return result
        with patch.object(tarfile.TarFile, "addfile", addfile):
            with self.assertRaisesRegex(ValueError, "source changed"):
                self.make()
        self.assertTrue(changed)
        self.assertEqual(list(self.destination.iterdir()), [])

    def test_clone_requires_empty_private_real_directory(self):
        archive, receipt = self.make()
        (self.clone / "existing").write_text("must survive")
        with self.assertRaises(ValueError):
            checkpoint.restore_clone_files(archive, receipt, self.clone)
        self.assertEqual((self.clone / "existing").read_text(), "must survive")
        link = self.root / "clone-link"
        link.symlink_to(self.clone, target_is_directory=True)
        with self.assertRaises(ValueError):
            checkpoint.restore_clone_files(archive, receipt, link)

    def release_inputs(self):
        source = {"sha": "d" * 40, "archiveSha256": "e" * 64, "manifestSha256": "f" * 64}
        reservation = {**self.binding, "sourceRelease": source}
        g07 = {"schema": "sf-g07-package-v1", "candidate": self.binding["candidate"],
               "archive": {"sha256": self.binding["archiveSha256"]},
               "manifest": {"sha256": "1" * 64}, "verification": {"status": "PACKAGE_VERIFIED"}}
        installed = {"schema": "orchestra-sf.a7-entra-release-v1", "sourceSHA": source["sha"],
                     "archiveSha256": source["archiveSha256"], "manifestSha256": source["manifestSha256"]}
        return reservation, g07, installed

    def test_precutover_checkpoint_binds_observed_R_separately_from_target_C(self):
        reservation, g07, installed = self.release_inputs()
        source = checkpoint.bind_releases(reservation, g07, installed["sourceSHA"], installed)
        self.assertNotEqual(source["sha"], reservation["candidate"]["sha"])
        archive, receipt = checkpoint.checkpoint_files(self.roots, self.destination, {
            **self.binding, "sourceRelease": source,
        })
        clone = checkpoint.restore_clone_files(archive, receipt, self.clone)
        self.assertEqual(clone["binding"]["sourceRelease"], source)
        self.assertEqual(clone["binding"]["candidate"], g07["candidate"])
        self.assertFalse(clone["releaseQualified"])

    def test_wrong_source_or_target_cannot_be_credited_as_precutover_backup(self):
        reservation, g07, installed = self.release_inputs()
        for key, wrong in (("sourceSHA", "2" * 40), ("archiveSha256", "3" * 64), ("manifestSha256", "4" * 64)):
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "source release differs"):
                checkpoint.bind_releases(reservation, g07, installed["sourceSHA"], {**installed, key: wrong})
        with self.assertRaisesRegex(ValueError, "source release differs"):
            checkpoint.bind_releases(reservation, g07, "5" * 40, installed)
        with self.assertRaisesRegex(ValueError, "G07 target"):
            checkpoint.bind_releases(reservation, {**g07, "archive": {"sha256": "6" * 64}}, installed["sourceSHA"], installed)

    def test_postcutover_checkpoint_requires_exact_G07_C_bytes(self):
        reservation, g07, installed = self.release_inputs()
        source = {"sha": g07["candidate"]["sha"], "archiveSha256": g07["archive"]["sha256"],
                  "manifestSha256": g07["manifest"]["sha256"]}
        reservation["sourceRelease"] = source
        installed.update(sourceSHA=source["sha"], archiveSha256=source["archiveSha256"], manifestSha256=source["manifestSha256"])
        self.assertEqual(checkpoint.bind_releases(reservation, g07, source["sha"], installed), source)
        wrong_source = {**source, "archiveSha256": "7" * 64}
        with self.assertRaisesRegex(ValueError, "post-cutover source C"):
            checkpoint.bind_releases({**reservation, "sourceRelease": wrong_source}, g07, source["sha"],
                                     {**installed, "archiveSha256": wrong_source["archiveSha256"]})

    def clone_inputs(self, receipt, name):
        # These are component inputs only, never an observation of an Azure VM.
        vm = "/subscriptions/component/resourceGroups/component/providers/Microsoft.Compute/virtualMachines/" + name
        reservation = {
            "schema": "orchestra-sf.g10-reservation.v1", "action": "verify-clone",
            "candidate": receipt["binding"]["candidate"], "archiveSha256": receipt["binding"]["archiveSha256"],
            "sourceRelease": receipt["binding"]["sourceRelease"], "sourceVmResourceId": receipt["binding"]["vmResourceId"],
            "vmResourceId": vm, "networkEgressFenced": True, "credentialsDisabled": True,
        }
        file = self.root / (name + "-reservation.json")
        checkpoint.write_private(file, reservation)
        observation = {
            "vm": {"source": "AZURE_IMDS", "resourceId": vm.lower(),
                   "observedAtUtc": datetime.now(timezone.utc).isoformat()},
            "reservationSha256": hashlib.sha256(file.read_bytes()).hexdigest(),
        }
        return reservation, observation

    def test_reserved_clone_records_its_own_VM_reservation_and_time_separately_from_source(self):
        source_vm = "/subscriptions/component/resourcegroups/component/providers/microsoft.compute/virtualmachines/source"
        reservation, _, _ = self.release_inputs()
        binding = {**self.binding, "sourceRelease": reservation["sourceRelease"], "vmResourceId": source_vm}
        archive, receipt = checkpoint.checkpoint_files(self.roots, self.destination, binding)
        results = []
        for name in ("clone-a", "clone-b"):
            reserved, observed = self.clone_inputs(receipt, name)
            destination = self.root / name
            destination.mkdir(mode=0o700)
            result = checkpoint.restore_reserved_clone(archive, receipt, destination, reserved, observed)
            results.append(result)
            self.assertEqual(result["schema"], "orchestra-sf.teams-clone-integrity.v3")
            self.assertEqual(result["binding"], binding)
            self.assertEqual(result["clone"]["vm"], observed["vm"])
            self.assertNotEqual(result["clone"]["vm"]["resourceId"], source_vm)
            self.assertEqual(result["clone"]["reservationSha256"], observed["reservationSha256"])
            self.assertGreaterEqual(datetime.fromisoformat(result["clone"]["verifiedAtUtc"]),
                                    datetime.fromisoformat(observed["vm"]["observedAtUtc"]))
            self.assertEqual(result["clone"]["isolation"], {
                "source": "OPERATOR_ATTESTATION", "networkEgressFenced": True, "credentialsDisabled": True,
            })
            self.assertFalse(result["releaseQualified"])
            self.assertEqual(result["businessRecovery"], "NOT_RUN")
            self.assertEqual((destination / "restored/configuration/runtime.env").read_bytes(), b"COMPONENT_FIXTURE_ONLY=1\n")
        self.assertNotEqual(results[0]["clone"], results[1]["clone"])
        self.assertNotEqual(results[0]["clone"]["reservationSha256"], results[1]["clone"]["reservationSha256"])
        self.assertEqual(results[0]["sourceArchiveSha256"], results[1]["sourceArchiveSha256"])

    def test_reserved_clone_refuses_missing_changed_or_source_VM_evidence_before_writing(self):
        source_vm = "/subscriptions/component/resourcegroups/component/providers/microsoft.compute/virtualmachines/source"
        source, _, _ = self.release_inputs()
        archive, receipt = checkpoint.checkpoint_files(self.roots, self.destination, {
            **self.binding, "sourceRelease": source["sourceRelease"], "vmResourceId": source_vm,
        })
        reserved, observed = self.clone_inputs(receipt, "clone")
        cases = [
            ("missing-observation", reserved, {}),
            ("wrong-observed-VM", reserved, {**observed, "vm": {**observed["vm"], "resourceId": source_vm}}),
            ("missing-VM-identity", reserved, {**observed, "vm": {**observed["vm"], "resourceId": ""}}),
            ("attested-VM", reserved, {**observed, "vm": {**observed["vm"], "source": "OPERATOR_ATTESTATION"}}),
            ("invalid-reservation-digest", reserved, {**observed, "reservationSha256": "invalid"}),
            ("missing-observation-time", reserved, {**observed, "vm": {**observed["vm"], "observedAtUtc": ""}}),
            ("source-reservation", {**reserved, "action": "checkpoint"}, observed),
            ("same-source-VM", {**reserved, "vmResourceId": source_vm},
             {**observed, "vm": {**observed["vm"], "resourceId": source_vm}}),
            ("other-backup-source", {**reserved, "sourceVmResourceId": reserved["vmResourceId"]}, observed),
            ("missing-isolation-attestation", {**reserved, "credentialsDisabled": False}, observed),
        ]
        for name, reservation, observation in cases:
            with self.subTest(name=name), self.assertRaises(ValueError):
                checkpoint.restore_reserved_clone(archive, receipt, self.clone, reservation, observation)
            self.assertEqual(list(self.clone.iterdir()), [])


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(CheckpointTests)
    expected = [case.id() for case in suite]
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    receipt_path = os.environ.get("G10_COMPONENT_RECEIPT")
    if receipt_path:
        checkpoint.write_private(Path(receipt_path), {
            "schema": "orchestra-sf.g10-component-tests.v1", "proofClass": "FILESYSTEM_COMPONENT_CONTROLS",
            "candidateSha": os.environ.get("G10_COMPONENT_SOURCE_SHA", os.environ.get("GITHUB_SHA")),
            "candidateTree": os.environ.get("G10_COMPONENT_SOURCE_TREE"),
            "workflowSha": os.environ.get("GITHUB_SHA"), "runId": os.environ.get("GITHUB_RUN_ID"),
            "runAttempt": os.environ.get("GITHUB_RUN_ATTEMPT"), "expectedCases": expected,
            "caseInventorySha256": hashlib.sha256(checkpoint.canonical_json(expected)).hexdigest(),
            "executed": result.testsRun, "failures": len(result.failures), "errors": len(result.errors),
            "skipped": len(result.skipped), "result": "PASS" if result.wasSuccessful() and not result.skipped else "FAIL",
            "installedTeamsProof": False, "releaseQualified": False,
        })
    sys.exit(0 if result.wasSuccessful() and not result.skipped and result.testsRun == len(expected) else 1)
