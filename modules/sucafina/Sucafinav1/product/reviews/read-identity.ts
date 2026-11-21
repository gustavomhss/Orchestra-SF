import { types } from "node:util"

/** A structural admission/egress fence, never an authority or purity proof.
 * Unknown objects retain their original call; getters/proxy traps are not read. */
export function pinReviewReadProperties<Owner extends object, Name extends keyof Owner>(owner: Owner, names: readonly Name[]) {
  if (!owner || typeof owner !== "object" || types.isProxy(owner)) return undefined
  const prototype = Object.getPrototypeOf(owner)
  if (prototype !== Object.prototype) return undefined
  const descriptors = names.map((name) => [name, Object.getOwnPropertyDescriptor(owner, name)] as const)
  if (descriptors.some(([name, descriptor]) => descriptor ? !("value" in descriptor) : name in owner)) return undefined
  const values = Object.freeze(Object.fromEntries(descriptors.map(([name, descriptor]) => [name, descriptor?.value])) as Pick<Owner, Name>)
  return { values, current: () => Object.getPrototypeOf(owner) === prototype && descriptors.every(([name, prior]) => {
    const current = Object.getOwnPropertyDescriptor(owner, name)
    return prior ? !!current && "value" in current && current.value === prior.value : current === undefined && !(name in owner)
  }) }
}
