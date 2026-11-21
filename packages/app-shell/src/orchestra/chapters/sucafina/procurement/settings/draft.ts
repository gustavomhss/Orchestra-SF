import { untrack } from "solid-js"
import type { SfPublicDraftController } from "../../context/contracts"
import type { Settings } from "./model"

/** Only source changes drive delivery. Reading and publishing the controller's
 * snapshot must not subscribe the source effect to its own draft updates. */
export function receiveSettingsSource(
  controller: SfPublicDraftController<Settings>,
  remote: Parameters<SfPublicDraftController<Settings>["receiveRemote"]>[0],
) {
  untrack(() => controller.receiveRemote(remote))
}
