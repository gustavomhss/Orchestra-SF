import { For, Show, type JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import type { SfFilesOperationOutput } from "@orchestra/schema/sucafina/files"
import { importGapLocation, type ImportPreviewChange } from "./preview-location"

type Manifest = Extract<SfFilesOperationOutput<"files.import-preview">, { status: "ok" }>["value"]
type Gap = Manifest["commands"][number]["preview"]["missing"][number]
const changeKinds = ["added", "changed", "removed", "unchanged", "ignored", "rejected"] as const

/** Display only admitted labels/locations; technical references remain intact. */
export function SfImportPreviewGaps(props: Readonly<{
  gaps: readonly Gap[]
  changes: readonly ImportPreviewChange[]
}>): JSX.Element {
  const language = useLanguage()
  const t = (value: string, params?: Record<string, string | number>) =>
    language.t(value as Parameters<typeof language.t>[0], params)
  return <Show when={props.gaps.length > 0}>
    <section class="sf-files-gaps" aria-label={t("sf.u23.gaps")}>
      <h3>{t("sf.u23.gapCount", { count: props.gaps.length })}</h3>
      <ul>
        <For each={props.gaps}>{(gap) => {
          const location = () => importGapLocation(gap.field, props.changes)
          const file = () => {
            const source = location()?.change.source
            return source?.kind === "file" ? source : undefined
          }
          return <li data-sf-import-gap>
            <div class="sf-files-gap-heading">
              <strong><bdi>{file()?.field || t("sf.u23.sourceValue")}</bdi></strong>
              <Show when={location()}>{(value) => <span>{t("sf.u23." + value().side)}</span>}</Show>
            </div>
            <Show when={file()}>
              {(file) => <p class="sf-files-gap-location">{t("sf.u23.changeCell", {
                sheet: file().sheet, row: file().row, column: file().column,
              })}</p>}
            </Show>
            <p>{t("sf.u23.gapReason." + gap.reason)}</p>
            <details class="sf-files-gap-source">
              <summary>{t("sf.u23.sourceDetails")}</summary>
              <dl>
                <dt>{t("sf.u23.fieldReference")}</dt><dd><code>{gap.field}</code></dd>
                <dt>{t("sf.u23.reasonCode")}</dt><dd><code>{gap.reason}</code></dd>
              </dl>
            </details>
          </li>
        }}</For>
      </ul>
    </section>
  </Show>
}

export function SfImportPreviewChanges(props: Readonly<{
  changes: readonly ImportPreviewChange[]
}>): JSX.Element {
  const language = useLanguage()
  const t = (value: string, params?: Record<string, string | number>) =>
    language.t(value as Parameters<typeof language.t>[0], params)
  const entries = (kind: ImportPreviewChange["kind"]) => props.changes.filter((entry) => entry.kind === kind)
  const populated = () => changeKinds.filter((kind) => entries(kind).length > 0)
  const empty = () => changeKinds.filter((kind) => entries(kind).length === 0)
  const display = (value: ImportPreviewChange["before"]) => value.state !== "present"
    ? t("sf.u23." + value.state) : value.value === null ? t("sf.u23.null") : JSON.stringify(value.value)
  return <>
    <Show when={populated().length === 0}><p>{t("sf.u23.noImpact")}</p></Show>
    <For each={populated()}>{(kind) => <details class="sf-files-change-group" data-sf-import-kind={kind}>
      <summary>{t("sf.u23." + kind)} ({entries(kind).length})</summary>
      <For each={entries(kind)}>{(entry) => <article class="sf-files-change">
        <h3>{entry.source.kind === "file" ? t("sf.u23.changeCell", {
          sheet: entry.source.sheet, row: entry.source.row, column: entry.source.column,
        }) : t("sf.u23.sourceChange")}</h3>
        <Show when={entry.source.kind === "file" && entry.source.field}>
          <p class="sf-files-change-label"><bdi>{entry.source.kind === "file" ? entry.source.field : ""}</bdi></p>
        </Show>
        <div class="sf-files-diff">
          <div><h4>{t("sf.u23.before")}</h4><p>{display(entry.before)}</p></div>
          <div><h4>{t("sf.u23.after")}</h4><p>{display(entry.after)}</p></div>
        </div>
        <details class="sf-technical-details">
          <summary>{t("sf.u23.sourceDetails")}</summary>
          <p>{t("sf.u23.fieldReference")}: <code>{entry.path}</code></p>
          <p>{entry.source.kind === "file"
            ? entry.source.sheet + " · " + t("sf.u23.row") + " " + entry.source.row +
              ", " + t("sf.u23.column") + " " + entry.source.column + " · " + entry.source.address
            : entry.source.reference}</p>
        </details>
        <Show when={entry.reason}><p>{entry.reason}</p></Show>
        <Show when={kind === "ignored" || kind === "rejected"}><p>{t("sf.u23.notApplied")}</p></Show>
      </article>}</For>
    </details>}</For>
    <Show when={empty().length > 0}>
      <details class="sf-files-empty-groups">
        <summary>{t("sf.u23.emptyGroups", { count: empty().length })}</summary>
        <ul>
          <For each={empty()}>{(kind) => <li data-sf-import-empty={kind}>
            <span>{t("sf.u23." + kind)}</span>
            <span>{t("sf.u23.noEntries")} · 0</span>
          </li>}</For>
        </ul>
      </details>
    </Show>
  </>
}
