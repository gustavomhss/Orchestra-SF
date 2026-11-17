#!/usr/bin/env python3
"""Synthetic integrity tests only: no real UAT outcome, identity, or product tests."""
import copy
import importlib.util
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

MODULE_PATH = Path(__file__).with_name("reconcile_execution.py")
SPEC = importlib.util.spec_from_file_location("uat_reconcile", MODULE_PATH)
reconcile = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(reconcile)


class AppendOnlyEvidenceHistoryTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.previous_root = reconcile.ROOT
        reconcile.ROOT = Path(self.folder.name)
        self.inventories = {"stories": {"SF-E2E-001"}, "route_probes": set(), "operations": set()}
        self.first_attempt = {
            "attempt_id": "SYNTHETIC-001",
            "product_commit_sha": "a" * 40,
            "record_sha256": "1" * 64,
            "status": "BLOCKED_ENVIRONMENT",
        }
        self.second_attempt = {
            "attempt_id": "SYNTHETIC-002",
            "product_commit_sha": "a" * 40,
            "record_sha256": "2" * 64,
            "status": "FAILED_PRODUCT",
        }
        self.first = reconcile.seal_event(
            1, reconcile.CHAIN_ZERO, "stories", "SF-E2E-001", self.first_attempt
        )
        prior_hash = reconcile.json.loads(self.first)["entry_sha256"]
        self.second = reconcile.seal_event(
            2, prior_hash, "stories", "SF-E2E-001", self.second_attempt
        )
        self.raw = self.first + self.second
        self.index = reconcile.ledger_index(self.raw, self.inventories)
        self.trace = {
            "execution_index": self.index,
            "file_sha256": {reconcile.LEDGER: reconcile.digest(self.raw)},
        }
        (reconcile.ROOT / reconcile.LEDGER).write_bytes(self.raw)

    def tearDown(self):
        reconcile.ROOT = self.previous_root
        self.folder.cleanup()

    def test_intact_chain_and_index_are_accepted(self):
        self.assertEqual(reconcile.verify_ledger(self.trace, self.index, self.inventories), self.raw)

    def test_deletion_from_trace_index_is_rejected(self):
        corrupted = copy.deepcopy(self.index)
        corrupted["stories"]["SF-E2E-001"]["attempts"].pop(0)
        with self.assertRaisesRegex(ValueError, "history differs"):
            reconcile.verify_ledger(self.trace, corrupted, self.inventories)

    def test_reordering_trace_attempts_is_rejected(self):
        corrupted = copy.deepcopy(self.index)
        corrupted["stories"]["SF-E2E-001"]["attempts"].reverse()
        with self.assertRaisesRegex(ValueError, "history differs"):
            reconcile.verify_ledger(self.trace, corrupted, self.inventories)

    def test_deletion_from_ledger_is_rejected_even_with_new_digest_pin(self):
        truncated = self.second
        (reconcile.ROOT / reconcile.LEDGER).write_bytes(truncated)
        self.trace["file_sha256"][reconcile.LEDGER] = reconcile.digest(truncated)
        with self.assertRaisesRegex(ValueError, "sequence deleted or reordered"):
            reconcile.verify_ledger(self.trace, self.index, self.inventories)

    def test_reordering_ledger_lines_is_rejected(self):
        (reconcile.ROOT / reconcile.LEDGER).write_bytes(self.second + self.first)
        with self.assertRaisesRegex(ValueError, "sequence deleted or reordered"):
            reconcile.verify_ledger(self.trace, self.index, self.inventories)

    def test_save_appends_bytes_and_refuses_stale_preimage(self):
        (reconcile.ROOT / reconcile.LEDGER).write_bytes(self.first)
        reconcile.save_files({}, self.trace, self.first, self.second)
        self.assertEqual((reconcile.ROOT / reconcile.LEDGER).read_bytes(), self.raw)
        with self.assertRaisesRegex(ValueError, "changed concurrently"):
            reconcile.save_files({}, self.trace, self.first, self.second)
        self.assertEqual((reconcile.ROOT / reconcile.LEDGER).read_bytes(), self.raw)

    @unittest.skipUnless(shutil.which("git"), "git unavailable")
    def test_git_anchor_rejects_forged_rechain(self):
        def git(*args):
            return subprocess.run(["git", "-C", str(reconcile.ROOT), *args],
                                  check=True, capture_output=True)
        git("init", "-q")
        git("config", "user.name", "Synthetic QA")
        git("config", "user.email", "qa@example.invalid")
        git("add", reconcile.LEDGER)
        git("commit", "-qm", "pin synthetic history")
        reordered_first = reconcile.seal_event(
            1, reconcile.CHAIN_ZERO, "stories", "SF-E2E-001", self.second_attempt
        )
        reordered_hash = reconcile.json.loads(reordered_first)["entry_sha256"]
        reordered_second = reconcile.seal_event(
            2, reordered_hash, "stories", "SF-E2E-001", self.first_attempt
        )
        forged = reordered_first + reordered_second
        (reconcile.ROOT / reconcile.LEDGER).write_bytes(forged)
        forged_index = reconcile.ledger_index(forged, self.inventories)
        forged_trace = {"file_sha256": {reconcile.LEDGER: reconcile.digest(forged)}}
        with self.assertRaisesRegex(ValueError, "vs git HEAD"):
            reconcile.verify_ledger(forged_trace, forged_index, self.inventories)


if __name__ == "__main__":
    unittest.main()
