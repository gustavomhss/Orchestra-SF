# M79 — Effect 4.0.0-beta.83 static review

This is a source review, not an execution result. No runtime test, typecheck, Actions dispatch, or GitHub mutation was performed for this review.

## Pin and examined paths

Repository: `Effect-TS/effect` (the `effect-smol` repository name resolves the same source). Commit: `cd7ab658994104bd6fe8f841f1440bea32c387f5`.

Both `packages/effect/package.json` and `packages/platform-node-shared/package.json` declare `4.0.0-beta.83` at this pin.

| Path | Examined material | Blob |
| --- | --- | --- |
| `packages/platform-node/src/NodeStream.ts` | Entire re-export | `c98e67d0ca3372705e5a8ab40b3e91609e8d43b0` |
| `packages/platform-node-shared/src/NodeStream.ts` | Entire file, especially `fromReadableChannel` and `readableToPullUnsafe` | `342eeabadb49aeb5a9025911ba67b43fa641b590` |
| `packages/effect/src/Stream.ts` | `fromChannel`, `runForEachArray`, `toReadableStreamWith` | `ebeb0909c00a3ea84354eefa14c5cd4c56ef1c17` |
| `packages/effect/src/Channel.ts` | `fromTransform`, `toTransform`, `runWith`, `runForEach`, `toPull`, `toPullScoped` | `b2c2384a7e6cdc0024ccec541bc6c645ae27f53c` |
| `packages/effect/src/Latch.ts` | Entire public implementation/delegation | `e374e81006c88ff8d88dc78ca61967096d87bfc7` |
| `packages/effect/src/internal/effect.ts` | `Latch`, `runForkWith`, `fiberRunIn`, `provideContext`, `callback`, `forever` | `157ae54898c4d72e32c1581ad7de1dabcf62432a` |
| `packages/effect/src/Pull.ts` | `catchDone`, Done discrimination | `54092190aef4bc73d14bf8f6fcc6ef85d37de1b1` |
| `packages/effect/src/internal/stream.ts` | Entire constructor | `ae688cd857f82ec1c74e3fa9a9be22c493d48660` |
| `packages/platform-node/src/NodeHttpServer.ts` | `makeHandler`, `ServerRequestImpl` | `f6838fb329942f4db1f3894eecf5e3d3ee57b28a` |
| `packages/platform-node/src/NodeHttpServerRequest.ts` | Entire source/response accessors | `aa34e49c0c39163c6116a323ed2e358195091535` |
| `packages/platform-node/src/NodeHttpIncomingMessage.ts` | Entire file, especially `stream` | `2461e86c785d6f7435c8e4cc533f450329d9cc44` |
| `packages/effect/src/unstable/http/HttpServerRequest.ts` | `toURL`, `toWebResult`, `toWeb` | `83e6c3e6f9d0f12ce2eb4ccec969459f9f99c7a4` |

The large files were fetched in full through GitHub MCP and the listed functions were then selected from the returned content. This table does not claim a full-file audit of the large modules.

## Conclusions supported by code

