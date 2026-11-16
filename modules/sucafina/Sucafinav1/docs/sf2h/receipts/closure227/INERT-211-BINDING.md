# Mission 227 — complete inert F01 host-binding adapter for 211

**Status:** INERT; outside 227 lease. This file is a ready-to-apply adapter
contract, not a simulated host registration, not a grant, and not a change to
the already-open PR191 branch.

## Exact preconditions

* Source 227 provides `SfContextDependencies.navigation?: SfNativeNavigationState`
  in `context/contracts.ts`, and `SfContextProvider` already installs a
  real `SfTodayResumePort` only when that property exists.
* The genuine F01 navigation instance is a singleton owned by the **same
  original installation/principal and shell route controller** as the existing
  resolver. It is created by `createSfNavigationState` with live callbacks
  `resolveAuthorizedRoute`, `selected`, `currentHref`,
  `currentOwnerKey`, `hasDirtyDrafts`, `confirmDiscard`,
  `invalidateOwner`, `commit`, and `validateRetained`.
  Do not populate these from UI29, title, URL query, a fake adapter or another
  installation. Reuse the existing host's F01 composition.
* Host binding is not present in 227's base `chapter-route.tsx`
  (observed blob `f22a07f31ed99055d30cd360fcdc6a1d1f365d99`).
  In particular the 998f0afd product base does **not** register
  `sf-home` and `sf-decisions` there. 211 must compose those original
  chapters and the actual native F01 provider using its real host authority.
* Nothing in this patch grants `UI34`. An authenticated original
  `projection.case` with matching case/version/incarnation **and**
  `resolveAuthorizedRoute` admission are mandatory at runtime.

## Complete add-only adapter postimage for 211

**Target (new file, currently absent):**
`packages/app-shell/src/orchestra/chapters/sucafina/host/today-resume-binding.tsx`

```tsx
import type { Accessor, JSX } from "solid-js"
import { SfContextProvider } from "../context"
import type {
  SfContextDependencies, SfOwnerSelection,
} from "../context/contracts"
import type { SfNativeNavigationState } from "../navigation-state"

/**
 * The root passes the existing, genuine F01 navigation instance. This adapter
 * never creates an alternate router, identity, transport or installation.
 * Preserve identity of the navigation object across sf-home/UI34/back.
 */
export function SfTodayBoundOwnerProvider(props: Readonly<{
  selection: Accessor<SfOwnerSelection>
  dependencies: SfContextDependencies
  ownerNavigation: SfNativeNavigationState
  children: JSX.Element
}>) {
  const dependencies: SfContextDependencies = Object.freeze({
    ...props.dependencies,
    navigation: props.ownerNavigation,
  })
  return (
    <SfContextProvider selection={props.selection} dependencies={dependencies}>
      {props.children}
    </SfContextProvider>
  )
}
```

This is a complete type-only/host adapter; it is deliberately inert until 211
uses it to replace its **existing F01 context provider callsite**. The exact
replacement at that callsite is:

```tsx
// PRE: <SfContextProvider selection={ownerSelection} dependencies={realDependencies}>
//        {nativeChapter}
//      </SfContextProvider>
//
// POST: <SfTodayBoundOwnerProvider
//         selection={ownerSelection}
//         dependencies={realDependencies}
//         ownerNavigation={ownerNavigation}
//       >
//         {nativeChapter}
//       </SfTodayBoundOwnerProvider>
```

`ownerSelection`, `realDependencies`, `ownerNavigation` and
`nativeChapter` above **must be the variables from 211's actual F01
composition**; 227 has no authority to invent implementations for them.
Do not create new callbacks or bypass an absent `ownerNavigation`.

## Postconditions and gate

1. Same single owner navigation controls URL, native route admission,
   invalidation, retained views and one-shot return/focus; no second controller.
2. UI29 Home's existing `hasResumePort` becomes true **only after** binding;
   `projection.case` executes two authentic GETs with current generation and
   source incarnation/version; UI34 is F01-admitted by the same shell controller.
3. If host/provider is absent or revoked, Home continues to show its approved
   unavailable/blocked state, not a fabricated case.
4. No generated SDK, HttpApi, public transport, Azure, Electron bootstrap,
   guard or foreign branch changes are licensed by this adapter.
5. 211 records actual consumed 227 blob SHAs, its new candidate C SHA/tree
   and the real host composition pre/post. 190 owns compiler, 223 owns CI,
   207 rechecks. **GLOBAL_RELEASE remains false.**

## 227 own observed pre/post

- `context/contracts.ts`: `592eef8206c665a1fc908934e258b286fe85609e` ->
  `876f95feadd07d6628d13a6c34e454a5ce382ea4`
- `context/index.tsx`: `8b949f966725f8a7d22a486e3391f79deecce258` ->
  `2a993c4d30e63cb534326d5586fe2c871b340d1b`
- `navigation-state/index.ts`: `23a5da80dd837d5113e53ba6ece1ada5e97d0a0a` ->
  `6e74148eb42efb18f15ecf25d098cbe1bf5f038d`
- `navigation-state/resume.ts`: no preimage ->
  `44c3ad22099b2a20047fe79dbc058cc7a37bbd63`

No host file was edited on 227. It is forbidden to present this inert
postimage as an installed desktop D01 proof or a finished 211 binding.
