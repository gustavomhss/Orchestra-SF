# A7 W0/W1 handoff — AZ-01 and AZ-03

> **SUPERSEDED FOR REAL CI FACTORY DEPLOYMENT (A7 2026-11-16):** This document is retained for W0/W1 provenance only. The CI-produced factory is `orchestra-distribution-v1`, with `bin/local/entry.mjs` and `bin/web`, NOT the earlier experimental `bundle.py`/`deploy.py` contract. **Do not run any deployment commands from this older document.** Use [`A7-REAL-FACTORY-MI-DEPLOY.md`](./A7-REAL-FACTORY-MI-DEPLOY.md) and its explicitly staged scripts. Nothing has been executed in Azure by A7.


Date: 2026-11-16. Branch: sfa-vm. Owner: Agent A7. Stage: W0/W1 **documentation only**. This record is not a deployment attestation.

## W0 source checks done over GitHub MCP (READ ONLY)

1. Read validation/final-bundle/dispatch-agent.md, then validation/final-bundle/gpt-plan-001-brief.md, then sf/ci/GPT-PLAN-10.md §Agente A7 in sfa-vm.
2. Read sf/ci/PENDING-WORK.md §6, sf/release-target.json, .github/workflows/sf-release.yml, sf/ci/README.md, apps/web/README.md + package.json, apps/cli/src/commands/{commands.ts,handlers/serve.ts}, apps/cli/src/sucafina-product/installation.ts, packages/core/src/database/README.md, modules/sucafina/Sucafinav1/{runtime/local-store.ts,test/parity-pitr.test.ts} at sfa-vm.
3. Read infra/azure/{README.md,main.bicep,bootstrap.sh} at historical azure-hardening@22d8da9948810562deed2b051d4903d80d6f2370; verified infra/azure is **not** present on sfa-vm; never promoted this historical foundation as an installed app.
4. Verified sf/release-target.json activation.status=BLOCKED and sf-release.yml still intentionally refuses deployment. No edits to either (A10 owner).
5. Verified the selected app target is Linux x64 Web+host over HTTPS; not desktop, Windows/Mac installers or merely a Vite preview.

## W1 deliverables under exclusive A7 lease

- sf/azure/runbooks/AZ-01-VM-HTTPS-ACTIVATION.md: prerequisite freeze C, artifact and HTTPS/host service boundary, non-root systemd/Caddy proposed interfaces, restart/negative checks, rollout/rollback failure criteria.
- sf/azure/runbooks/AZ-03-LINUX-DATA-RECOVERY.md: Azure disk identity, core vs SF store, WAL/migration safety, backups and Vault job+recovery point, **isolated** restore, revision/CAS validation, retention and rollback failure drills.
- This handoff ledger with real blockers and exact responsibility; does not claim successful Azure actions.

## Explicit blocking decisions and owners

| Item | Status now | Missing environment/source/permission and owner | Unblock evidence |
|---|---|---|---|
| AZ-01 app Linux x64 | BLOCKED_BY_ENV | **Dono Azure**: actual VM access, RG/subscription, DNS/TLS and attested foundation | commands on actual VM + cloud-init, mount, service, HTTPS logs |
| AZ-01 artifact/host | BLOCKED_BY_SOURCE + BLOCKED_BY_OWNER | **A10/A6 + dono**: frozen C/tree, native Linux package and Web digest, verified trusted factory/entrypoint; **A8**: Entra/origin | same-C immutable artifact installed, running process and bytes served, A8 auth + business smoke |
| AZ-01 protected release | BLOCKED_BY_OWNER | **A10 + dono**: protected environment and activation decision; workflow remains BLOCKED | authorized real release job and reversible switch |
| AZ-03 persistence/migrations | BLOCKED_BY_ENV | **Dono Azure + A7**: actual durable mount, paths, UID/GID, app storage, migration versions | committed revision survives stop/restart and idempotent migration |
| AZ-03 backup/restore | BLOCKED_BY_ENV + BLOCKED_BY_OWNER | **Dono Azure**: vault backup/recovery point, isolated restore VM and permission, approval; **A8**: auth/authority on clone; **A9**: proof integration | Backup and Restore jobs Completed for matching IDs, integrity + source stamps, authorized transaction, fail-closed drills |
| F04 / AM01–06 | BLOCKED_BY_ENV (outside A7) | **A9** after A5/A7/A8/A10 | installed-host manifest, actor/witness, suite results same frozen C |

## Guardrails and next boundary

No Azure shell, az command, Caddy reload, database backup, restore, migration, cloud build, F04 test or real restart has been executed by A7. These are blocked, not PASS, and sf-ci PR results cannot qualify Azure. No protected path was touched; no edit to installation.ts, host-context.ts, sf-release.yml, sf/release-target.json, sf/ci/PENDING-WORK.md or the macOS local parity test. No waiver, guard bypass, token/cookie or fake auth. No merge into close-final-candidate.

W4 begins ONLY after A10 freezes C with PRODUCT_CI_GREEN, Azure owner provides and authorizes real environment, A8 validates Microsoft host/origin and A7 has safe backup/recovery. If any missing, STOP; do not infer AZURE_RELEASE_QUALIFIED from sf/verify.
