# Oxlint 1.91.0 source facts

This note records findings from the `oxlint_v1.91.0` release and the source commit resolved from that tag, `f3fcdcc61b08e9880476279ba21a363967940fa4`. It documents the pinned native provisioning input only; it does not claim that Oxlint is integrated as a Lucy analyzer.

## Verified identity and artifacts

- The tag resolves directly to commit `f3fcdcc61b08e9880476279ba21a363967940fa4` in `oxc-project/oxc`.
- The tag's root `LICENSE` is MIT. Downloaded bytes have SHA-256 `95ced5ecf1133fbf41d409b5555c86c344f83f3b019926057ddbc07cfdcc27b3`; the same bytes are pinned as the exact notice.
- Each release archive was downloaded and hashed independently. The archive member lists were inspected; each contains only the named executable used by the pack. See `packages/core/test/review-toolkit/oxlint-pin.test.ts` for literal target, URL, SRI digest, extraction path, and notice pins.
- The macOS ARM64 binary declares `LC_BUILD_VERSION` minimum macOS 11.0; macOS x64 declares `LC_VERSION_MIN_MACOSX` 10.12. Linux ARM64 is an ELF statically linked executable; Linux x64 is an ELF static PIE. The Linux release targets are musl, avoiding an inferred glibc floor. Windows asset is a PE executable; no Windows runtime floor was measured here. PE runtime behavior is not qualified by this static inspection.

## Behavior supported by tagged source

The checked source is under `apps/oxlint/src` and `crates/oxc_linter/src` at the immutable commit above. The linter supports JavaScript and TypeScript. Its configuration model includes built-in plugin selection and external JS plugins (`crates/oxc_linter/src/config/oxlintrc.rs`); therefore a future invocation must deliberately prevent project configuration or plugin loading if the intended contract is no project plugins. The configuration source documents `--type-aware` as enabling type-aware linting and has type-aware configuration (`options.typeAware`); type-aware mode must remain off for a no-build/no-typecheck run. This pin records no arguments and registers no runtime command.

The release files were inspected, but the executable was deliberately not run. Exact CLI argument combinations, default config discovery/ignore behavior, machine-readable report contract, and diagnostic exit-code semantics have not been runtime-qualified here. No flags or result interpretation should be inferred from this pin; they require a separate source-backed and sandboxed qualification before analyzer integration.

## Sources

- Tag ref: <https://api.github.com/repos/oxc-project/oxc/git/ref/tags/oxlint_v1.91.0>
- Immutable source: <https://github.com/oxc-project/oxc/tree/f3fcdcc61b08e9880476279ba21a363967940fa4/apps/oxlint/src>
- Config model: <https://github.com/oxc-project/oxc/blob/f3fcdcc61b08e9880476279ba21a363967940fa4/crates/oxc_linter/src/config/oxlintrc.rs>
- License: <https://raw.githubusercontent.com/oxc-project/oxc/f3fcdcc61b08e9880476279ba21a363967940fa4/LICENSE>
- Release assets: <https://github.com/oxc-project/oxc/releases/tag/oxlint_v1.91.0>
