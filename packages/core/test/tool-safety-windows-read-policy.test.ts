import { expect } from "bun:test"
import path from "path"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { LayerNode } from "../src/effect/layer-node"
import { FSUtil } from "../src/fs-util"
import { ToolSafety } from "../src/tool-safety"
import { ToolSafetyAppContainer } from "../src/tool-safety-appcontainer"
import { ToolSafetySandbox } from "../src/tool-safety-sandbox"
import { testEffect } from "./lib/effect"

const it = testEffect(LayerNode.compile(FSUtil.node))
// Only a Windows run exercises these refusals; a Linux green is not Windows policy evidence.
const windows = process.platform === "win32" ? it.effect : it.effect.skip

;[
  { name: "required and enabled", requireSandbox: true, enabled: true },
  { name: "enabled without requireSandbox", enabled: true },
  { name: "disabled without requireSandbox", enabled: false },
].forEach((mode) => {
  ;[[], [path.resolve("read-policy-root")]].forEach((readRoots) => {
    ;[false, true].forEach((unconfinedFallback) => {
      windows(`Windows refuses ${readRoots.length ? "nonempty" : "empty"} readRoots, ${mode.name}, fallback=${unconfinedFallback}`, () =>
        Effect.gen(function* () {
          const profile = {
            ...(mode.requireSandbox === true ? { requireSandbox: true } : {}),
            sandbox: { enabled: mode.enabled, readRoots, unconfinedFallback },
          } satisfies ToolSafety.Profile
          // No NativeContext or existing root is needed: refusal precedes placement and backend acquisition.
          const denied = yield* Effect.flip(ToolSafetySandbox.wrap(
            ChildProcess.make("pwsh", ["-NoProfile", "-Command", "'must-not-run'"]),
          ).pipe(
            Effect.provideService(ToolSafety.RuntimeProfile, profile),
            Effect.provideService(ToolSafetyAppContainer.Launcher, undefined),
          ))
          expect(denied).toBeInstanceOf(ToolSafety.Denied)
          expect(denied.reason).toBe("sandbox-read-roots-platform-unsupported")
        }),
      )
    })
  })
})

;[undefined, { sandbox: { enabled: false } } satisfies ToolSafety.Profile].forEach((profile) => {
  it.effect(`ordinary command without readRoots is preserved with ${profile ? "disabled" : "no"} profile`, () =>
    Effect.gen(function* () {
      const input = ChildProcess.make("pwsh", ["-NoProfile", "-Command", "'must-not-run'"])
      const wrapped = yield* ToolSafetySandbox.wrap(input).pipe(
        Effect.provideService(ToolSafety.RuntimeProfile, profile),
        Effect.provideService(ToolSafetyAppContainer.Launcher, undefined),
      )
      expect(wrapped._tag).toBe("StandardCommand")
      if (wrapped._tag !== "StandardCommand") throw new Error("ordinary command became a pipeline")
      expect(wrapped.command).toBe(input.command)
      expect(wrapped.args).toEqual(input.args)
      expect(input.command).toBe("pwsh")
      expect(input.args).toEqual(["-NoProfile", "-Command", "'must-not-run'"])
    }),
  )
})
