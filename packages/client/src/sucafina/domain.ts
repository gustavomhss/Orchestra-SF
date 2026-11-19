import { SfDomain } from "@orchestra/schema/sucafina/domain"
import type { SfCallOptions, SfTransport } from "./transport"

/**
 * Canonical A01 client. No arbitrary method/path, headers, business arithmetic,
 * automatic retry or offline success. F02 enforces owner, codec and post-read
 * transport fences for every entry.
 */
export function createSfDomainClient(transport: SfTransport) {
  return {
    "domain.page.CAP01": (
      input: typeof SfDomain.operations["domain.page.CAP01"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.page.CAP01"], input, options),
    "domain.command.CAP01.save-users": (
      input: typeof SfDomain.operations["domain.command.CAP01.save-users"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP01.save-users"], input, options),
    "domain.command.CAP01.save-benchmark": (
      input: typeof SfDomain.operations["domain.command.CAP01.save-benchmark"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP01.save-benchmark"], input, options),
    "domain.page.CAP03": (
      input: typeof SfDomain.operations["domain.page.CAP03"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.page.CAP03"], input, options),
    "domain.command.CAP03.save-month": (
      input: typeof SfDomain.operations["domain.command.CAP03.save-month"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP03.save-month"], input, options),
    "domain.command.CAP03.save-revenue": (
      input: typeof SfDomain.operations["domain.command.CAP03.save-revenue"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP03.save-revenue"], input, options),
    "domain.page.CAP04": (
      input: typeof SfDomain.operations["domain.page.CAP04"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.page.CAP04"], input, options),
    "domain.command.CAP04.save": (
      input: typeof SfDomain.operations["domain.command.CAP04.save"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP04.save"], input, options),
    "domain.command.CAP04.delete": (
      input: typeof SfDomain.operations["domain.command.CAP04.delete"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP04.delete"], input, options),
    "domain.command.CAP04.save-entry": (
      input: typeof SfDomain.operations["domain.command.CAP04.save-entry"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP04.save-entry"], input, options),
    "domain.command.CAP04.save-deviation": (
      input: typeof SfDomain.operations["domain.command.CAP04.save-deviation"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP04.save-deviation"], input, options),
    "domain.command.CAP04.annual-entry": (
      input: typeof SfDomain.operations["domain.command.CAP04.annual-entry"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP04.annual-entry"], input, options),
    "domain.command.CAP04.year-amount": (
      input: typeof SfDomain.operations["domain.command.CAP04.year-amount"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP04.year-amount"], input, options),
    "domain.command.CAP04.import": (
      input: typeof SfDomain.operations["domain.command.CAP04.import"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP04.import"], input, options),
    "domain.page.CAP05": (
      input: typeof SfDomain.operations["domain.page.CAP05"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.page.CAP05"], input, options),
    "domain.command.CAP05.save": (
      input: typeof SfDomain.operations["domain.command.CAP05.save"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP05.save"], input, options),
    "domain.command.CAP05.delete": (
      input: typeof SfDomain.operations["domain.command.CAP05.delete"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP05.delete"], input, options),
    "domain.command.CAP05.save-entry": (
      input: typeof SfDomain.operations["domain.command.CAP05.save-entry"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP05.save-entry"], input, options),
    "domain.command.CAP05.save-deviation": (
      input: typeof SfDomain.operations["domain.command.CAP05.save-deviation"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP05.save-deviation"], input, options),
    "domain.command.CAP05.annual-entry": (
      input: typeof SfDomain.operations["domain.command.CAP05.annual-entry"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP05.annual-entry"], input, options),
    "domain.command.CAP05.year-amount": (
      input: typeof SfDomain.operations["domain.command.CAP05.year-amount"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP05.year-amount"], input, options),
    "domain.page.CAP09": (
      input: typeof SfDomain.operations["domain.page.CAP09"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.page.CAP09"], input, options),
    "domain.command.CAP09.save": (
      input: typeof SfDomain.operations["domain.command.CAP09.save"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP09.save"], input, options),
    "domain.command.CAP09.delete": (
      input: typeof SfDomain.operations["domain.command.CAP09.delete"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP09.delete"], input, options),
    "domain.command.CAP09.import": (
      input: typeof SfDomain.operations["domain.command.CAP09.import"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP09.import"], input, options),
    "domain.command.CAP09.save-milestone": (
      input: typeof SfDomain.operations["domain.command.CAP09.save-milestone"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP09.save-milestone"], input, options),
    "domain.command.CAP09.delete-milestone": (
      input: typeof SfDomain.operations["domain.command.CAP09.delete-milestone"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP09.delete-milestone"], input, options),
    "domain.page.CAP10": (
      input: typeof SfDomain.operations["domain.page.CAP10"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.page.CAP10"], input, options),
    "domain.command.CAP10.save": (
      input: typeof SfDomain.operations["domain.command.CAP10.save"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP10.save"], input, options),
    "domain.command.CAP10.delete": (
      input: typeof SfDomain.operations["domain.command.CAP10.delete"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP10.delete"], input, options),
    "domain.command.CAP10.import": (
      input: typeof SfDomain.operations["domain.command.CAP10.import"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP10.import"], input, options),
    "domain.command.CAP10.save-milestone": (
      input: typeof SfDomain.operations["domain.command.CAP10.save-milestone"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP10.save-milestone"], input, options),
    "domain.command.CAP10.delete-milestone": (
      input: typeof SfDomain.operations["domain.command.CAP10.delete-milestone"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP10.delete-milestone"], input, options),
    "domain.page.CAP13": (
      input: typeof SfDomain.operations["domain.page.CAP13"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.page.CAP13"], input, options),
    "domain.command.CAP13.save": (
      input: typeof SfDomain.operations["domain.command.CAP13.save"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP13.save"], input, options),
    "domain.command.CAP13.delete": (
      input: typeof SfDomain.operations["domain.command.CAP13.delete"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP13.delete"], input, options),
    "domain.page.CAP14": (
      input: typeof SfDomain.operations["domain.page.CAP14"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.page.CAP14"], input, options),
    "domain.command.CAP14.save": (
      input: typeof SfDomain.operations["domain.command.CAP14.save"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP14.save"], input, options),
    "domain.command.CAP14.delete": (
      input: typeof SfDomain.operations["domain.command.CAP14.delete"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP14.delete"], input, options),
    "domain.page.CAP15": (
      input: typeof SfDomain.operations["domain.page.CAP15"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.page.CAP15"], input, options),
    "domain.command.CAP15.save": (
      input: typeof SfDomain.operations["domain.command.CAP15.save"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP15.save"], input, options),
    "domain.command.CAP15.delete": (
      input: typeof SfDomain.operations["domain.command.CAP15.delete"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP15.delete"], input, options),
    "domain.page.CAP16": (
      input: typeof SfDomain.operations["domain.page.CAP16"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.page.CAP16"], input, options),
    "domain.command.CAP16.save": (
      input: typeof SfDomain.operations["domain.command.CAP16.save"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP16.save"], input, options),
    "domain.command.CAP16.save-item": (
      input: typeof SfDomain.operations["domain.command.CAP16.save-item"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP16.save-item"], input, options),
    "domain.command.CAP16.delete-item": (
      input: typeof SfDomain.operations["domain.command.CAP16.delete-item"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP16.delete-item"], input, options),
    "domain.command.CAP16.save-sub": (
      input: typeof SfDomain.operations["domain.command.CAP16.save-sub"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP16.save-sub"], input, options),
    "domain.command.CAP16.delete-sub": (
      input: typeof SfDomain.operations["domain.command.CAP16.delete-sub"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["domain.command.CAP16.delete-sub"], input, options),
    "projection.local-admin": (
      input: typeof SfDomain.operations["projection.local-admin"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["projection.local-admin"], input, options),
    "dashboard.dashboard-draft-read": (
      input: typeof SfDomain.operations["dashboard.dashboard-draft-read"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["dashboard.dashboard-draft-read"], input, options),
    "dashboard.dashboard-hot-topic-draft-outcome": (
      input: typeof SfDomain.operations["dashboard.dashboard-hot-topic-draft-outcome"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["dashboard.dashboard-hot-topic-draft-outcome"], input, options),
    "dashboard.dashboard-workbench": (
      input: typeof SfDomain.operations["dashboard.dashboard-workbench"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["dashboard.dashboard-workbench"], input, options),
    "dashboard.dashboard-hot-topic-source": (
      input: typeof SfDomain.operations["dashboard.dashboard-hot-topic-source"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["dashboard.dashboard-hot-topic-source"], input, options),
    "dashboard.dashboard-hot-topic-draft": (
      input: typeof SfDomain.operations["dashboard.dashboard-hot-topic-draft"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["dashboard.dashboard-hot-topic-draft"], input, options),
    "dashboard.dashboard-hot-topic-drafts": (
      input: typeof SfDomain.operations["dashboard.dashboard-hot-topic-drafts"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["dashboard.dashboard-hot-topic-drafts"], input, options),
    "dashboard.dashboard-hot-topic-operation": (
      input: typeof SfDomain.operations["dashboard.dashboard-hot-topic-operation"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["dashboard.dashboard-hot-topic-operation"], input, options),
    "dashboard.dashboard-hot-topic-prepare": (
      input: typeof SfDomain.operations["dashboard.dashboard-hot-topic-prepare"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["dashboard.dashboard-hot-topic-prepare"], input, options),
    "dashboard.dashboard-hot-topic-review": (
      input: typeof SfDomain.operations["dashboard.dashboard-hot-topic-review"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["dashboard.dashboard-hot-topic-review"], input, options),
    "dashboard.dashboard-hot-topic-apply": (
      input: typeof SfDomain.operations["dashboard.dashboard-hot-topic-apply"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfDomain.operations["dashboard.dashboard-hot-topic-apply"], input, options),
  } as const
}
