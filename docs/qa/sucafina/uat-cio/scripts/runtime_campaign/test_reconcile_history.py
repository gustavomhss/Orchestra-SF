import json
from pathlib import Path
import tempfile
import unittest

from runtime_campaign.prepare import (
    build_campaign,
    check_campaign,
    write_campaign,
)


class RuntimeCampaignTests(unittest.TestCase):
    def story(self, index: int, *, conditional: str | None = None) -> dict:
        return {
            "id": f"SF-UI{index:02d}-P01",
            "kind": "SURFACE_PRIMARY",
            "surface_ids": [f"UI{index:02d}"],
            "journeys": ["J01"],
            "priority": "P0" if index % 2 == 0 else "P1",
            "actor": f"ACTOR-{index % 7}",
            "title": f"Story {index}",
            "fixture": f"FIXTURE-{index % 11}",
            "preconditions": ["isolated installation"],
            "steps": ["open the original surface"],
            "expected": ["source reread matches"],
            "contraprovas": ["revocation leaves no mutation"],
            "status": "DESIGNED_NOT_EXECUTED",
            "conditional_release_feature": conditional,
            "evidence": ["source_reread", "receipt_or_no_commit"],
        }

    def inventory(self) -> dict[str, dict]:
        return {story["id"]: story for story in (self.story(i) for i in range(1, 95))}

    def selection(self, inventory: dict[str, dict]) -> dict:
        return {
            "schema": "sf-runtime-ready-selection-v1",
            "candidate_sha": "a" * 40,
            "candidate_tree_sha": "b" * 40,
            "installed_artifact_sha256": "c" * 64,
            "classification_source_ref": "audit/model-user-journeys@reviewed-01",
            "classification_source_sha256": "d" * 64,
            "stories": [
                {
                    "id": story_id,
                    "classification": "PATH_PRESENT_RUNTIME_REQUIRED",
                    "classification_evidence_ref": f"audit-classification/{story_id}",
                }
                for story_id in sorted(inventory)
            ],
        }

    def test_builds_exact_campaign_and_verifies_every_job(self) -> None:
        inventory = self.inventory()
        manifest, jobs = build_campaign(inventory, self.selection(inventory), max_parallel=8)
        self.assertEqual(manifest["story_count"], 94)
        self.assertEqual(len(jobs), 94)
        self.assertEqual(
            {story_id for wave in manifest["waves"] for story_id in wave},
            set(inventory),
        )
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root = base / "repo"
            root.mkdir()
            output = base / "private-campaign"
            write_campaign(output, manifest, jobs, root=root)
            verified = check_campaign(output)
            self.assertEqual(verified["campaign_id"], manifest["campaign_id"])
            self.assertEqual(verified["execution_status"], "NOT_RUN")

    def test_rejects_93_story_selection(self) -> None:
        inventory = self.inventory()
        selection = self.selection(inventory)
        selection["stories"].pop()
        with self.assertRaisesRegex(ValueError, "exactly 94"):
            build_campaign(inventory, selection)

    def test_rejects_conditional_capability_in_runtime_ready_queue(self) -> None:
        inventory = self.inventory()
        first = sorted(inventory)[0]
        inventory[first] = {**inventory[first], "conditional_release_feature": "DRAFT_ADMIN_SURFACE"}
        with self.assertRaisesRegex(ValueError, "conditional release feature"):
            build_campaign(inventory, self.selection(inventory))

    def test_rejects_duplicate_story(self) -> None:
        inventory = self.inventory()
        selection = self.selection(inventory)
        selection["stories"][-1] = dict(selection["stories"][0])
        with self.assertRaisesRegex(ValueError, "duplicates"):
            build_campaign(inventory, selection)

    def test_detects_job_tampering(self) -> None:
        inventory = self.inventory()
        manifest, jobs = build_campaign(inventory, self.selection(inventory))
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root = base / "repo"
            root.mkdir()
            output = base / "private-campaign"
            write_campaign(output, manifest, jobs, root=root)
            story_id = sorted(inventory)[0]
            job_path = output / "jobs" / f"{story_id}.json"
            job = json.loads(job_path.read_text(encoding="utf-8"))
            job["source_story"]["title"] = "tampered"
            job_path.write_text(json.dumps(job), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "digest mismatch"):
                check_campaign(output)

    def test_refuses_to_store_campaign_inside_repository(self) -> None:
        inventory = self.inventory()
        manifest, jobs = build_campaign(inventory, self.selection(inventory))
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "repo"
            root.mkdir()
            with self.assertRaisesRegex(ValueError, "outside the repository"):
                write_campaign(root / "evidence", manifest, jobs, root=root)


if __name__ == "__main__":
    unittest.main()
