import type { Snapshot } from "../../runtime/contract.ts"
import { observeLocalProductRead } from "../../runtime/local-store.ts"
import type { SfStateAuthority, SfStateNamespace } from "../contracts/state.ts"

type AclStateAuthorize = (request: Request, snapshot: Pick<Snapshot, "data">, namespace: SfStateNamespace,
  mode: "read" | "write") => Promise<SfStateAuthority | undefined>
const aclStateAuthorizers = new WeakSet<object>()
const authorizerHas = WeakSet.prototype.has, authorizerAdd = WeakSet.prototype.add, authorizerApply = Reflect.apply
const aclProperty = Object.getOwnPropertyDescriptor, aclPrototype = Object.prototype

/** Construct the restricted wrapper; never mark the caller's function as a read-set proof. */
export function createSfAclStateAuthorize(work: AclStateAuthorize): AclStateAuthorize {
  const authorize: AclStateAuthorize = (request, snapshot, namespace, mode) => {
    const projection = observeLocalProductRead(snapshot)
    // No Snapshot field is prefetched. The installed principal can reject identity
    // or origin before ACL access, and observes access only after authentication.
    // Forward each actual field access with its original receiver and order.
    const data = {
      get roleMap() {
        if (projection && aclProperty(aclPrototype, "roleMap")) throw new Error("SF_PRODUCT_READ_PROJECTION_CHANGED")
        return snapshot.data.roleMap
      },
      get access() {
        if (projection && aclProperty(aclPrototype, "access")) throw new Error("SF_PRODUCT_READ_PROJECTION_CHANGED")
        return snapshot.data.access
      },
    }
    return work(request, { get data() { return data } }, namespace, mode)
  }
  authorizerApply(authorizerAdd, aclStateAuthorizers, [authorize])
  return authorize
}

/** Query only wrappers constructed above; proxies and arbitrary authorizers are unmarked. */
export function isSfAclStateAuthorize(authorize: unknown): boolean {
  return typeof authorize === "function" && authorizerApply(authorizerHas, aclStateAuthorizers, [authorize])
}
