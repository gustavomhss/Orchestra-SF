import { expect, test } from "bun:test"
import { Effect } from "effect"
import { Command } from "effect/unstable/cli"
import { NodeServices } from "@effect/platform-node"
import { Commands } from "../src/commands/commands"

test("serve and web parse repeated --allowed-host flags", async () => {
  for (const command of [Commands.commands.serve, Commands.commands.web]) {
    let captured: unknown
    const withHandler = command.spec.pipe(
      Command.withHandler((input) =>
        Effect.sync(() => {
          captured = input
        }),
      ),
    )
    await Effect.runPromise(
      Command.runWith(withHandler, { version: "test" })([
        "--allowed-host",
        "proxy.example.test",
        "--allowed-host",
        "studio.local:443",
      ]).pipe(Effect.provide(NodeServices.layer)),
    )
    const input = captured as Record<string, unknown>
    expect(input["allowed-host"]).toEqual(["proxy.example.test", "studio.local:443"])
  }
})

test("serve and web default to no explicit allowed-host aliases", async () => {
  for (const command of [Commands.commands.serve, Commands.commands.web]) {
    let captured: unknown
    const withHandler = command.spec.pipe(
      Command.withHandler((input) =>
        Effect.sync(() => {
          captured = input
        }),
      ),
    )
    await Effect.runPromise(
      Command.runWith(withHandler, { version: "test" })([]).pipe(Effect.provide(NodeServices.layer)),
    )
    expect((captured as Record<string, unknown>)["allowed-host"]).toEqual([])
  }
})
