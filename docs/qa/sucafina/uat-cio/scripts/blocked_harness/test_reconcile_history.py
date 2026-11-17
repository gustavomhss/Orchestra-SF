import json
from pathlib import Path
import tempfile
import unittest

import reconcile_execution
from blocked_harness.evaluate import (
    check_bundle,
    evaluate,
    write_bundle,
)


class BlockedHarnessTests(unittest.TestCase):
    def inventory(self) -> dict[str, dict]:
        return {
            f"SF-UI{index:02d}-P01": {
                "id": f"SF-UI{index:02d}-P01",
                "status": "DESIGNED_NOT_EXECUTED",
                "actor": f"ROLE-{index:02d}",
                "surface_ids": [f"UI{index:02d}"],
                "title": f"Story {index}",
            }
            for index in range(1, 22)
        }

    def selection(self, inventory: dict[str, dict]) -> dict:
        stories = []
        for index, story_id in enumerate(sorted(inventory), start=1):
            capability = index <= 13
            stories.append({
                "id": story_id,
                "classification": "BLOCKED_CAPABILITY" if capability else "BLOCKED_ENVIRONMENT",
                "classification_evidence_ref": f"audit-classification/{story_id}",
                "actor_role": f"ROLE-{index:02d}",
                "requirements": [{
                    "id": f"REQ-{index:02d}",
                    "kind": "producer_port" if capability else "fault_injection",
                    "blocked_reason_code": (
                        f"MISSING_CAPABILITY_{index:02d}"
                        if capability else f"MISSING_ENVIRONMENT_{index:02d}"
                    ),
                    "description": "Required preflight dependency for the exact candidate.",
                }],
            })
        return {
            "schema": "sf-blocked-harness-selection-v1",
            "candidate_sha": "a" * 40,
            "candidate_tree_sha": "b" * 40,
            "installed_artifact_sha256": "c" * 64,
            "classification_source_ref": "audit/model-user-journeys@reviewed-01",
            "classification_source_sha256": "d" * 64,
            "stories": stories,
        }

    def observations(self, selection: dict) -> dict:
        rows = []
        for story in selection["stories"]:
            capability = story["classification"] == "BLOCKED_CAPABILITY"
            for requirement in story["requirements"]:
                rows.append({
                    "story_id": story["id"],
                    "requirement_id": requirement["id"],
                    "state": "ABSENT" if capability else "UNAVAILABLE",
                    "sanitized_trace_ref": f"secure/preflight/{story['id']}",
                    "observed_value_sha256": "e" * 64,
                })
        return {
            "schema": "sf-blocked-harness-observations-v1",
            "candidate_sha": selection["candidate_sha"],
            "candidate_tree_sha": selection["candidate_tree_sha"],
            "installed_artifact_sha256": selection["installed_artifact_sha256"],
            "observed_at_utc": "2026-11-17T18:00:00Z",
            "operator_alias": "qa-operator",
            "attempt_alias": "preflight-01",
            "probe_bundle_sha256": "f" * 64,
            "observations": rows,
        }

    def test_builds_13_capability_and_8_environment_records(self) -> None:
        inventory = self.inventory()
        selection = self.selection(inventory)
        observations = self.observations(selection)
        manifest, results, records = evaluate(inventory, selection, observations)
        self.assertEqual(manifest["story_count"], 21)
        self.assertEqual(manifest["result_counts"]["BLOCKED_CAPABILITY"], 13)
        self.assertEqual(manifest["result_counts"]["BLOCKED_ENVIRONMENT"], 8)
        self.assertEqual(manifest["pass_claims"], 0)
        self.assertEqual(len(records), 21)

        inventories = {
            "stories": set(inventory),
            "route_probes": set(),
            "operations": set(),
        }
        for record in records.values():
            self.assertEqual(reconcile_execution.validate_record(record, inventories), "stories")

        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root = base / "repo"
            root.mkdir()
            output = base / "private-preflight"
            write_bundle(output, manifest, results, records, root=root)
            verified = check_bundle(output)
            self.assertEqual(verified["result_counts"], manifest["result_counts"])

    def test_unavailable_capability_is_incomplete_not_absent(self) -> None:
        inventory = self.inventory()
        selection = self.selection(inventory)
        observations = self.observations(selection)
        first = selection["stories"][0]
        for row in observations["observations"]:
            if row["story_id"] == first["id"]:
                row["state"] = "UNAVAILABLE"
        manifest, results, records = evaluate(inventory, selection, observations)
        self.assertEqual(results[first["id"]]["result"], "PRECHECK_INCOMPLETE")
        self.assertNotIn(first["id"], records)
        self.assertEqual(manifest["result_counts"]["PRECHECK_INCOMPLETE"], 1)
        self.assertEqual(manifest["result_counts"]["BLOCKED_CAPABILITY"], 12)

    def test_present_dependencies_make_story_ready_without_pass_claim(self) -> None:
        inventory = self.inventory()
        selection = self.selection(inventory)
        observations = self.observations(selection)
        first = selection["stories"][0]
        for row in observations["observations"]:
            if row["story_id"] == first["id"]:
                row["state"] = "PRESENT"
        manifest, results, records = evaluate(inventory, selection, observations)
        self.assertEqual(results[first["id"]]["result"], "READY_FOR_EXECUTION")
        self.assertFalse(results[first["id"]]["journey_executed"])
        self.assertNotIn(first["id"], records)
        self.assertEqual(manifest["pass_claims"], 0)

    def test_rejects_wrong_classification_counts(self) -> None:
        inventory = self.inventory()
        selection = self.selection(inventory)
        selection["stories"][12]["classification"] = "BLOCKED_ENVIRONMENT"
        selection["stories"][12]["requirements"][0]["kind"] = "browser"
        with self.assertRaisesRegex(ValueError, "expected 13 capability"):
            evaluate(inventory, selection, self.observations(selection))

    def test_rejects_candidate_mismatch(self) -> None:
        inventory = self.inventory()
        selection = self.selection(inventory)
        observations = self.observations(selection)
        observations["candidate_sha"] = "9" * 40
        with self.assertRaisesRegex(ValueError, "does not match"):
            evaluate(inventory, selection, observations)

    def test_detects_tampered_record(self) -> None:
        inventory = self.inventory()
        selection = self.selection(inventory)
        observations = self.observations(selection)
        manifest, results, records = evaluate(inventory, selection, observations)
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root = base / "repo"
            root.mkdir()
            output = base / "private-preflight"
            write_bundle(output, manifest, results, records, root=root)
            story_id = sorted(records)[0]
            path = output / "records" / f"{story_id}.json"
            record = json.loads(path.read_text(encoding="utf-8"))
            record["actual_result"] = "tampered"
            path.write_text(json.dumps(record), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "record digest mismatch"):
                check_bundle(output)

    def test_refuses_repository_output(self) -> None:
        inventory = self.inventory()
        selection = self.selection(inventory)
        observations = self.observations(selection)
        manifest, results, records = evaluate(inventory, selection, observations)
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            with self.assertRaisesRegex(ValueError, "outside the repository"):
                write_bundle(root / "evidence", manifest, results, records, root=root)


if __name__ == "__main__":
    unittest.main()
