import type { Transcript } from "@orchestra/session-ui/transcript-model"
import type { SfTeamSessionInfo, SfTeamSessionMessage } from "@orchestra/client/sucafina/sessions"

/** Presentation only. Technical placement is retained as provenance, never used
 * to select a Team, issue a Request or decide which transcript may be read. */
export function teamTranscriptSession(info: SfTeamSessionInfo): Transcript.Session {
  return {
    id: info.id, slug: info.id, projectID: info.projectID, directory: info.location.directory,
    workspaceID: info.location.workspaceID, parentID: info.parentID, title: info.title,
    version: "v2", agent: info.agent, model: info.model, cost: info.cost, tokens: info.tokens, time: info.time,
  }
}
export type TeamTranscriptRow =
  | { kind: "message"; id: string; info: Transcript.Message; parts: Transcript.Part[]; attachments: string[] }
  | { kind: "notice"; id: string; type: "system" | "agent-switched" | "model-switched" | "compaction" | "shell"; text: string }

export function teamTranscriptRows(info: SfTeamSessionInfo, messages: readonly SfTeamSessionMessage[]): TeamTranscriptRow[] {
  let parentID = ""
  return messages.map((message): TeamTranscriptRow => {
    const base = { sessionID: info.id, messageID: message.id }
    if (message.type === "user" || message.type === "synthetic") {
      if (message.type === "user") parentID = message.id
      const parts: Transcript.Part[] = [{ ...base, id: message.id + ":text", type: "text", text: message.text,
        ...(message.type === "synthetic" ? { synthetic: true } : {}) }]
      return { kind: "message", id: message.id, parts,
        attachments: message.files?.map((file) => file.name ?? file.uri) ?? [],
        info: { id: message.id, sessionID: info.id, role: "user", time: message.time,
          agent: info.agent ?? "", model: { modelID: info.model?.id ?? "", providerID: info.model?.providerID ?? "" },
          ...(message.type === "user" ? { promptContext: message.promptContext } : {}) } }
    }
    if (message.type !== "assistant") {
      return { kind: "notice", id: message.id, type: message.type,
        text: message.type === "system" ? message.text : message.type === "agent-switched" ? message.agent :
          message.type === "model-switched" ? message.model.providerID + "/" + message.model.id :
          message.type === "compaction" ? message.summary : message.command + "\n" + message.output }
    }
    const attachments: string[] = []
    const parts = message.content.map((content): Transcript.Part => {
      const item = { ...base, id: content.id }
      if (content.type === "text") return { ...item, type: "text", text: content.text }
      if (content.type === "reasoning") return { ...item, type: "reasoning", text: content.text,
        time: { start: content.time?.created ?? message.time.created, end: content.time?.completed }, metadata: content.providerMetadata }
      const state = content.state
      if (state.status !== "pending") {
        for (const file of state.content) if (file.type === "file") attachments.push(file.name ?? file.uri)
        if (state.status === "completed") for (const file of state.attachments ?? []) attachments.push(file.name ?? file.uri)
      }
      const metadata = state.status === "pending" ? {} : {
        ...state.structured, ...(state.status === "completed" || state.status === "error" ? state.metadata : {}),
      }
      const title = typeof metadata.title === "string" ? metadata.title : content.name
      const tool: Transcript.ToolState = state.status === "pending"
        ? { status: "pending", input: {}, raw: state.input }
        : state.status === "running"
          ? { status: "running", input: state.input, metadata, title, time: { start: content.time.ran ?? content.time.created } }
          : state.status === "error"
            ? { status: "error", input: state.input, metadata, error: state.error.message,
              time: { start: content.time.ran ?? content.time.created, end: content.time.completed ?? content.time.created } }
            : { status: "completed", input: state.input, metadata, title,
              output: state.content.flatMap((part) => part.type === "text" ? [part.text] : []).join("\n"),
              time: { start: content.time.ran ?? content.time.created, end: content.time.completed ?? content.time.created,
                compacted: content.time.pruned } }
      return { ...item, type: "tool", callID: content.id, tool: content.name, state: tool }
    })
    return { kind: "message", id: message.id, parts, attachments, info: {
      id: message.id, sessionID: info.id, role: "assistant", time: message.time, parentID,
      modelID: message.model.id, providerID: message.model.providerID, variant: message.model.variant,
      agent: message.agent, mode: message.agent, path: { cwd: info.location.directory, root: info.location.directory },
      cost: message.cost ?? 0, tokens: message.tokens ?? { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      finish: message.finish, ...(message.error ? { error: { name: "UnknownError", data: { message: message.error.message } } } : {}),
    } }
  })
}
