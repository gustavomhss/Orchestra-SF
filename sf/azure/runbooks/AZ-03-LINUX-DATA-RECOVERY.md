# A7 / AZ-03 — Linux persistence, backup, restore and rollback

> **SUPERSEDED FOR REAL CI FACTORY DEPLOYMENT (A7 2026-11-16):** This document is retained for W0/W1 provenance only. The CI-produced factory is `orchestra-distribution-v1`, with `bin/local/entry.mjs` and `bin/web`, NOT the earlier experimental `bundle.py`/`deploy.py` contract. **Do not run any deployment commands from this older document.** Use [`A7-REAL-FACTORY-MI-DEPLOY.md`](./A7-REAL-FACTORY-MI-DEPLOY.md) and its explicitly staged scripts. Nothing has been executed in Azure by A7.


**2026-11-16, W0/W1: PLANNED / NOT_RUN / BLOCKED_BY_ENV + BLOCKED_BY_OWNER.** No Azure VM, attached volume, Vault job or application DB has been observed by this agent. This document is an execution runbook, NOT a successful restore report or instruction to overwrite production.

## Source-specific model (read-only findings)

- Foundation source azure-hardening@22d8da9948810562deed2b051d4903d80d6f2370: infra/azure/main.bicep defines Azure Linux VM, attached StandardSSD_LRS data disk LUN 0, deleteOption Detach, size 64 GiB by default; bootstrap.sh refuses unfamiliar ext4/disk identities, mounts canonical LUN at /var/lib/orchestra-sf with label orchsf-data, home at /var/lib/orchestra-sf/home, account orchestra-sf. Caddy remains 503 until separate app activation. The template defines Recovery Services vault orchsf-vault, policy orchsf-daily, 35 daily recovery points configured in UTC with locally redundant storage. These are template INTENT, **not observed Azure state**.
- apps/web/README.md: browser is served from built Web files by CLI. packages/core/src/database/README.md: core SQLite defaults to orchestra.db under XDG data path or ORCHESTRA_DB; migration order/identity must not be changed. modules/sucafina/Sucafinav1/runtime/local-store.ts: a local SF installation has installation.sqlite in a canonical private 0700 directory owned by current UID with 0600 file; uses WAL and FULL synchronous. Determine whether/how the actual Azure SF installation uses that store; do not assume every local/macOS workflow is deployed.
- modules/sucafina/Sucafinav1/test/parity-pitr.test.ts is local-operator Litestream/macOS evidence, NOT a successful Linux Azure restore. Preserve the original; A9 owns integrated proof, A8 owns identity/host and A10 owns release workflow. This document adds Linux-specific acceptance rather than disabling tests.

## Input/authority/STOP

Dono Azure provides authorized VM/RG/subscription, actual Deployment outputs (vmName, dataDiskId, backupVaultName, protectedItemName), vault container name returned by Azure, recovery point ID, permissions to exercise backup and **isolated** restore, recovery location and approved retention/RPO/RTO. A10 provides exact C/tree, immutable artifacts, previous artifact, schema compatibility matrix and release approval. A8 supplies owner/prod-auth revalidation contracts. No credentials or actor evidence in Git.

STOP / BLOCKED if: Azure access missing, no Linux X64 host, failed canonical LUN mount, UID/GID mismatch, absent or unidentified DB, startup/migrations not proven, no successful Backup job+recoverypoint, no isolated restore target, or permission to restore lacking. No forced unmount, disk reformat, SQLite file-copy while active, blind chown, reset database, downgrade schema, or restore-over-live.

## Procedure W4, future ONLY — no commands below were run

### 0. Identify scope and reversible migration boundary

For each data-bearing component, record owner, path, UID/GID, migration version, durability boundary and producer: core orchestra.db (+ WAL), SF installation.sqlite (+ WAL) **if active**, private native files, uploaded assets, session/receipt/cas/source revision, installer/factory, XDG data, credentials (secrets restored separately through authorized vault; not exposed). Verify that every durable path resolves to /var/lib/orchestra-sf on the intended device; reject symlinks and unexpected external mounts. Identify any remote authoritative data/CTRM, which must NOT be restored as if local. Require A8 to confirm session revocation and credential rotation policies after restore.

