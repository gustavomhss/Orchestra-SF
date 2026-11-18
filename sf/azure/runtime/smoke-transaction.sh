#!/usr/bin/env bash
# A7/A9 release-only: execute REAL original-producer mutations in the installed,
# Microsoft-authenticated browser. Never creates actors, auth or a fake host.
set -euo pipefail
fail() { printf '%s\n' "F04_A7_TRANSACTION_REFUSED: $*" >&2; exit 1; }
[[ "${GITHUB_ACTIONS:-}" == true && "${RUNNER_OS:-}" == Linux && "${RUNNER_ARCH:-}" == X64 ]] ||
  fail "must run on genuine protected GitHub Actions Linux/X64 runner"
[[ "$(uname -s)" == Linux && "$(uname -m)" == x86_64 ]] || fail "Linux x86_64 required"
[[ "${SF_NATIVE_CANDIDATE_SHA:-}" =~ ^[0-9a-f]{40}$ ]] || fail "frozen C required"
[[ "$(git rev-parse HEAD)" == "$SF_NATIVE_CANDIDATE_SHA" ]] || fail "checkout is not the installed C"
[[ -f "${SF_NATIVE_INSTALLED_MANIFEST:-}" ]] || fail "real installed manifest missing"
[[ -d "${SF_A7_PROOF_DIR:-}" ]] || fail "owner-owned private results directory required"
[[ -f "${SF_A7_TRANSACTION_APPROVAL:-}" ]] || fail "explicit owner transaction approval missing"
command -v bun >/dev/null || fail "Bun tooling absent (no synthetic browser)"
python3 - "$SF_NATIVE_INSTALLED_MANIFEST" "$SF_NATIVE_CANDIDATE_SHA" "$SF_A7_PROOF_DIR" "$SF_A7_TRANSACTION_APPROVAL" <<'PY'
import json, os, pathlib, re, stat, sys
manifest, candidate, proof, approval = map(pathlib.Path, [sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]])
uid = os.getuid()
for file in (manifest, approval):
    info = file.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != uid or info.st_mode & 0o077 or file.is_symlink():
        raise SystemExit("F04_PRIVATE_ORIGIN_OR_OWNER_REQUIRED")
for directory in (proof, manifest.parent):
    info = directory.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != uid or info.st_mode & 0o077 or directory.is_symlink():
        raise SystemExit("F04_PRIVATE_PARENT_REQUIRED")
m = json.loads(manifest.read_text())
a = json.loads(approval.read_text())
if m.get("schema") != "sf2h.native-installed-manifest.v1" or m.get("candidateSha") != str(candidate):
    raise SystemExit("F04_TARGET_NOT_BOUND_TO_C")
if a.get("schema") != "orchestra-sf.azure-transaction-approval.v1" or a.get("candidateSha") != str(candidate) or a.get("action") != "RUN_REAL_PRODUCER_MUTATION" or not a.get("approver"):
    raise SystemExit("F04_TRANSACTION_NOT_AUTHORIZED_BY_OWNER")
if not isinstance(m.get("target"), dict) or not m["target"].get("publicOrigin","").startswith("https://"):
    raise SystemExit("F04_NOT_HTTPS_INSTALLED")
if len(set(m.get("actors", {}).values())) != len(m.get("actors", {})) or not {"requester","holder","denied"} <= set(m.get("actors", {})):
    raise SystemExit("F04_AUTHORIZED_ACTORS_MISSING")
print("F04_REAL_ACTOR_ORIGIN_AND_C_INPUTS_VALIDATED_NOT_YET_EXECUTED")
PY
# The current producer owns *every* mutation. Tests explicitly assert user UI
# creates, reviews, edits/deletes, re-reads and uses source-native CAS.
# --reporter=json sends raw potentially sensitive traces ONLY to the private
# protected runner disk. Do not upload these files to public GitHub artifacts.
cd packages/app-shell
for suite in u39 u40; do
  spec="e2e/sucafina/native/journeys/${suite}.spec.ts"
  [[ -f "$spec" ]] || fail "real producer spec absent"
  receipt="$SF_A7_PROOF_DIR/${suite}-transaction.json"
  [[ ! -e "$receipt" ]] || fail "refusing to overwrite transaction receipt"
  umask 077
  bun run test:e2e:local "$spec" --config e2e/playwright.production.config.ts \
    --workers 1 --retries 0 --grep '206-AC01 (create/edit/delete producer owner CAS|monthly entry create/edit)' \
    --reporter=json > "$receipt"
  python3 - "$receipt" "$suite" <<'PY'
import json, pathlib, sys
r, suite = pathlib.Path(sys.argv[1]), sys.argv[2]
report = json.loads(r.read_text())
items = []
def visit(node):
    for spec in node.get("specs", []):
        for test in spec.get("tests", []):
            items.append((spec.get("title",""), test))
    for sub in node.get("suites", []):
        visit(sub)
for s in report.get("suites", []):
    visit(s)
prefixes = (
    "206-AC01 create/edit/delete producer owner CAS",
    "206-AC01 monthly entry create/edit",
)
for prefix in prefixes:
    if not any(title.startswith(prefix) for title, _ in items):
        raise SystemExit("F04_TRANSACTION_CASE_OMITTED: " + suite)
if not items or len(items) < 2 or any(
    t.get("status") != "expected" or t.get("expectedStatus") != "passed" or
    len(t.get("results", [])) != 1 or t["results"][0].get("status") != "passed"
    for _, t in items
):
    raise SystemExit("F04_TRANSACTION_REPORT_NOT_ALL_PASSED: " + suite)
stats = report.get("stats", {})
if stats.get("unexpected", 0) != 0 or stats.get("skipped", 0) != 0 or stats.get("expected", 0) != len(items):
    raise SystemExit("F04_TRANSACTION_COUNTS_INVALID: " + suite)
print(f"F04_{suite.upper()}_ORIGINAL_PRODUCER_CASES_PASSED={len(items)} (private receipt retained)")
PY
done
printf '%s\n' 'A7_REAL_TRANSACTION_SMOKE_PASS_ONLY; AZ-03/F04-AM01-06/AZURE_RELEASE_QUALIFIED_REMAIN_SEPARATE'
