# CI-UI-OPERATIONS — job 134890490464

Run `44329483839`, job `134890490464`, suite `CI-UI-OPERATIONS`. The selector named `packages/app-shell/e2e/sucafina/operations.spec.ts`. Playwright never started a test. There is no assertion failure, timeout, wrong locator, or stale path in that spec.

## Cause

`config.webServer` (`vite build`) exited 1 before any test:

```
Error: Process from config.webServer was not able to start. Exit code: 1
```

The build error the log names:

```
packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/producer.ts (1:9):
"Either" is not exported by effect@4.0.0-beta.83/dist/index.js

packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/producer.ts (56:27):
"decodeUnknownEither" is not exported by effect@4.0.0-beta.83/dist/Schema.js
```

`producer.ts` still uses the Effect 3 barrel (`import { Either, Schema } from "effect"` and `Schema.decodeUnknownEither` / `Either.isLeft` / `decoded.right`). The same tree already decodes this domain with Effect 4 in `host/draft-revalidation-project.ts`: `Option` plus `Schema.decodeUnknownOption`.

The operations spec was not edited. A producer import change is outside that spec, and believing it needs a new webServer build plus the suite. No test or CI was launched from this lane.

## Proposed patch

In `packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/producer.ts` only:

```ts
import { Option, Schema } from "effect"
```

At each of the six call sites (lines 56, 64, 87, 96, 105, 113), replace:

```ts
const decoded = Schema.decodeUnknownEither(schema)(input)
if (Either.isLeft(decoded)) return failure(503, reason)
// use decoded.right
```

with the local Effect 4 form:

```ts
const decoded = Schema.decodeUnknownOption(schema)(input)
if (Option.isNone(decoded)) return failure(503, reason)
// use decoded.value
```

Keep every failure reason and status. Do not change `operations.spec.ts`.

`portfolio/scenarios/producer.ts` imports `Either` the same way. This job died on `projects/producer.ts` before Rollup reported that file. Treat it as the next build error, not as this job's failure.
