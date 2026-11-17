# SF Azure — Supreme Admin Access Surface (release-blocking)

**Status:** implementation proposed in `sfa-admin-surface`; **not verified on the Azure VM**. Design and code are tied to the reviewed base `close-final-candidate@42d344a0efc4d85187388f149c54acac2db171da`. This document is not an attestation or a substitute for real CI and Entra execution.

## 1. Route, authority and actor model

- New **installation-owned HTML admin chapter**, not a forged addition to the native 70-surface frozen manifest: **`GET|HEAD|POST /sucafina/admin/access`**. No other HTTP API or Graph-write endpoint is introduced.
- The link `data-sf-admin-link` is injected into the existing `/sucafina/{dashboard|planner|procurement}` chrome **only after** server-side `identity.authenticate` invokes a fresh `/me/checkMemberGroups` with the pinned supreme group. The admin route itself repeats this gate (link visibility is never treated as authorization).
- **`fla-supreme-admin` / `a739232b-d5cb-4f41-873b-4c9d2340831e`** is fixed by installed code, not HTTP, Entra display names or login claims. **Daniel and André** are the owner's designated members. Entra group membership is externally administered; this workbench has no capability to add/remove a member. If a third party joins that Entra group, they gain supreme access by the stated group-based rule; owner must protect its membership.
- Zico (no group), Caio (requester/contributor) and Pedro (buyer) must have **no link** and receive **403** on GET and POST; signed-in user with a regular per-surface `admin` role is **not** automatically a supreme administrator.
- Session origin, CSRF/origin fence, Entra tenant binding, confidential client, cookie revocation and server-owned request are preserved. No delegated bearer token enters browser HTML, client JSON or audit.

## 2. Live organization tree, never manually registered

The view is generated from a **complete, server-fetched** Microsoft Graph directory snapshot:
1. `GET /v1.0/users?$select=id,displayName,department,jobTitle&$top=999` (all pages): stable **user object ID** as key, names, titles, departments.
2. `GET /v1.0/users/{id}/manager?$select=id`: manager object ID; Graph's 404 is an absent manager, not permission to invent one. The visible organogram has cycle protection and shows disconnected root nodes explicitly.
3. `GET /v1.0/groups?$select=id,displayName,resourceProvisioningOptions&$top=999` (all pages): groups and Teams-backed groups (option `Team`).
4. `GET /v1.0/groups/{id}/transitiveMembers?$select=id&$top=999` (all pages): user/group effective membership, including nested groups. Display groups/teams on each profile; this matches the transitive semantics of `checkMemberGroups`.
5. **Organization → department → people** with columns: *Pessoa / cargo / times e grupos / herda do time / concedido ao perfil*. The separate manager hierarchy is also visible. The UI never creates Graph people, groups, org records or membership.
6. Strict Graph origin/path allowlist, bounded response bodies, redirect rejection, pagination path/loop limits, request timeouts, 4-way concurrency and duplicate-ID rejection; one unresolved permission/throttling/pagination error fails the entire admin read **503**, not a partly authoritative screen.

> The existing confidential web login deliberately uses `/me` rather than enumerating users; the new, **supreme-only** `graphDirectory` capability is a separate server-side read. A tenant with restricted guests or hidden group memberships may still reject directory reads despite consent. Do not silently replace Graph with local form entries.

## 3. Two independent, editable authorizations

**A. Inherited from Team/group:** `groups[surface][role] = "group:<uuid>"`. The admin chooses an existing Graph group for **one of the exact ROWS roles**: dashboard (`admin`, `domain leader`, `contributor`, `viewer`); planner (`admin`, `finance`, `hr`, `budget owner`, `viewer`); procurement (`requester`, `buyer`, `approver`, `supplier admin`, `admin`, `viewer`). An explicit empty selection clears only that binding. The persisted `snapshots[surface].data.roleMap` is the installation's existing authority for group roles. On an uninitialized surface, the explicit private config remains the default until the first validated commit/bootstrap; clears never resurrect private config defaults.

**B. Directly granted to the profile:** `grants[].principalRef = <resource-tenant-user-object-id>`, with strict sets of `namespaces`, frozen admitted `operations`, and `humanActions`. The table shows the current grant counts and each user's role inheritance, with a per-profile edit/revoke form. The immutable Entra **object ID**, not mail, Teams nickname, job title or display name, is the stable key. A direct grant alone does not invent a group role: the product authority still requires its existing authenticated role/scope guards. A role alone does not invent product grants.

**Store/refresh:** direct grants are stored as `snapshots.dashboard.data.sfAdminGrants` in the same durable installation SQLite/WAL store as business state. `grantsForSnapshot` reads that record on every installed product authority resolution (not just startup), and `accessRevision` incorporates the effective grant. Legacy `configure-group` is denied and its form hidden in Azure, preventing a weaker second write path. Local-operator legacy behavior remains unchanged.

**Orphans:** compare every persisted `principalRef` with the fully enumerated Graph user IDs. Show disappeared principals in the **Auditoria: permissões órfãs** section with their scopes and an explicit **revoke** operation. Also show role bindings to group IDs absent from Graph. No invisible auto-cleanup; directory snapshot failure disables orphan conclusions (503). Orphan grants can only be removed, never edited as if a current profile.

