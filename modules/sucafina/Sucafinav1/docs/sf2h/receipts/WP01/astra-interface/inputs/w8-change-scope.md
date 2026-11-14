# W8 — bounded launch diagnostics and fixture type corrections

W7 product 5886df8aaedb4db179f336e474e123c30a1d1193 (tree ec4e9503c452ac724e2b6c9b0b049ccb40377c65) failed before all consumer bodies: run 43584162495, job 132414976391. Static run 43584164297 found two fixture type errors. Its CLI typecheck and guards passed. These observations remain in the immutable receipts beside this note.

## Changes and scope

- decision-conflict-recovery.test.ts supplies the complete typed DecisionHttp options. Human, management and case ports remain real; explicitly unused ports throw if accessed.
- unavailable-views.test.ts narrows the actual authorized body after its gate, retaining the exact-body comparison and all access-revocation assertions.
- browser-driver-fixture.ts samples the public Playwright protocol logger and Node process resources/children before the original acquisition deadline. The logger emits method names/counts only, never payloads. Linux direct-child reads recheck PPid and are limited to eight children; protocol pending methods are bounded to 32. The last diagnostic survives in the parent failure record. No arguments, cookies, environment values or protocol bodies are recorded. DEBUG_FILE contributes only a configured boolean.

The source review of Playwright 1.59.1 explains why DEBUG alone was silent for launchServer. It does not explain the launch stall. Startup, teardown, pipe framing, EOF, socket permissions, process exits and full lifecycle assertions remain unchanged. Diagnostics never count as lifecycle proof. No engine, shared host, Protocol/Server HttpApi, foreign importer or document path changes.

## Surgical request

The nine-file request has SHA256 11295a026dacff165e4a16bda206ef813f304faedfd5cf268e6d58979d502848. It preserves startup/finalizer ordering and selects seven consumer files whose bodies were not executed in W7. The candidate changes types and the available launch evidence; this is not an equivalent retry. Product execution is restricted to GitHub Actions via GitHub MCP. No local product run, broad epic or automatic fallback is authorized by this note.

Independent static review found no blocker in the public logger contract, String.raw boundary or type fixes. This is source inspection, not a static or product PASS. W8 must earn both through Actions.
