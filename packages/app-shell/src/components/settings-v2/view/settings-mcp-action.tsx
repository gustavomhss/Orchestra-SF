import { Match, Switch } from "solid-js"
import { MxToggle } from "@/orchestra/chapters/kit"
import { mcpAction, type McpStatus } from "@/orchestra/chapters/mcp-model"

export function SettingsMcpAction(props: {
  status: McpStatus["status"]
  busy: boolean
  authenticateLabel: string
  retryLabel: string
  toggleLabel: string
  onAction: () => void
}) {
  const action = () => mcpAction(props.status)
  return (
    <Switch>
      <Match when={action() === "authenticate"}>
        <button type="button" class="mx-btn" disabled={props.busy} onClick={props.onAction}>
          {props.authenticateLabel}
        </button>
      </Match>
      <Match when={props.status === "failed"}>
        <button type="button" class="mx-btn" disabled={props.busy} onClick={props.onAction}>
          {props.retryLabel}
        </button>
      </Match>
      <Match when={props.status !== "needs_client_registration"}>
        <MxToggle
          checked={props.status === "connected"}
          label={props.toggleLabel}
          disabled={props.busy || !action()}
          onChange={props.onAction}
        />
      </Match>
    </Switch>
  )
}