## 4. Mutations, audit, anti-escalation

- **Only** an authenticated supreme-group member can submit. POST is restricted to the mounted installation's HTTPS origin, existing session, method/form-content constraints and a 64 KiB request bound; forged group/user IDs and off-catalog roles/scopes are refused.
- The handler reads live Graph before editing; server passes authenticated `principalRef`, never an HTTP-supplied actor. `store.transactionAll` performs one atomic commit and CAS check across all three surface snapshots, with per-binding/per-profile version keys `sf:access-admin:group:<surface>:<role>` and `sf:access-admin:grant:<id>`. Stale submit = **409**, invalid = **422**, caller not supreme = **403**, unavailable/invalid stored policy = **503**.
- The **same unchanged `microsoftPolicy`** validates the complete prospective `groups + grants` before commit: immutability of `group:<uuid>` syntax, ROWS whitelist, grant uniqueness, principal UUIDs, strict namespace/operation/human-action vocabulary, no duplicate grant scopes. No HTTP policy value is trusted until it passes.
- The supreme actor cannot change **their own direct grant** (even to delete); a group→role change is refused if it adds or removes any of their currently inherited roles. This prevents self-elevation and self-lockout by editing their own role mappings. The supreme group identity/membership itself is not an editable field. Real membership changes occur only through Entra administrative process.
- `changed()` writes **who (resource-tenant object ID), display name, UTC when, record key, from, to**, and increments the CAS version in the **same durable transaction**. Rejected writes are `commit:false`, no audit/state mutation. A submission succeeds via 303 PRG; GET re-reads the actual state. No action touches Graph other than GET and the existing read-only POST `checkMemberGroups`.

## 5. Delegated Microsoft Graph permissions — admin consent recorded by owner

| Delegated scope | Endpoint / reason | Consent |
| --- | --- | --- |
| `User.Read` | Existing `GET /me`, signed-in identity and OIDC | Owner reports AllPrincipals |
| `User.Read.All` | `GET /users` and `GET /users/{id}/manager`; jobTitle / department | Owner reports AllPrincipals |
| `GroupMember.Read.All` | `GET /groups`, `GET /groups/{id}/transitiveMembers`, `POST /me/checkMemberGroups` | Owner reports AllPrincipals |
| `Directory.Read.All` | Additional directory-wide reads and group membership completeness, required by owner policy | Owner reports AllPrincipals |

OAuth also requests `openid profile offline_access`. `GroupMember.Read.All`, `User.Read.All` and `Directory.Read.All` require tenant admin consent; the owner **reports** this consent is already present. The code requests **delegated only**. No application permissions, `Directory.ReadWrite.All`, `Group.ReadWrite.All`, or Microsoft Graph write calls. Verify real tenant scopes and guest/member read privileges during e2e proof.

## 6. Tests and release gate

- **Unit:** `test/admin-surface.test.ts` covers exact role enum, `microsoftPolicy` rejection, CAS conflict, atomic audit from/to, group self-escalation/self-demotion denial, self-grant denial, valid profile grant, orphan deletion and non-supreme mutation rejection.
- **Mounted signed-OIDC HTTP integration:** same file uses a synthetic Entra provider and a real installed store to prove route/POST denial for **Zico, Caio and Pedro**, visibility and Graph-derived org/role/grant HTML for **Daniel and André**, no link in Caio/Zico chrome, owner-only write, persistent CAS/audit and no Graph membership-write request. This is **not** a claim of executed browser Playwright or live tenant evidence.
- **Mandatory GO/NO-GO:** no go-live before full branch/assembly CI green **on the promoted SHA**, mounted browser proof (Daniel and André **see** the screen; Zico/Caio/Pedro **do not**, direct URL API 403), fresh Graph membership revocation, manager/group pagination, orphan recovery, invalid/hardcoded role, simultaneous admin CAS, audit durability after restart and an actual grant used by product authority.
- **Existing frozen receipts warning:** changing `local/entry.ts` intentionally invalidates the historical `microsoft49` exact-blob receipt enforced by `test/microsoft-composition.test.ts` / `integrationModule`. **Do not weaken the oracle**. The release owner must regenerate/requalify the signed integration receipt with the new source SHA and obtain required review before labeling this change releasable.
- **Operational risks:** Graph throttling or partial visibility yields fail-closed 503; large directories cost O(groups + users) calls; hidden groups may require additional entitlement; delegated directory enumeration for B2B guest accounts can be prohibited independently of consent. No Graph source data is cached into role authority or persisted. Add live VM proof of performance, and explicit policy backup/restore with after-rollback reconciliation of persisted roleMaps/grants.
- **Owner decisions:** exact Teams hierarchy exposure/privacy policy, retention and access controls for the persistent audit, approval of Entra `fla-supreme-admin` membership and designation of bootstrap admins, certification of live delegated Graph behavior, frozen-receipt requalification path, and final promotion of release gate check after CI + end-to-end evidence.

**No declarations of success absent observed run IDs and logged outputs.**
