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
