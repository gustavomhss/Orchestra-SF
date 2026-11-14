import { Effect } from "effect"
import { SessionMessage } from "@orchestra/core/session/message"
import type { SessionStore } from "@orchestra/core/session/store"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { SfNativeAdmission, SfSelectedRuntime } from "../../../../modules/sucafina/Sucafinav1/product/contracts/runtime.ts"
import { sfSourceFor } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/resident-agents.ts"
import type { SfLoadedSkillObservation } from "./native-host.ts"

/** Observations originate at the native host after SessionV2 loaded the registered source bytes. */
export function createSfNativeSkillProof(input: {
  ready: () => boolean
  store: () => SessionStore.Interface | undefined
  selectionMatches: (value: SfSelectedRuntime) => boolean
}) {
  const observations = new Map<string, { value: SfLoadedSkillObservation; digest: string }>()
  return {
    observe: (value: SfLoadedSkillObservation) => {
      if (!input.ready() || observations.has(value.session.id) || !input.selectionMatches(value.admission.selected)) throw new Error("SF_SKILL_OBSERVATION_INVALID")
      const proof = { value, digest: digestSfValue({ ...value.admission, request: undefined }) }
      observations.set(value.session.id, proof)
      return () => { if (observations.get(value.session.id) === proof) observations.delete(value.session.id) }
    },
    admissionFor: (sessionID: string) => observations.get(sessionID)?.value.admission,
    verify: async (admission: SfNativeAdmission) => {
      const store = input.store()
      const proof = observations.get(admission.sessionID)
      const receipt = admission.skillReceipts[0]
      if (!input.ready() || !store || !proof || !receipt || admission.skillReceipts.length !== 1 || proof.value.admission.request !== admission.request ||
        proof.digest !== digestSfValue({ ...admission, request: undefined }) || !sfSourceFor(proof.value.sourceCapability, proof.value.skills, admission.selected)) return false
      const skill = await Effect.runPromise(proof.value.skills.get(receipt.skillId))
      const message = await Effect.runPromise(store.message(SessionMessage.ID.make(receipt.loadedMessageId)))
      return !!skill && message?.sessionID === admission.sessionID && message.message.type === "synthetic" &&
        message.message.text.startsWith(`<skill_content name="${skill.name}">\n# Skill: ${skill.name}\n\n${skill.content.trim()}\n\n`) &&
        new Bun.CryptoHasher("sha256").update(await Bun.file(skill.location).arrayBuffer()).digest("hex") === receipt.sourceDigest &&
        new Bun.CryptoHasher("sha256").update(skill.content.trim()).digest("hex") === receipt.instructionsDigest &&
        input.ready() && input.store() === store && observations.get(admission.sessionID) === proof &&
        !!sfSourceFor(proof.value.sourceCapability, proof.value.skills, admission.selected)
    },
    clear: () => observations.clear(),
  }
}
