#!/usr/bin/env python3
"""Read immutable, MCP-exported plan files. No network or product execution."""
import argparse
import hashlib
import json
from pathlib import Path

PLANNING_SHA = "dbf9547211d9b0fade619790de7c19c0869b7c7d"
CAMPAIGN_SHA256 = "703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba"
COUNTS = {"work_packages": 15, "tasks": 74, "contracts": 17, "criteria": 1610}


def read_inventory(campaign_path, proof_map_path):
    raw = Path(campaign_path).read_bytes()
    actual = hashlib.sha256(raw).hexdigest()
    if actual != CAMPAIGN_SHA256:
        raise ValueError(f"campaign bytes differ from the immutable source: {actual}")
    campaign = json.loads(raw)
    proof_map = json.loads(Path(proof_map_path).read_bytes())
    entities = [(campaign, "")]
    tasks = []
    for wi, wp in enumerate(campaign["work_packages"]):
        entities.append((wp, f"/work_packages/{wi}"))
        for ti, task in enumerate(wp["tasks"]):
            pointer = f"/work_packages/{wi}/tasks/{ti}"
            entities.append((task, pointer))
            tasks.append({"id": task["id"], "wp": wp["id"], "pointer": pointer,
                          "title": task["title"], "owner": task["owner"],
                          "execution_actor": task.get("execution_actor"),
                          "outputs": task["outputs"], "depends_on": task["depends_on"],
                          "integrates_with": task.get("integrates_with", []),
                          "evidence_packages": task["evidence_packages"]})
    bindings = {row["criterion_id"]: row for row in proof_map["entries"]}
    if len(bindings) != len(proof_map["entries"]):
        raise ValueError("duplicate criterion in proof-map")
    criteria = []
    for entity, pointer in entities:
        groups = [(family, rows, f"{pointer}/axioms/{family}")
                  for family, rows in entity.get("axioms", {}).items()]
        groups.append(("check", entity.get("checks", []), f"{pointer}/checks"))
        for family, rows, base in groups:
            for index, row in enumerate(rows):
                binding = bindings.get(row["id"])
                if not binding or binding["expected"] != row["text"]:
                    raise ValueError(f"literal text mismatch: {row['id']}")
                if binding["entity_id"] != entity["id"] or binding["family"] != family:
                    raise ValueError(f"scope/family mismatch: {row['id']}")
                criteria.append({"id": row["id"], "text": row["text"],
                                 "entity_id": entity["id"], "family": family,
                                 "canonical_pointer": f"{base}/{index}",
                                 "text_sha256": hashlib.sha256(row["text"].encode()).hexdigest(),
                                 "proof_packages": binding["proof_packages"],
                                 "integrated_proofs": binding.get("integrated_proofs", [])})
    measured = {"work_packages": len(campaign["work_packages"]), "tasks": len(tasks),
                "contracts": len(campaign["contracts"]), "criteria": len(criteria)}
    if measured != COUNTS or len({row["id"] for row in criteria}) != COUNTS["criteria"]:
        raise ValueError(f"scope changed: {measured}")
    if {row["id"] for row in criteria} != set(bindings):
        raise ValueError("proof-map and campaign universes differ")
    return {"planning_sha": PLANNING_SHA, "campaign_sha256": actual, "counts": measured,
            "criteria": criteria, "tasks": tasks, "contracts": campaign["contracts"],
            "work_packages": [{"id": wp["id"], "title": wp["title"],
                               "tasks": [task["id"] for task in wp["tasks"]]}
                              for wp in campaign["work_packages"]]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--campaign", required=True, type=Path)
    parser.add_argument("--proof-map", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    inventory = read_inventory(args.campaign, args.proof_map)
    if args.output:
        args.output.write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"check": "CANONICAL_INVENTORY", "result": "PASS",
                      "counts": inventory["counts"], "campaign_sha256": inventory["campaign_sha256"],
                      "meaning": "Mechanical identity check only; no product proof."}, ensure_ascii=False))
