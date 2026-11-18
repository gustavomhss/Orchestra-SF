# A7 / FLAMENGO — Microsoft configuration and Caddy ingressOrigin

**Delivery: TEMPLATE_PREPARED / NOT_DEPLOYED.** Scope: only `sf/azure/**` in branch `sfa-vm`, PR #248 DRAFT. No VM or Azure commands have been executed in this round. The user's VM-managed-identity and CI evidence remains owner-provided, not a claim of production readiness.

## 1. Exact non-secret inputs

The versioned example is `sf/azure/runtime/flamengo-microsoft.example.json`. It uses exactly the product fields admitted by `modules/sucafina/Sucafinav1/runtime/microsoft-configuration.ts`, not extra metadata:

- Tenant `449dfd17-d627-45da-b22c-1be49d8df99f`, clientId `9006dcb8-1a75-4886-9475-1e7f1dc5d7cd`, deployment `azure-https`, authentication `microsoft`, mount `/sucafina`.
- Public origin `https://orchsf-spug5rxxyqkdw.swedencentral.cloudapp.azure.com`; listenerOrigin `http://127.0.0.1:4096`.
- Dashboard: admin, contributor, viewer; Planner: admin, finance, viewer; Procurement: admin, requester, buyer, approver, viewer. All **11** supplied group IDs are preserved as exact `group:<uuid>` values. Roles not supplied are **unmapped**; no permissions implied for domain leader, hr, budget owner or supplier admin.
- Scanner `null`, sessionSeconds `28800`, loginSeconds `600` (product defaults explicitly represented). No OAuth/client secret, token, private key, identity assertion or customer data appears anywhere in the example.

**Directory choices not supplied by the owner:** the sample proposes `/var/lib/orchestra-sf/home/flamengo-config/installation.json` for the private Microsoft profile and `/var/lib/orchestra-sf/home/flamengo-workspace` for the separate agent workspace. These are path proposals, NOT observed VM state. A8/owner must provision them as canonical, non-symlink directories owned by `orchestra-sf`, mode `0700`. The installation.json file must be 0600; the workspace must not contain the private credentials. A8 also must provision unique 32-byte `session.key`, `bank.key` and `assets.key`, a valid `host-credential.key` and private XDG directories before service start.

`sf/azure/runtime/runtime.env.flamengo.example` supplies the non-secret paths and real FQDN. After approval, the owner installs it as `/etc/orchestra-sf/runtime.env`, root:root 0600. Do not populate `SUCAFINA_LOCAL_CONFIG`; only `SUCAFINA_MICROSOFT_CONFIG` is allowed for Entra. No secret value goes in EnvironmentFile.

**Actors** Daniel (owner/admin), Caio, Pedro, Gabriel and Sofie are actual people from the demo tenant. Zico has no group and must be exercised as a negative test by A8; do not synthesize memberships or assume his denial has already been observed. Their **resource-tenant objectIds and assigned memberships were not provided**. Names are not valid `principalRef` values. Accordingly, `grants: []` is intentional and valid in `microsoft-policy.ts`; it creates **no native product operation grants**. A8 must supply real principal objectIds and reviewed namespaces/operations/humanActions before the relevant native user journeys can be accepted. Never populate grants with all operations as an admin shortcut. Group-role mappings alone do not grant those product operations.

## 2. Why ingressOrigin cannot be guessed from public origin

The example's only unresolved value is:

`"ingressOrigin": "REQUIRES_OBSERVED_CADDY_HTTP_INGRESS_ORIGIN"`

That string intentionally fails the product's URL validation and the strengthened Key Vault preflight; it cannot silently activate a guessed binding.

Three independent origins exist:

1. Browser → Caddy: `origin = https://orchsf-spug5rxxyqkdw.swedencentral.cloudapp.azure.com` (public HTTPS).
2. Native CLI listener: `listenerOrigin = http://127.0.0.1:4096` (loopback).
3. Caddy → CLI: **HTTP**, with the **Host actually sent upstream** by Caddy, not a value from an untrusted X-Forwarded-Host or a client-supplied Forwarded header.

The checked-in Caddy template uses `reverse_proxy 127.0.0.1:4096` plus `header_up Host {host}` and no rewrite/strip. The CLI's `composeSfInstallation` rejects a request unless the incoming Host equals `new URL(ingressOrigin).host` **and** the request URL's origin equals `ingressOrigin`. This deliberately strips/discards forwarded hints before Microsoft admission.