Read-only inspection on VM:

~~~bash
set -euo pipefail
test "$(uname -s)" = Linux && test "$(uname -m)" = x86_64
test ! -L /var/lib/orchestra-sf && test -d /var/lib/orchestra-sf
test "$(findmnt -nr -o TARGET --target /var/lib/orchestra-sf)" = /var/lib/orchestra-sf
lun=$(readlink -f /dev/disk/azure/scsi1/lun0)
test -b "$lun"
src=$(findmnt -nr -o SOURCE --target /var/lib/orchestra-sf)
test "$(readlink -f "$src")" = "$lun"
findmnt --mountpoint /var/lib/orchestra-sf -o SOURCE,TARGET,FSTYPE,OPTIONS
lsblk -f
getent passwd orchestra-sf; getent group orchestra-sf
stat -c '%u:%g %a %F %n' /var/lib/orchestra-sf /var/lib/orchestra-sf/home
~~~

Compare discovered UID/GID and actual dataDiskId with the **private identity receipt** from foundation. Do not use recursive chown to make wrong data appear valid. Before any migration, take a recoverable checkpoint and test rollback compatibility on a clone. A failed migration must leave the service closed/release RED, not advance to smoke.

### 1. Normal restart + idempotence under committed business data

Under A8-approved, non-sensitive test actor, record a unique business revision/CAS stamp and source revision before restart. Stop admission of new writes; gracefully drain Task/Relay, check pending jobs, and stop systemd unit without SIGKILL. **Do not assume a successful exit proves transaction durability.** Inspect core DB path using CLI db path with the service's HOME/XDG and approved executable; inspect actual SF store configuration, without logging secrets. Confirm all writable files are on canonical durable volume, not /tmp.

Restart exactly the installed C and same factory, verify unit active, Web+host from C, HTTPS/auth binding and new read of SAME revision/stamp/owner/project, then perform a new authorized mutation and confirm CAS/conflict negative 409/422 when contract applies. Repeat restart/migration-startup to prove idempotence and unchanged last committed version (no unexpected schema churn). Record case IDs, before/after stamps, exit codes, timestamps and hashes, not row contents or identities.

### 2. Application-consistent backup + Azure evidence

Before a checkpoint, obtain owner-defined maintenance window or quiesce protocol: block new writes, drain service, allow outstanding jobs to finish, stop app cleanly or use the supported SQLite online backup API. For SQLite WAL, **never** treat copying only orchestra.db or installation.sqlite from a live process as an application-consistent backup; include WAL/SHM only via a supported consistent process, or stop app. If service stop is chosen, confirm DB quiescent and only then trigger verified Azure IaaS VM backup (and/or approved app-consistent snapshot); do not claim all Vault snapshots are application-consistent. For file-level backups, root-owned restricted archive, complete manifest, SHA256, provenance and encrypted storage required; no raw DB to Actions artifacts.

Azure control-plane read-only lookup (operator fills exact values; container is discovered, never constructed by hand):

~~~bash
set -euo pipefail
test -n "$AZURE_RESOURCE_GROUP" && test -n "$SF_BACKUP_VAULT"
az backup container list --resource-group "$AZURE_RESOURCE_GROUP" --vault-name "$SF_BACKUP_VAULT" --backup-management-type AzureIaasVM --query "[].{name:name,friendlyName:properties.friendlyName}" -o table
# Owner selects EXACT container-name from previous output, protected item from deployment.
test -n "$SF_CONTAINER_NAME" && test -n "$SF_PROTECTED_ITEM"
az backup item show --resource-group "$AZURE_RESOURCE_GROUP" --vault-name "$SF_BACKUP_VAULT" --backup-management-type AzureIaasVM --container-name "$SF_CONTAINER_NAME" --name "$SF_PROTECTED_ITEM" --query properties.protectionState -o tsv
az backup job list --resource-group "$AZURE_RESOURCE_GROUP" --vault-name "$SF_BACKUP_VAULT" --query "[].{id:name,operation:properties.operation,status:properties.status,vm:properties.entityFriendlyName}" -o table
az backup recoverypoint list --resource-group "$AZURE_RESOURCE_GROUP" --vault-name "$SF_BACKUP_VAULT" --backup-management-type AzureIaasVM --container-name "$SF_CONTAINER_NAME" --item-name "$SF_PROTECTED_ITEM" --query "[].{id:name,time:properties.recoveryPointTime}" -o table
~~~

