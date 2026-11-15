#!/usr/bin/env python3
"""Adversarial launch-input regressions. No network, product tests, CI or authority grant.

Run from repository checkout:
  python -m unittest discover -s modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/parallel-20 -p 'test_*.py' -v
All positive fixtures are synthetic and MUST NOT be used as authorization.
"""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
VALIDATOR = HERE / "validate_dispatch.py"
TEMPLATE = HERE / "launch-record.template.json"

class LaunchInputTests(unittest.TestCase):
    def execute(self, record=None):
        with tempfile.TemporaryDirectory(prefix="sf-prelaunch-test-") as tmp:
            cmd = [sys.executable, str(VALIDATOR), "--root", str(ROOT)]
            if record is not None:
                target = Path(tmp) / "synthetic-launch.json"
                target.write_text(json.dumps(record), encoding="utf-8")
                cmd += ["--launch", str(target)]
            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        self.assertNotIn("Traceback", result.stderr + result.stdout, result.stderr)
        try:
            parsed = json.loads(result.stdout)
        except json.JSONDecodeError:
            self.fail("validator did not produce JSON: " + result.stdout[:500] + result.stderr[:300])
        self.assertFalse(parsed["authorized_to_write_product"])
        self.assertEqual(parsed["product_test_status"], "NOT_RUN")
        return result.returncode, parsed

    def fixture(self):
        record = json.loads(TEMPLATE.read_text(encoding="utf-8"))
        record.update({
            "material_sha": "a" * 40,
            "material_tree": "b" * 40,
            "s0_authority": "SYNTHETIC_NOT_AUTHORIZED",
            "integrator_71_ack": "historical71",
            "current_integrator_ack": "synthetic-successor-ack",
            "current_integrator_authority": "synthetic-S0-assignment",
            "current_integrator_lease": "synthetic-successor-lease",
            "integrator_identity": "synthetic-integrator",
            "integrator_branch": "synthetic-branch",
            "dispatcher_45_ack": "synthetic-dispatcher",
            "source_family_blobs": {"apps/cli/src/sucafina-product/installation.ts": "c" * 40},
            "contract_blobs": {"modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/CONTRACTS.md": "d" * 40},
            "observed_actor_slots": 1,
            "observed_runner_slots": 0,
            "owner_releases": {"synthetic": "synthetic-only"},
            "leases": [self.lease("D01", "apps/desktop/src/main/sucafina/integration.ts")],
        })
        return record

    @staticmethod
    def lease(order, path):
        return {
            "lease_id": "synthetic-" + order,
            "order_id": order,
            "output_id": None,
            "actor": "synthetic-" + order,
            "branch": "synthetic-" + order.lower(),
            "owner_ack": "SYNTHETIC_NOT_AUTHORIZED",
            "owned_paths": [path],
            "base_sha": "a" * 40,
            "tree_sha": "b" * 40,
            "current_preimages": {path: None},
            "consumed_contract_blobs": {"contract": "d" * 40},
            "source_pins": {"source": "c" * 40},
        }

    def test_document_only_without_launch(self):
        code, body = self.execute()
        self.assertEqual(code, 0, body)
        self.assertEqual(body["launch"], "NO_LAUNCH_RECORD")

    def test_empty_template_fails_closed(self):
        template = json.loads(TEMPLATE.read_text(encoding="utf-8"))
        code, body = self.execute(template)
        self.assertNotEqual(code, 0)
        self.assertEqual(body["status"], "DOCUMENTARY_DISPATCH_STRUCTURE_FAIL")

    def test_synthetic_format_never_authorizes(self):
        code, body = self.execute(self.fixture())
        self.assertEqual(code, 0, body)
        self.assertEqual(body["launch"], "FORMAT_CHECK_ONLY_NOT_AUTHORIZATION")

    def test_null_capacity_fails(self):
        record = self.fixture()
        record["observed_actor_slots"] = None
        code, body = self.execute(record)
        self.assertNotEqual(code, 0)
        self.assertTrue(body["errors"])

    def test_borrowed_c00_path_is_rejected(self):
        record = self.fixture()
        record["leases"][0]["owned_paths"] = ["packages/server/src/routes.ts"]
        code, body = self.execute(record)
        self.assertNotEqual(code, 0)
        self.assertTrue(any("outside allowlist" in x for x in body["errors"]), body)

    def test_historical_100_ack_is_rejected(self):
        record = self.fixture()
        record["current_integrator_ack"] = "01efff55ee289cd897f912b9ae96c893b966e658"
        code, body = self.execute(record)
        self.assertNotEqual(code, 0)
        self.assertTrue(any("ended 71/100" in x for x in body["errors"]), body)

    def test_historical_100_lease_is_rejected(self):
        record = self.fixture()
        record["current_integrator_lease"] = "S0-C-e14-browser100"
        code, body = self.execute(record)
        self.assertNotEqual(code, 0)
        self.assertTrue(any("ended 71/100" in x for x in body["errors"]), body)

    def test_duplicate_writer_branch_is_rejected(self):
        record = self.fixture()
        other = self.lease("F01", "packages/schema/src/sucafina/context.ts")
        other["branch"] = record["leases"][0]["branch"]
        record["leases"].append(other)
        record["observed_actor_slots"] = 2
        code, body = self.execute(record)
        self.assertNotEqual(code, 0)
        self.assertTrue(any("duplicate active writer branch" in x for x in body["errors"]), body)

    def test_invalid_git_blob_digest_is_rejected(self):
        record = self.fixture()
        record["contract_blobs"]["bad.txt"] = "fake-sha"
        code, body = self.execute(record)
        self.assertNotEqual(code, 0)
        self.assertTrue(any("invalid Git blob SHA" in x for x in body["errors"]), body)

if __name__ == "__main__":
    unittest.main()