For the supplied Caddy template, **if the actual Host forwarded is** `orchsf-spug5rxxyqkdw.swedencentral.cloudapp.azure.com` with no port, the expected *internal* origin is:

`http://orchsf-spug5rxxyqkdw.swedencentral.cloudapp.azure.com`

This is a **derived expected value**, not a verified network observation. The user expressly requested the field remain unfilled until the Caddy ingress is verified. If the actual Host has a port, the full host:port must be represented exactly; a host mismatch must be fixed by A8/proxy review, never by disabling guards, broadening CORS, or setting ingress to public HTTPS.

### Owner/A8 verification when installation is authorized (NOT RUN here)

Before making config changes, inspect the actual Caddy source/rendered routes without printing secrets:

~~~bash
sudo caddy adapt --config /etc/caddy/Caddyfile --pretty
# Check reverse_proxy destination 127.0.0.1:4096;
# check Host preservation, without handle_path or uri strip_prefix.
~~~

When the authenticated production-grade listener is actually running in a controlled window, compare a **read-only** local request carrying the expected Host to the equivalent public HTTPS request after the owner-approved Caddy switch:

~~~bash
FQDN=orchsf-spug5rxxyqkdw.swedencentral.cloudapp.azure.com
curl -sS --max-time 15 -o /dev/null -w '%{http_code}\n' \
  -H "Host: $FQDN" http://127.0.0.1:4096/sucafina/status
curl -sS --max-time 15 -o /dev/null -w '%{http_code}\n' \
  "https://$FQDN/sucafina/status"
~~~

Verify the upstream Host by inspection of the actual adapted Caddy route (or a non-sensitive host-observation mechanism explicitly authorized by A8). A 200 on `/sucafina/status` means only that the original factory answered; it does **not** prove a Microsoft session, CAS, actor binding, rollback or go-live. After the Host is independently confirmed, replace the invalid ingressOrigin sentinel **in the private installed copy only**, leaving the published example as an intentionally non-executable template. Do not set it to `http://127.0.0.1:4096` or public `https://...` for convenience.

## 3. Key Vault file delivery: ExecStartPre remains fail-closed

The already-committed service `sf/azure/runtime/orchestra-sf.service` has `User=orchestra-sf` and `EnvironmentFile=/etc/orchestra-sf/runtime.env`. The `ExecStartPre=+/usr/local/libexec/orchestra-sf/materialize-entra-secret.sh` runs only the preparation step as root. The main CLI remains non-root.

The updated `sf/azure/runtime/materialize-entra-secret.sh` first checks the FLAMENGO tenant ID, client ID, public origin, listener, mount, and a syntactically valid, no-longer-placeholder **HTTP ingressOrigin**. **Until this passes, it does not request even an IMDS token.** It then reads the system-assigned VM managed identity from IMDS `169.254.169.254`, calls the **known** vault `kv-orchsf-2611162127` / `entra-client-secret` over CA-validated TLS, and validates the returned versioned secret. Bearer and value reside only in root-only `/run` temporary files, never argv/environment/repo/logs. Atomic dirfd + O_NOFOLLOW replacement writes the product-required `<config-dir>/client-secret.txt` as `orchestra-sf:orchestra-sf`, 0600 and nlink 1. Failure to access IMDS, Key Vault, validate JSON, validate owner/mode or write the file leaves service startup **RED**.

The owner already verified a Key Vault GET HTTP 200 with 40 bytes. **A7 has not repeated that GET, read the secret, installed a file, changed Caddy, started systemd or accessed Azure.**

## 4. Local and external acceptance boundary

The template is complete for the **11 supplied role groups**, but remains intentionally non-executable until A8 approves/observes ingressOrigin, verifies group memberships, provisions the owner-only directories/keys and supplies a reviewed product-grant policy. A10 still must freeze C and verify real factory/CI receipts from the **same C**, A8 must prove real Entra/OIDC sessions and denial of Zico, and A7/A9 must prove persistence, source-CAS, F04/AM and rollback on the Azure VM. This work cannot be marked AZURE_RELEASE_QUALIFIED merely because the JSON is parseable or the prestart source is present.
