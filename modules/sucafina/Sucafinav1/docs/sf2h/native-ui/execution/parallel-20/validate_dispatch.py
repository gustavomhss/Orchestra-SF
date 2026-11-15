#!/usr/bin/env python3
"""Fail-closed documentary dispatch validator for SF native UI.

Usage:
  python execution/parallel-20/validate_dispatch.py --root execution
  python execution/parallel-20/validate_dispatch.py --root execution --launch /path/to/observed-launch.json

Invoke ONLY through the existing GitHub Actions test-ci runner (`preflight-actions.node-smoke.mjs`), never locally.
This does NOT authorize an actor, validate product code, run CI by itself, or sign a source release.
"""
from __future__ import annotations

import argparse
import json
import re
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
    source = data["source"]
    ensure(source.get("branch") == "ux-20-dispatch" and source.get("pull_request") == 99, "normative source must identify PR99/ux-20-dispatch")
    launch_template = read(pack / "launch-record.template.json")
    ensure(launch_template.get("planning_sha") == source.get("commit") and launch_template.get("planning_branch") == source.get("branch"), "launch-record provenance differs from normative source")
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
    ensure("FASE A — PREFLIGHT SOMENTE LEITURA" in cards[0]["prompt"], "C00 must allow documentary read-only bootstrap without prior GO")
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
    ensure(any(x.get("id") == "UI32" and x.get("primaryOwner") == "U43" for x in surface["surfaces"]), "UI32 exact U43 owner")
    ensure("ui-grid" in locks["locks"], "monthly component lock missing")
    for rev, needle in (("R01","UX"),("R02","C03"),("R03","MCP")):
        ensure(needle in json.dumps(orders[rev].get("reviewScope", "") + " " + " ".join(orders[rev].get("reviewRequiredChecks", []))), f"{rev} missing independent original review scope")
        ensure(orders[rev].get("kind") == "independent-review", f"{rev} is not independent review order")
    ensure(all(c.get("role") == "writer" for c in cards[1:]), "writer role mislabeled")
    md = (pack / "PROMPTS.md").read_text(encoding="utf-8")
    for card in cards:
        ensure(f"## {card['seat']} —" in md and card["prompt"] in md, f"{card['seat']} copied prompt mismatch")
    ensure(data["source"]["canonical_commit"] == main["canonical"]["commit"], "canonical SHA drift")
    ensure("AUTHORITY_GATED" in data["status"], "dispatch cannot declare itself launched")

    launch_state = "NO_LAUNCH_RECORD"
    if launch:
        record = read(launch)
        required = ["material_sha", "material_tree", "planning_sha", "canonical_sha", "s0_authority", "integrator_71_ack", "current_integrator_ack", "current_integrator_authority", "current_integrator_lease", "integrator_mission", "integrator_identity", "integrator_branch", "current_s0_control_sha", "coordinator_actor", "coordinator_mode", "dispatcher_45_ack", "product_ci_101_ack", "compiler_45_ack", "leases", "source_family_blobs", "contract_blobs", "observed_actor_slots", "observed_runner_slots", "owner_releases"]
        missing = [k for k in required if k not in record or record[k] in (None, "", [], {})]
        if missing:
            failures.append(f"launch record lacks factual fields: {missing}")
        ensure(record.get("planning_sha") == data["source"]["commit"], "launch pin differs from design")
        ensure(record.get("canonical_sha") == main["canonical"]["commit"], "launch canonical differs")
        sha40 = lambda x: isinstance(x, str) and re.fullmatch(r"[0-9a-f]{40}", x) is not None
        for field in ("material_sha", "material_tree", "planning_sha", "canonical_sha"):
            ensure(sha40(record.get(field)), f"launch {field} must be full lowercase Git SHA")
        historical_integrator_refs = {
            record.get("integrator_71_ack"),
            "99d404ef15e12161b9043b3ac020bbb814d710dc",
            "384f9eb172f0e6761a2af1e92d8b4bb11d9b01df",
            "01efff55ee289cd897f912b9ae96c893b966e658",
            "a6abd2c8d321daf1089f4d440027c46209a89cbe",
            "d083b422b6a587f47873abde4d866e35017ff8b8",
            "eeff9b78219b5efe1ad78e68d4490af0d7c5ed07",
            "49dded7b4fa955ff2e0282f9ef2ffd59ddd277b3",
            "806278627986f808afe71f53408fe31b77752894",
        }
        ensure(record.get("current_integrator_ack") not in historical_integrator_refs, "current integrator ACK cannot reuse ended 71/100/105/106 authority")
        ensure(sha40(record.get("current_integrator_ack")), "current integrator ACK must be a full Git SHA")
        ensure(sha40(record.get("current_s0_control_sha")), "current S0 control pin must be a full Git SHA; verify live externally")
        mission = record.get("integrator_mission")
        ensure(type(mission) is int and mission > 106, "current integrator mission must supersede terminated 71/100/105/106")
        mode = record.get("coordinator_mode")
        ensure(mode in ("read-only", "shared-writer"), "coordinator mode must be read-only or shared-writer")
        if mode == "shared-writer":
            ensure(bool(record.get("coordinator_lease")) and
                   record.get("coordinator_actor") == record.get("integrator_identity") and
                   record.get("coordinator_lease") == record.get("current_integrator_lease"),
                   "C00 shared writer must match current integrator actor and lease")
        elif mode == "read-only":
            ensure(record.get("coordinator_lease") in (None, ""), "read-only C00 cannot claim a material writer lease")
        ensure(record.get("product_ci_101_ack") != record.get("compiler_45_ack"), "101 product CI and 45 compiler ACK must be distinct")
        ensure(record.get("product_ci_101_ack") != record.get("dispatcher_45_ack"), "historical dispatcher45 cannot authorize product CI101")
        ensure(record.get("current_integrator_lease") not in ("S0-C-e13-browser71", "S0-C-e14-browser100", "S0-C-e15-browser105", "S0-C-e16-browser106"), "current integrator lease cannot reuse ended 71/100/105/106 lease")
        previous = record.get("prior_integrator_terminals", {})
        if not isinstance(previous, dict):
            failures.append("prior_integrator_terminals must be an object")
        else:
            ensure(previous.get("100") == "a6abd2c8d321daf1089f4d440027c46209a89cbe", "terminal100 lineage missing or mismatched")
        for field in ("source_family_blobs", "contract_blobs"):
            mapping = record.get(field)
            if not isinstance(mapping, dict) or not mapping:
                failures.append(f"{field} must be nonempty path→Git blob SHA mapping")
            else:
                for path, sha in mapping.items():
                    try:
                        claim(path)
                    except (TypeError, ValueError) as exc:
                        failures.append(f"{field}: {exc}")
                    ensure(sha40(sha), f"{field}: invalid Git blob SHA for {path}")
        runners = record.get("observed_runner_slots")
        ensure(type(runners) is int and runners >= 0, "observed_runner_slots must be a nonnegative integer")
        active = record.get("leases", [])
        if not isinstance(active, list):
            failures.append("launch leases must be an array")
            active = []
        slots = record.get("observed_actor_slots")
        if type(slots) is not int or slots < 0:
            failures.append("observed_actor_slots must be a nonnegative integer")
            slots = 0
        ensure(all(isinstance(x, dict) and x.get("actor") and x.get("branch") and x.get("lease_id") and x.get("order_id") and x.get("owner_ack") for x in active), "lease missing observed facts or nonobject lease")
        ensure(len({x.get("lease_id") for x in active if isinstance(x, dict)}) == len(active), "duplicate/malformed lease IDs")
        ensure(len(active) <= min(19, slots), "leases exceed actual writer capacity")
        active_claims = []
        active_seats = []
        active_actors = []
        active_branches = []
        for lease in active:
            if not isinstance(lease, dict):
                continue
            order = lease.get("order_id")
            output = lease.get("output_id")
            matching = [card for card in cards[1:] if card["work_order_id"] == order and card.get("output_id") == output]
            ensure(len(matching) == 1, f"lease not a first-wave writer/output: {order}/{output}")
            allowed = matching[0]["owns_exact_or_prefix"] if len(matching) == 1 else []
            owned = lease.get("owned_paths")
            if not isinstance(owned, list) or not owned:
                failures.append(f"lease {order}/{output} requires nonempty owned_paths list")
                continue
            for path in owned:
                try:
                    claim(path)
                    ensure(any(path == x or x.endswith("/**") and (path == x[:-3] or path.startswith(x[:-3] + "/")) for x in allowed), f"lease {order}/{output} owns outside allowlist: {path}")
                    active_claims.append((order, path))
                except (TypeError, ValueError) as exc:
                    failures.append(f"lease {order}/{output}: {exc}")
            for field in ("base_sha", "tree_sha"):
                ensure(sha40(lease.get(field)), f"lease {order}/{output} invalid {field}")
            for field in ("current_preimages", "consumed_contract_blobs", "source_pins"):
                ensure(isinstance(lease.get(field), dict) and bool(lease.get(field)), f"lease {order}/{output} missing {field} map")
            active_seats.extend(x["seat"] for x in matching)
            active_actors.append(lease.get("actor"))
            active_branches.append(lease.get("branch"))
        ensure(len(set(active_seats)) == len(active_seats), "duplicate active writer seat")
        ensure(len(set(active_actors)) == len(active_actors), "duplicate active writer actor")
        ensure(len(set(active_branches)) == len(active_branches), "duplicate active writer branch")
        for i, (left_owner, left_path) in enumerate(active_claims):
            for right_owner, right_path in active_claims[i + 1:]:
                if left_owner != right_owner and intersects(left_path, right_path):
                    failures.append(f"active lease write collision {left_owner}:{left_path} <> {right_owner}:{right_path}")
        warnings.append("The validator cannot prove live S0 ref, integrator authority, owner releases or lease occupancy; verify all externally. No GO is issued.")
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
    try:
        raise SystemExit(validate(args.root.resolve(), args.launch.resolve() if args.launch else None))
    except (OSError, ValueError, TypeError, KeyError, AttributeError) as exc:
        print(json.dumps({"status": "DOCUMENTARY_DISPATCH_STRUCTURE_FAIL", "errors": [f"{type(exc).__name__}: {exc}"], "product_test_status": "NOT_RUN", "authorized_to_write_product": False}, indent=2, ensure_ascii=False))
        raise SystemExit(2)