Acceptance requires **actual** Backup operation, status Completed, matching vmName, verified item/point, immutable backup/time/digest, and consistency indication; a completed ConfigureBackup is NOT a backup and Vault policy presence is NOT recovery. Recovery point older than latest committed test stamp does not prove the target RPO. Record retention policy actually applied versus planned 35 days; LRS is not cross-region DR. Measure RPO/RTO rather than guessing.

### 3. Restore drill in isolation: never over production

Dono pre-creates an isolated test VM and disk/network, authorized vault Restore operation, no public DNS/cookies/identity reuse, no live webhook/CTRM side effects. Prefer full VM restore preserving OS/account and disk UID/GID; alternatively do disk-only read-only validation according to the historical infra/azure/README.md restoration procedure. For disk-only restore, require canonical LUN identity, verified owners from receipt, mount read-only in root 0700 parent, no other writable mounts, no symlink, and no forced/unexpected chown. Never attach restored disk writable to two VMs.

Pre-restore create unique non-sensitive data markers/stamps and digest receipt. Restore the selected recovery point to the **isolated target only** using owner-authorized Azure operation; verify operation Completed and matching source/point/destination in Azure jobs. Record whether backup preceded or followed marker, so expected presence/absence is auditable. Keep isolated network egress fenced until producers/credentials are disabled or replay-safe; restore can revive stale tokens, scheduled tasks and approved capabilities, so A8 must re-authorize.

On cloned private state, with app stopped, confirm file provenance, owner/mode, paths, SQLite integrity using the **appropriate driver** and migration version, checksums/recovery-point identity, CAS/source revision/sequence, and that 0700/0600 private areas remain private. Then bring up **the same C** in the isolated environment using the real installed host; check read of expected committed marker, expected absence of later marker, authorized mutate/read + explicit stale-CAS denial; restart and repeat. Require A9 to tie restoration to installed F04/AM evidence, not replace it. Clean up isolated target only on documented approval, retaining restricted evidence.

### 4. Recovery and rollback during a failed release

Rollback **code only** to previous immutably identified version when old binary is proven compatible with actual migrated schema and installation factory. Preserve the data volume and audit trail; do not silently roll back state just to make tests green. For incompatible migrations, stop admission, freeze writes, get owner-approved point-in-time **isolated** restore, validate integrity and authoritative source revisions, then coordinate a controlled cutover. Explicitly track and reconcile writes made after the recovery point; define accepted data loss with owner before production restoration. Disallow automatic deletion/recreation of an installation, resetting tokens/permission, or reusing revoked authority.

Failure injection (separate approved staging/isolated VM): application crash during write, restart after migration interruption, backup job failure, partial restore/incorrect disk ID, missing Vault point, restored invalid CAS, schema incompatibility. For each expect **fail-closed** service/release, observable recovery, no unauthorized writes, no silently skipped evidence. Measure recovery duration and compare to owner-approved RTO. A10 controls release gate and protected environment; A7 never edits .github/workflows/sf-release.yml or sf/release-target.json.

## Evidence & DoD

For each rehearsal record C/head/tree SHA, Linux kernel/arch, VM identity (private), disk ID and UUID, filesystem/mount, user/group, installed binary/Web/Omni digest, database/schema/migration versions, backup vault/container/item and Backup job ID/conclusion, recovery point/time, restore job ID/conclusion, immutable file digest/integrity results, before/after business stamps (sanitized), CAS negative, exit codes, service restart, injected failure and outcome, measured RPO/RTO, 35-day retention verification, independent reviewer, approval timestamp. Secrets/PII/DB bytes never in Git/Actions.

AZ-03 PASS only with observed successful **Linux** storage persistence across restart/migrations, real application-consistent backup, successful isolated restore, controlled rollback with intact revisions/authorization and negative failures, all against same frozen C. Until then AZ-03=BLOCKED_BY_ENV/OWNER, NOT_RUN; local Litestream parity does not count.
