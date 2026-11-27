# G09 — installed TUI / Microsoft host boundary

Status: implementation draft, not executed locally, no attestation and no G09 disposition.

## Product contract recovered

The migration plan explicitly preserves a private technical Project/Location identity when it is necessary for execution or historical references. It must not derive the enterprise profile from the user's repository, appear as that profile, or grant permission. The same plan says Basic host authentication, operator credentials, a known Session ID and a caller-supplied Team ID do not constitute corporate user identity. Direct exposure requires the corporate admission boundary.

- [Migration plan, approved planning checkpoint 3148412a](https://github.com/gustavomhss/Orchestra-SF/blob/3148412a24f9fbdcc22149b47cf739dbd539eb8d/docs/architecture/teams-profile-migration.md), sections 3.3, 3.4, A42 and residue review.
- [Blast-radius supplement at that checkpoint](https://github.com/gustavomhss/Orchestra-SF/blob/3148412a24f9fbdcc22149b47cf739dbd539eb8d/docs/architecture/teams-profile-blast-radius.md): “CLI entregue”, “Complemento CLI e conteúdo empacotado” and CLI admission cases. The supplement retains generic CLI regression coverage while separately requiring real denial at the SF host. A stub returning 403 is expressly insufficient.

These are planning decisions at the cited historical checkpoint. These document paths were not recoverable at product commit 3ef84da65d6b8ad7cd3250412bbcabdf90924172. Their presence in the planning branch is not an assertion that every requirement was implemented.

## Candidate implementation inspected

All following source links are fixed to product commit 3ef84da65d6b8ad7cd3250412bbcabdf90924172:

- [attach.ts](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/apps/cli/src/commands/handlers/attach.ts): without --session, the handler directly prepares Basic headers and invokes runTui. This probe deliberately omits --session, --continue and --fork; there is no preflight session GET to confuse with TUI execution.
- [tui.ts](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/apps/cli/src/tui.ts) and [app.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/packages/tui/src/app.tsx): create the actual OpenTUI/Solid renderer, providers and SDK. Tui.run prints an exit reason but does not make a nonzero process status the sole oracle of a bootstrap denial.
- [catalog.ts](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/packages/tui/src/context/catalog.ts), [sync.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/packages/tui/src/context/sync.tsx), and [generated client](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/packages/client/src/generated/client.ts): TUI initialization asks for /api/location and the provider/model/agent/config catalog; a fatal bootstrap error exits the renderer.
- [serve.ts](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/apps/cli/src/commands/handlers/serve.ts): trusted-ingress installation mode mounts only the installation layer, does not register as the generic daemon, and does not compose createRoutes.
- [installation.ts](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/apps/cli/src/sucafina-product/installation.ts): validates trusted ingress before routing; the native discovery route is explicit; generic /api/location and catalog paths are not part of the Microsoft host.
- [TUI README](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/packages/tui/README.md): existing tests do not drive a real terminal. This supplemental harness addresses one installed-terminal boundary only.

## Smallest implemented supplemental case

Case name: **Installed TUI attach cannot bootstrap generic APIs through the dedicated Microsoft Team host**

1. Verify the existing tar and ELF hashes, the packaged Microsoft factory, and the original producer's synthetic Entra provider.
2. Observe /proc for the running server and its explicit provider/factory/configuration. This must be the installed ELF, not a source entrypoint.
3. Run HTTP setup controls against the actual Microsoft host: untrusted ingress denied; anonymous context denied; real synthetic OIDC/PKCE/JWKS/Graph login admits Team A; a different synthetic account with no Team is denied. These controls are explicitly not TUI evidence.
4. Start the same installed ELF with attach in a real Linux PTY, clean isolated state and a fresh nonce-bearing directory. A loopback observer forwards to the actual dedicated Microsoft host. It supplies only the fixture's trusted-ingress Host/proof headers, never a session cookie, Team selector or fabricated route response.
5. Observe the actual TUI's /api/location request, at least one catalog request, the invocation directory correlation, terminal output and natural exit. Every observed request must return the real upstream's empty 404. Repeat with explicit synthetic Basic credentials and confirm they were actually transmitted.
6. Record raw PTY and minimized network evidence hashes, nonce, exact runtime process, source/tar/factory/provider identity, job/run/attempt and harness hash. Confirm files under the inspected business/business-teams stores did not change.

The case proves a negative boundary for TUI initialization. It does not claim a supported corporate TUI login, visual acceptance, worktree creation/move/removal/editor/export, the 33 full source spans, complete authorization coverage or a formal G09 PASS. No occurrence/finding IDs are automatically classified.

## CI wiring

Use separate frozen checkouts:

- Candidate source: 3ef84da65d6b8ad7cd3250412bbcabdf90924172.
- Producer helper: b1e3c29c1b7462872aa3d23b2777a5b619dfb6cb.
- Harness: the current isolated g09-recovery commit.
- Existing artifact: 14722264806, no rebuild.

Set:

- GITHUB_ACTIONS=true, actual GITHUB_RUN_ID/GITHUB_RUN_ATTEMPT/GITHUB_SHA.
- CHECK_RUN_ID to the actual job check-run ID.
- SOURCE_REVISION to the candidate SHA above.
- SF_G09_SOURCE_DIR to the frozen source checkout.
- CI_RUNTIME to a fresh private absolute directory, created with mode 0700.
- CI_PORT to the dedicated loopback host port.
- CI_PROOF to a fresh 32-byte lowercase hex fixture secret.

Run setup with Bun:

~~~sh
bun "$HARNESS/.github/ci/g09-tui-setup.mjs"
~~~

Start the actual installed server using the producer's isolation recipe:

~~~sh
config="$CI_RUNTIME/installation"
installed="$RELEASE/bin"
cd "$CI_RUNTIME/workspace"
env -i PATH="$PATH" HOME="$CI_RUNTIME" \
  XDG_DATA_HOME="$config/host-data" XDG_CONFIG_HOME="$config/host-config" \
  XDG_CACHE_HOME="$config/host-cache" XDG_STATE_HOME="$config/host-state" \
  TMPDIR="$config/host-tmp" ORCHESTRA_CONFIG_DIR="$config/host-config" \
  ORCHESTRA_CREDENTIAL_KEY_FILE="$config/host-credential.key" ORCHESTRA_DB="$config/host-data/orchestra.db" \
  ORCHESTRA_INHERIT_CREDENTIALS=0 ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER=strict \
  SUCAFINA_NATIVE_TEAM_DECISIONS=1 SUCAFINA_NATIVE_TEAM_WEB=1 \
  SUCAFINA_MICROSOFT_CONFIG="$config/installation.json" SF_PROOF_FACTORY="$installed/local/entry.mjs" \
  "$installed/orchestra" serve --hostname 127.0.0.1 --port "$CI_PORT" \
  --installation "$PRODUCER/.github/ci/entra-native-provider.mjs" \
  >"$CI_RUNTIME/server.log" 2>&1 &
server=$!
~~~

Wait for the actual host to answer its untrusted-ingress 403 as in the producer, while checking that the process is still alive. Then:

~~~sh
python3 -B "$HARNESS/.github/ci/g09-tui-boundary-proof.py" \
  --binary "$installed/orchestra" \
  --factory "$installed/local/entry.mjs" \
  --provider "$PRODUCER/.github/ci/entra-native-provider.mjs" \
  --archive "$ORIGINAL/orchestra-sf-entra-linux-x64-baseline.tar.gz" \
  --runtime-dir "$CI_RUNTIME" --server-pid "$server" --port "$CI_PORT" \
  --output-dir "$CI_RUNTIME/tui-evidence"
~~~

The job owns host termination/cleanup. Preserve failure diagnostics; a timeout, missing PTY request, hash mismatch, provider error or unexpected 2xx must fail the job. A request sent by the harness itself cannot substitute for the TUI request requirement.

The provider must be the original 4,422-byte file, SHA-256 c272473a9b98cb5231348a31576900b6e362b6fc692cbc9a728b4bc92264777f. Do not change its newline bytes while copying. The packaged factory SHA-256 is 459919556ccc1381554cc62122831828ebc2acc816344206a5a0be11abe6a87f.

## Remaining attribution/qualification work

The assessor must decide whether this case supports particular retained technical code dispositions, using the recovered full inventory and current verifier. A successful probe is not a license to classify every TUI occurrence as unreachable. The raw generic daemon still exists in the binary; it is a different authority and execution surface.

The four worktree/session behavior groups in the original briefing remain unexecuted by this case. If required for retained generic-runtime regression, execute them in their proper technical context and state that scope. If a requirement is corporate Team authorization, do not substitute a generic daemon success.
