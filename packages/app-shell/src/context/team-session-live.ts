import type { SessionEvent } from "@orchestra/schema/session-event"
import type { SessionMessage } from "@orchestra/schema/session-message"
import type { SfTeamSessionMessage } from "@orchestra/client/sucafina/sessions"

type Assistant = typeof SessionMessage.Assistant.Encoded
type Content = typeof SessionMessage.AssistantContent.Encoded
type NativeEvent = typeof SessionEvent.All.Encoded

/** Live text is an overlay on authoritative message reads, scoped by the caller's
 * verified namespace. Deltas never append to an HTTP snapshot with an unknown
 * watermark: only a start observed on this stream admits incremental fragments.
 * Durable end events supply full values and repair interrupted/late hydration. */
export function createTeamSessionLive() {
  const overlays = new Map<string, Assistant>(), starts = new Set<string>(), ended = new Set<string>(), seen = new Set<string>()
  const key = (message: string, part: string) => JSON.stringify([message, part])
  const assistant = (id: string, snapshot: readonly SfTeamSessionMessage[]) => {
    const known = overlays.get(id)
    if (known) return known
    const base = snapshot.find((value) => value.id === id)
    if (base?.type !== "assistant") return
    const value: Assistant = { type: "assistant", id: base.id, agent: base.agent, model: base.model,
      time: { created: base.time.created }, content: [] }
    overlays.set(id, value)
    return value
  }
  const put = (value: Assistant, part: Content) => {
    const exists = value.content.some((item) => item.id === part.id)
    const content = exists ? value.content.map((item) => item.id === part.id ? part : item) : [...value.content, part]
    if (content.length > 2000 || content.reduce((size, item) => size + (item.type === "tool" ? 0 : item.text.length), 0) > 2 * 1024 * 1024)
      throw new Error("TEAM_SESSION_LIVE_BOUND")
    overlays.set(value.id, { ...value, content })
  }
  return {
    apply(event: NativeEvent, snapshot: readonly SfTeamSessionMessage[]) {
      if (seen.has(event.id)) return false
      if (seen.size >= 65536) throw new Error("TEAM_SESSION_EVENT_BOUND")
      seen.add(event.id)
      const data = event.data
      if (event.type === "session.next.step.started") {
        if (!overlays.has(event.data.assistantMessageID)) overlays.set(event.data.assistantMessageID, {
          type: "assistant", id: event.data.assistantMessageID, agent: event.data.agent, model: event.data.model,
          time: { created: event.data.timestamp }, content: [],
        })
        return true
      }
      if (!("assistantMessageID" in data)) return false
      if (event.type === "session.next.text.delta" && !starts.has(key(data.assistantMessageID, event.data.textID)) ||
          event.type === "session.next.reasoning.delta" && !starts.has(key(data.assistantMessageID, event.data.reasoningID))) return false
      const value = assistant(data.assistantMessageID, snapshot)
      if (!value) return false
      if (event.type === "session.next.step.ended") {
        overlays.set(value.id, { ...value, finish: event.data.finish, cost: event.data.cost, tokens: event.data.tokens,
          time: { ...value.time, completed: event.data.timestamp } })
        return true
      }
      if (event.type === "session.next.step.failed") {
        overlays.set(value.id, { ...value, finish: "error", error: event.data.error,
          time: { ...value.time, completed: event.data.timestamp } })
        return true
      }
      if (event.type === "session.next.text.started") {
        const stamp = key(value.id, event.data.textID)
        if (!starts.has(stamp) && !ended.has(stamp)) {
          starts.add(stamp); put(value, { type: "text", id: event.data.textID, text: "" })
        }
        return true
      }
      if (event.type === "session.next.text.delta") {
        const stamp = key(value.id, event.data.textID)
        if (!starts.has(stamp) || ended.has(stamp)) return false
        const part = value.content.find((item) => item.id === event.data.textID)
        if (part?.type !== "text") return false
        put(value, { ...part, text: part.text + event.data.delta }); return true
      }
      if (event.type === "session.next.text.ended") {
        ended.add(key(value.id, event.data.textID))
        put(value, { type: "text", id: event.data.textID, text: event.data.text }); return true
      }
      if (event.type === "session.next.reasoning.started") {
        const stamp = key(value.id, event.data.reasoningID)
        if (!starts.has(stamp) && !ended.has(stamp)) {
          starts.add(stamp); put(value, { type: "reasoning", id: event.data.reasoningID, text: "",
            time: { created: event.data.timestamp }, providerMetadata: event.data.providerMetadata })
        }
        return true
      }
      if (event.type === "session.next.reasoning.delta") {
        const stamp = key(value.id, event.data.reasoningID)
        if (!starts.has(stamp) || ended.has(stamp)) return false
        const part = value.content.find((item) => item.id === event.data.reasoningID)
        if (part?.type !== "reasoning") return false
        put(value, { ...part, text: part.text + event.data.delta }); return true
      }
      if (event.type === "session.next.reasoning.ended") {
        const part = value.content.find((item) => item.id === event.data.reasoningID)
        ended.add(key(value.id, event.data.reasoningID))
        put(value, { type: "reasoning", id: event.data.reasoningID, text: event.data.text,
          providerMetadata: event.data.providerMetadata,
          time: { created: part?.type === "reasoning" ? part.time?.created ?? value.time.created : value.time.created,
            completed: event.data.timestamp } })
        return true
      }
      return false
    },
    merge(snapshot: readonly SfTeamSessionMessage[]): SfTeamSessionMessage[] {
      const result = new Map(snapshot.map((message) => [message.id, message]))
      for (const value of overlays.values()) {
        const base = result.get(value.id)
        if (base?.type === "assistant") {
          const content = new Map(base.content.map((part) => [part.id, part]))
          for (const part of value.content) {
            const current = content.get(part.id)
            // A concurrent HTTP read can be ahead of this stream. Until an
            // explicit full-value end, do not replace its text with a shorter
            // partial overlay or append against an unknown watermark.
            if (current && current.type !== "tool" && part.type !== "tool" &&
                !ended.has(key(value.id, part.id)) &&
                (part.text.length < current.text.length || !part.text.startsWith(current.text))) continue
            content.set(part.id, part)
          }
          result.set(value.id, { ...base, ...value, time: { ...base.time, ...value.time },
            cost: value.cost ?? base.cost, tokens: value.tokens ?? base.tokens,
            finish: value.finish ?? base.finish, error: value.error ?? base.error, content: [...content.values()] })
          if (base.time.completed !== undefined && value.time.completed !== undefined &&
              base.time.completed >= value.time.completed && value.content.every((part) =>
                base.content.some((item) => item.type === part.type && item.id === part.id &&
                  item.type !== "tool" && part.type !== "tool" && item.text === part.text))) {
            overlays.delete(value.id)
            for (const part of value.content) { const stamp = key(value.id, part.id); starts.delete(stamp); ended.delete(stamp) }
          }
        } else if (!base) result.set(value.id, value)
      }
      return [...result.values()].sort((left, right) => left.time.created - right.time.created || left.id.localeCompare(right.id))
    },
    clear() { overlays.clear(); starts.clear(); ended.clear(); seen.clear() },
  }
}