1. `readableToPullUnsafe` listens to `readable`, `error`, and `end`; it does not listen to Node `close`. `end` sets an exit marker and opens the Node latch. A pull that has already received a non-null chunk drains subsequent `read()` values and returns its chunk array. The exit marker is consulted only when the initial read of a subsequent pull returns null. Thus end is not a branch that discards the already returned bytes. [NodeStream source](https://github.com/Effect-TS/effect/blob/cd7ab658994104bd6fe8f841f1440bea32c387f5/packages/platform-node-shared/src/NodeStream.ts#L338-L402)

2. `Channel.runWith` allocates its own scope, creates the pull, runs the consumer, handles Done, and closes that scope through `Effect.onExit`. `runForEach` sequences each pull with its consumer before the next pull. The scope is not closed simply because the underlying Node request emits `close`. [Channel source](https://github.com/Effect-TS/effect/blob/cd7ab658994104bd6fe8f841f1440bea32c387f5/packages/effect/src/Channel.ts#L7147-L7168) [Sequencing](https://github.com/Effect-TS/effect/blob/cd7ab658994104bd6fe8f841f1440bea32c387f5/packages/effect/src/Channel.ts#L7755-L7772)

3. `NodeHttpServer.makeHandler` interrupts the request fiber on **ServerResponse** `close` when `writableEnded` is false. It does not install that interruption on the normal **IncomingMessage** `close`. [Server source](https://github.com/Effect-TS/effect/blob/cd7ab658994104bd6fe8f841f1440bea32c387f5/packages/platform-node/src/NodeHttpServer.ts#L185-L199)

4. `Stream.toReadableStreamWith` starts a separate fiber running `runForEachArray`. A returned chunk waits on a Web-demand latch; a Web `pull()` installs a resolver and opens the latch; the callback closes the latch, calls `controller.enqueue` for the chunk's values, and resolves that pull. The fiber observer closes or errors the controller at terminal exit. [Web conversion source](https://github.com/Effect-TS/effect/blob/cd7ab658994104bd6fe8f841f1440bea32c387f5/packages/effect/src/Stream.ts#L11145-L11200)

5. The latch's unsafe open records the open state before synchronously flushing current waiters. A later waiter observes the recorded open state. The examined code does not show an ordinary lost wake between an open and a later wait. [Latch implementation](https://github.com/Effect-TS/effect/blob/cd7ab658994104bd6fe8f841f1440bea32c387f5/packages/effect/src/internal/effect.ts#L5341-L5398)

6. `HttpServerRequest.toWebResult` creates `Stream.toReadableStreamWith(self.stream, context)` and passes it as the body of a new `Request` with `duplex: "half"`. It does not eagerly decode the body or derive EOF from Content-Length. [Request conversion](https://github.com/Effect-TS/effect/blob/cd7ab658994104bd6fe8f841f1440bea32c387f5/packages/effect/src/unstable/http/HttpServerRequest.ts#L1032-L1059)

## What the reported S0 trace does and does not establish

The root supplied a hosted Versions trace in which the Node request pushes and reads all 77 bytes, pushes null, emits end and close by approximately 2.1 ms. At 1.8 s the handler's first Web reader read remains pending, with zero Web bytes and no abort signal. Identity handling and preparation returned; the domain transaction was not entered.

This excludes the missing Node request EOF hypothesis for that reproduced request. It also does not support interpreting the ordinary IncomingMessage close as automatic cancellation of the request fiber.

The first demonstrated incomplete boundary is delivery of the Web body to the handler reader. The trace does not by itself identify which caller made each observed `IncomingMessage.read()` invocation, and therefore does not prove the Effect channel emitted its array or the Web controller enqueued it.

The reported sequence—read(value), read(null), later read(null), then read(null) after end—is compatible with an Effect pull producing a chunk, a subsequent pull waiting for EOF, and a last pull observing Done. It remains an inference until those call sites or the raw Web stream control are observed.

## Specific unproven candidate

`toReadableStreamWith.pull()` returns a Promise. Only its successful chunk callback resolves `currentResolve`. Its terminal fiber observer calls `controller.close()`/`controller.error()` without resolving a terminal pull Promise that is still pending.

This is a concrete source property, not a demonstrated causal defect: Web stream close/error should settle pending reads independently of completion of the underlying pull Promise. A Bun/Request interaction with this terminal handshake would need execution evidence. Do not describe it as the established bug from this review alone.

## Small passive discriminant

Inside the existing per-instance `IncomingMessage.read` wrapper, classify a freshly captured stack into booleans such as `effectNodeStreamCaller` and `internalNodeCaller`; immediately discard the stack. Record only the classification, argument size, and existing null/value/byte counters. Match the known `platform-node-shared/.../NodeStream.ts` or `NodeStream.js` frame. Do not log stacks, paths, arguments containing user content, or add data/readable listeners. Preserve `Reflect.apply(original, this, args)` unchanged.

This identifies whether read(value) and the read(null) after end belong to `readableToPullUnsafe`. The root's already prepared collect/rawWeb/directWeb/Request-clone controls are a stronger material discriminator of channel production versus Web/Request delivery. Capture actual bytes and EOF separately at each consumer, and compare `rawWeb === request.body`, locked/bodyUsed state, and completion before cancellation without adding a second consumer to the same stream.

## Qualification boundary

There is no source-only proof in the reviewed functions of a race that drops an already obtained chunk and leaves the first Web read pending. Keep the mechanism qualified until hosted control results distinguish Node→Effect production, raw Effect→Web delivery, and Request body wrapping. Do not reuse the previously suspected Bun missing-request-EOF branch as the cause of the S0 reproduction.

## Adaptive discriminator after the reported A74 hosted results

The root subsequently reported that A74 run `43672712025`, job `132686076424`, had 14 passes and one Bun oracle failure, and that actual Node bodies, binary upload, and Microsoft admission had succeeded with the existing A74 Effect-based bridge. This source review has not independently retrieved that job. It is a reason to qualify A74's existing implementation before introducing an alternative flowing-mode transport.

C34 and the A74 source differ in several relevant ways: C34 calls `toWeb` (captured context, default Web HWM, NodeStream default `closeOnDone`) and then passes `new Request(request, { signal })` to the handler. A74 explicitly builds the Node stream with `closeOnDone: false`, uses an empty Effect context and HWM zero, applies its bounded body stream, and creates one final Request. A passing A74 overlay alone does not assign causality to any one of those changes.

Use a fresh HTTP POST with the same 28 bytes and explicit Content-Length for each cell. Hold the same Node source options, URL, headers, signal timing, and read operation fixed within each pair. Each stream is consumed exactly once. No long journey is needed.

| Already planned observations | Inference permitted | Next smallest variant |
| --- | --- | --- |
| collect passes; raw Web fails | Node→Effect production works; conversion/delivery through Web remains suspect | Change only Web HWM from its default to zero, retaining the captured context |
| raw Web passes; first Request fails | Failure introduced at first Request construction/body ownership | Repeat first Request with HWM zero, same context and source options |
| first Request passes; second Request fails | Failure introduced by Request reconstruction/body transfer | Repeat that second-Request case with HWM zero, same context/source options |
| HWM zero repairs the otherwise identical failing cell | HWM/prefetch is sufficient to alter the result for that cell; if only reconstruction failed, qualify the clone×prefetch interaction | Keep HWM at the original value and change only captured context to empty if context attribution is still needed |
| raw Web, direct Request, and second Request all pass while installed C34 fails | These isolated controls did not reproduce the installed failure | Compare the installed channel/context and request copying steps; do not broaden to unrelated journeys |

`toReadableStreamWith(stream, capturedContext, { strategy: { highWaterMark: 0 } })` is the HWM-only change. `toReadableStreamWith(stream, Context.empty())` is the context-only change from the default-HWM cell. Do not change `closeOnDone`, add the bounded wrapper, or change the Request count in either of those comparisons.

If the second Request alone fails, a further single POST can distinguish generic reconstruction from the signal override: compare `new Request(first)` with `new Request(first, { signal })`. Only perform this if the first Request passes and the signal-bearing reconstruction actually fails. The main checks are exact bytes, reader completion, and pre-cancellation state; a successful constructor is not completion of the body handoff.
