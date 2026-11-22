import type { SfDomainPageData } from "@orchestra/schema/sucafina/domain"
import type { SfExecutiveRecord } from "../../cross-links/contract"

type Signal = NonNullable<typeof SfDomainPageData.CAP01.Type.signals>[number]

/** Bounded presentation IDs, never a source admission or a producer query. */
export function parseSfSignalPriorities(values: readonly string[]): readonly string[] | undefined {
  if (values.length > 32 || new Set(values).size !== values.length ||
      values.some((value) => value.length > 512 || !/^(?:hotTopics|risks|contracts):[^\u0000-\u001f\u007f]+$/.test(value) ||
        value.trim() !== value || !value.slice(value.indexOf(":") + 1).trim())) return
  return Object.freeze([...values])
}

/** Keep the canonical eligible inventory and its order within each priority group. */
export function sfExecutiveSignals(source: readonly Signal[], priorities: readonly string[]): readonly Signal[] {
  const selected = new Set(priorities)
  return [...source.filter((item) => selected.has(item.id)), ...source.filter((item) => !selected.has(item.id))]
}

/** Only installed native record routes are offered; labels never become IDs. */
export function sfExecutiveSignalTarget(signal: Signal): SfExecutiveRecord | undefined {
  if (signal.page === "IT Risks" && signal.id === "risks:" + signal.recordId)
    return { kind: "risk", ref: signal.recordId }
  if (signal.page === "Hot Topics & Actions" && signal.id === "hotTopics:" + signal.recordId)
    return { kind: "topic", ref: signal.recordId }
}
