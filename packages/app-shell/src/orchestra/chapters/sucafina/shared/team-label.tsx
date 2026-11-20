import { createContext, useContext, type Accessor, type JSX } from "solid-js"

// Presentation only: the label decorates the already admitted Team and grants no access.
const TeamLabel = createContext<Accessor<string>>()
export function SfTeamLabelProvider(props: Readonly<{ label: Accessor<string>; children: JSX.Element }>) {
  return <TeamLabel.Provider value={props.label}>{props.children}</TeamLabel.Provider>
}
export function useSfTeamLabel() { return useContext(TeamLabel) }
