import { SfPeople } from "@orchestra/schema/sucafina/people"
import type { SfCallOptions, SfTransport } from "./transport"

/** Every A10 POST is a distinct catalog command and requires an idempotency key. */
export type SfPeopleMutationOptions = SfCallOptions & Readonly<{ idempotencyKey: string }>

/**
 * Closed A10 client: F02 executes original source routes and current auth.
 * There is no arbitrary action/path/body dispatcher or automatic retry.
 * Source success is followed by a separate, authorized page read by the caller.
 */
export function createSfPeopleClient(transport: SfTransport) {
  return {
    "domain.page.CAP02": (
      input: typeof SfPeople.operations["domain.page.CAP02"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfPeople.operations["domain.page.CAP02"], input, options),
    "domain.command.CAP02.delete": (
      input: typeof SfPeople.operations["domain.command.CAP02.delete"]["input"]["Type"],
      options: SfPeopleMutationOptions,
    ) => transport.execute(SfPeople.operations["domain.command.CAP02.delete"], input, options),
    "domain.command.CAP02.save": (
      input: typeof SfPeople.operations["domain.command.CAP02.save"]["input"]["Type"],
      options: SfPeopleMutationOptions,
    ) => transport.execute(SfPeople.operations["domain.command.CAP02.save"], input, options),
    "domain.page.CAP06": (
      input: typeof SfPeople.operations["domain.page.CAP06"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfPeople.operations["domain.page.CAP06"], input, options),
    "domain.page.CAP07": (
      input: typeof SfPeople.operations["domain.page.CAP07"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfPeople.operations["domain.page.CAP07"], input, options),
    "domain.command.CAP07.deleteLeader": (
      input: typeof SfPeople.operations["domain.command.CAP07.deleteLeader"]["input"]["Type"],
      options: SfPeopleMutationOptions,
    ) => transport.execute(SfPeople.operations["domain.command.CAP07.deleteLeader"], input, options),
    "domain.command.CAP07.deleteMember": (
      input: typeof SfPeople.operations["domain.command.CAP07.deleteMember"]["input"]["Type"],
      options: SfPeopleMutationOptions,
    ) => transport.execute(SfPeople.operations["domain.command.CAP07.deleteMember"], input, options),
    "domain.command.CAP07.saveCio": (
      input: typeof SfPeople.operations["domain.command.CAP07.saveCio"]["input"]["Type"],
      options: SfPeopleMutationOptions,
    ) => transport.execute(SfPeople.operations["domain.command.CAP07.saveCio"], input, options),
    "domain.command.CAP07.saveLeader": (
      input: typeof SfPeople.operations["domain.command.CAP07.saveLeader"]["input"]["Type"],
      options: SfPeopleMutationOptions,
    ) => transport.execute(SfPeople.operations["domain.command.CAP07.saveLeader"], input, options),
    "domain.command.CAP07.saveMember": (
      input: typeof SfPeople.operations["domain.command.CAP07.saveMember"]["input"]["Type"],
      options: SfPeopleMutationOptions,
    ) => transport.execute(SfPeople.operations["domain.command.CAP07.saveMember"], input, options),
    "domain.page.CAP08": (
      input: typeof SfPeople.operations["domain.page.CAP08"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfPeople.operations["domain.page.CAP08"], input, options),
    "domain.command.CAP08.delete": (
      input: typeof SfPeople.operations["domain.command.CAP08.delete"]["input"]["Type"],
      options: SfPeopleMutationOptions,
    ) => transport.execute(SfPeople.operations["domain.command.CAP08.delete"], input, options),
    "domain.command.CAP08.exportAllMembers": (
      input: typeof SfPeople.operations["domain.command.CAP08.exportAllMembers"]["input"]["Type"],
      options: SfPeopleMutationOptions,
    ) => transport.execute(SfPeople.operations["domain.command.CAP08.exportAllMembers"], input, options),
    "domain.command.CAP08.import": (
      input: typeof SfPeople.operations["domain.command.CAP08.import"]["input"]["Type"],
      options: SfPeopleMutationOptions,
    ) => transport.execute(SfPeople.operations["domain.command.CAP08.import"], input, options),
    "domain.command.CAP08.save": (
      input: typeof SfPeople.operations["domain.command.CAP08.save"]["input"]["Type"],
      options: SfPeopleMutationOptions,
    ) => transport.execute(SfPeople.operations["domain.command.CAP08.save"], input, options),
  } as const
}
