#!/usr/bin/env python3
"""Fail-closed documentary dispatch validator for SF native UI.

Usage:
  python execution/parallel-20/validate_dispatch.py --root execution
  python execution/parallel-20/validate_dispatch.py --root execution --launch /path/to/observed-launch.json

This does NOT authorize an actor, validate product code, run CI, or sign a source release.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path, PurePosixPath

def read(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))

def claim(raw: str):
    if not isinstance(raw, str) or not raw or raw.startswith("/") or "\\" in raw:
        raise ValueError(f"unsafe path: {raw}")
    wild = raw.endswith("/**")
    base = raw[:-3] if wild else raw
    p = PurePosixPath(base)
    if ".." in p.parts or "." in p.parts or "//" in base or "*" in base or str(p) != base:
        raise ValueError(f"unsafe path: {raw}")
    return (base, wild)

def intersects(a, b):
    x, xprefix = claim(a)
    y, yprefix = claim(b)
    return x == y or (xprefix and y.startswith(x + "/")) or (yprefix and x.startswith(y + "/"))

def validate(root: Path, launch: Path | None):
    failures = []
    warnings = []
    def ensure(ok, message):
        if not ok:
            failures.append(message)

    pack = root / "parallel-20"
    data = read(pack / "dispatch.json")
    main = read(root / "manifest.json")
    catalog = read(root / "contract-catalog.json")
    surface = read(root / "surface-manifest.json")
    locks = read(root / "component-locks.json")
    orders = {}
    for o in main["work_orders"]:
        path = root / o["path"]
        ensure(path.is_file(), f"missing order {o['id']}: {path}")
        if path.is_file():
            value = read(path)
            ensure(value.get("id") == o["id"], f"wrong order ID {o['id']}")
            orders[o["id"]] = value
    ensure(len(main["work_orders"]) == len(orders) == 78, "require exactly 78 original orders")
    ensure(len(catalog["operations"]) == 305, "305 catalog operations")
    ensure(len(surface["surfaces"]) == 70, "70 surfaces")
    ensure(len({s["id"] for s in surface["surfaces"]}) == 70, "surface IDs unique")
    ensure(main["canonical"]["retained_criteria"] == data["constraints"]["canonical_criteria"] == 1610, "1,610 source criteria retained")
    ensure(main["canonical"]["retained_tasks"] == 74 and main["canonical"]["retained_work_packages"] == 15, "74 tasks/15 work packages retained")
    cards = data["cards"]
    ensure(len(cards) == 20, "C00 + W01..W19 exactly")
    ensure([c["seat"] for c in cards] == ["C00"] + [f"W{i:02d}" for i in range(1, 20)], "seat identity/order")
    ensure(cards[0]["work_order_id"] == "I00" and cards[0]["role"] == "supervisor-integrator", "C00 sole I00")
    ensure(all(c["status"] == "WAITING_SOURCE_AND_OWNER_PREFLIGHT" for c in cards), "cannot pre-authorize any worker")
    seen = {}
    for card in cards:
        who = card["seat"]
        wid = card["work_order_id"]
        ensure(wid in orders, f"{who} missing work order {wid}")
        if wid not in orders:
            continue
        w = orders[wid]
        part = next((x for x in w.get("incremental_outputs", []) if x["id"] == card.get("output_id")), None)
        ensure(not card.get("output_id") or part is not None, f"{who} missing partial output")
        expected = part.get("owns", w["owns"]) if part else w["owns"]
        ensure(card.get("owns_exact_or_prefix") == expected, f"{who} stale allowlist")
        ensure(card.get("authoring_locks") == [x["lock"] for x in w["depends_authoring"]], f"{who} stale contract locks")
        ensure(card.get("depend_on_real_integration") == (part.get("depends_integration", w["depends_integration"]) if part else w["depends_integration"]), f"{who} stale integration prerequisites")
        ensure(card.get("normative_design_commit") == data["source"]["commit"], f"{who} drifted design pin")
        ensure(card.get("mission_file") == str(root / "work-orders" / f"{wid}.json") or card.get("mission_file", "").endswith(f"/execution/work-orders/{wid}.json"), f"{who} invalid mission source")
        ensure("BLOCKED_AUTHORIZATION" in card.get("prompt", ""), f"{who} missing no-GO stop")
        for p in card.get("owns_exact_or_prefix", []):
            try:
                claim(p)
                seen.setdefault(who, []).append(p)
            except ValueError as exc:
                failures.append(str(exc))
        if part:
            ensure(all(any(x == ow or ow.endswith("/**") and (x == ow[:-3] or x.startswith(ow[:-3] + "/")) for ow in w["owns"]) for x in part["owns"]), f"{who} partial owns outside parent")
    for i, left in enumerate(cards):
        for right in cards[i + 1:]:
            for a in seen.get(left["seat"], []):
                for b in seen.get(right["seat"], []):
                    if intersects(a, b):
                        failures.append(f"overlapping writers {left['seat']}:{a} <-> {right['seat']}:{b}")
    first = data["first_wave_order_ids"]
    rest = data["remaining_work_order_ids"]
    all_assignments = first + rest
    ensure(len(first) == 19 and len(rest) == 58 and len(set(all_assignments)) == 77, "nineteen authors and 58 pending without omission")
    ensure(set(all_assignments) == set(orders) - {"I00"}, "remaining/backlog must cover every non-I00 order")
    ensure(first == [c["work_order_id"] for c in cards[1:]], "first wave cards must match exact order list")
    ensure(len({c.get("output_id") or c["work_order_id"] for c in cards}) == 20, "all 20 outputs distinct")
    ensure([x["id"] for x in main["pilot"]["phases"]] == ["P0", "P1"], "pilot P0 must precede P1")
    ensure(set(main["pilot"]["incremental_outputs"]) == {"U10.queue", "U11.title-save", "U13.pr-approval", "Q01.pilot", "Q02.pilot"}, "no skipped or fake pilot output")
    ensure(any(c.get("output_id") == "U11.title-save" for c in cards), "missing P0 author")
    ensure(any(c.get("output_id") == "U13.pr-approval" for c in cards), "missing P1 author")
    ensure(surface["surfaces"] and next(s for s in surface["surfaces"] if s["id"] == "UI32")["primaryOwner"] == "U43", "UI32 exact U43 owner")
    ensure("ui-grid" in locks["locks"], "monthly component lock missing")
    for rev, needle in (("R01","UX"),("R02","C03"),("R03","MCP")):
        ensure(needle in json.dumps(orders[rev].get("reviewScope", "") + " " + " ".join(orders[rev].get("reviewRequiredChecks", []))), f"{rev} missing independent original review scope")
        ensure(orders[rev].get("kind") == "review", f"{rev} is not independent review order")
    ensure(all(c.get("role") == "writer" for c in cards[1:]), "writer role mislabeled")
    md = (pack / "PROMPTS.md").read_text(encoding="utf-8")
    for card in cards:
        ensure(f"## {card['seat']} —" in md and card["prompt"] in md, f"{card['seat']} copied prompt mismatch")
    ensure(data["source"]["canonical_commit"] == main["canonical"]["commit"], "canonical SHA drift")
    ensure("AUTHORITY_GATED" in data["status"], "dispatch cannot declare itself launched")

    launch_state = "NO_LAUNCH_RECORD"
    if launch:
        record = read(launch)
        required = ["material_sha", "material_tree", "planning_sha", "canonical_sha", "s0_authority", "integrator_71_ack", "dispatcher_45_ack", "leases", "source_family_blobs", "contract_blobs", "observed_actor_slots", "observed_runner_slots", "owner_releases"]
        missing = [k for k in required if k not in record or record[k] in (None, "", [], {})]
        if missing:
            failures.append(f"launch record lacks factual fields: {missing}")
        ensure(record.get("planning_sha") == data["source"]["commit"], "launch pin differs from design")
        ensure(record.get("canonical_sha") == main["canonical"]["commit"], "launch canonical differs")
        active = record.get("leases", [])
        ensure(all(x.get("actor") and x.get("branch") and x.get("lease_id") and x.get("order_id") and x.get("owner_ack") for x in active if isinstance(x, dict)), "lease missing observed facts")
        ensure(len(active) <= min(19, record.get("observed_actor_slots", 0)), "leases exceed actual writer capacity")
        warnings.append("The validator cannot cryptographically prove S0/71/45 authority, release status, current material SHA, active leases or CI; verify externally. No GO is issued.")
        launch_state = "FORMAT_CHECK_ONLY_NOT_AUTHORIZATION"
    else:
        warnings.append("No actual material C, external ACKs/leases, runners or live producer releases were supplied; execution is NOT authorized.")
    warnings.append("Documentation only. Does NOT run official validate_plan.py --strict, typecheck, tests, CI, Microsoft live or product gates.")
    report = {"status":"DOCUMENTARY_DISPATCH_STRUCTURE_PASS" if not failures else "DOCUMENTARY_DISPATCH_STRUCTURE_FAIL","launch":launch_state,"work_orders":len(orders),"first_wave_lanes":len(cards),"remaining_orders":len(rest),"operations":len(catalog["operations"]),"surfaces":len(surface["surfaces"]),"errors":failures,"warnings":warnings,"product_test_status":"NOT_RUN","authorized_to_write_product":False}
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if not failures else 1

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--launch", type=Path)
    args = parser.parse_args()
    raise SystemExit(validate(args.root.resolve(), args.launch.resolve() if args.launch else None))
