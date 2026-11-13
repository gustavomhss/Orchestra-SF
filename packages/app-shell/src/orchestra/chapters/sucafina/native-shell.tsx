import { For, Show } from "solid-js"
import { MxPage } from "../kit"
import type { NativeShellProps } from "./shell-contract"

export function NativeShell(props: NativeShellProps) {
  const state = () => props.controller.state()
  const busy = () => state().loading || state().saving
  const labels = { dashboard: "Dashboard", planner: "Planner", procurement: "Procurement" }

  return (
    <MxPage id="sucafina" title={state().page?.page ?? "Sucafina"} description="Explore and manage Sucafina information.">
      <div class="mx-card">
        <div class="mx-fields">
          <label class="mx-field">
            <span>Application</span>
            <select
              value={props.surface}
              disabled={props.surfaces.length === 0}
              onChange={(event) => {
                const surface = props.surfaces.find((item) => item === event.currentTarget.value)
                if (surface) props.onSurface(surface)
              }}
            >
              <For each={props.surfaces}>{(surface) => <option value={surface}>{labels[surface]}</option>}</For>
            </select>
          </label>
          <Show when={state().page}>
            {(page) => (
              <label class="mx-field">
                <span>Page</span>
                <select
                  value={page().page}
                  onChange={(event) => {
                    const selected = event.currentTarget.value
                    if (page().pages.includes(selected)) props.onPage(selected)
                  }}
                >
                  <For each={page().pages}>{(item) => <option value={item}>{item}</option>}</For>
                </select>
              </label>
            )}
          </Show>
        </div>
        <Show when={state().page}>
          {(page) => (
            <>
              <div class="mx-meta">
                <span>Signed in as <bdi>{page().actor.name}</bdi></span>
                <Show when={!page().actor.canWrite}><span class="mx-badge">Read-only</span></Show>
                <Show when={state().draft}><span class="mx-badge">Unsaved changes</span></Show>
              </div>
              {props.filters}
            </>
          )}
        </Show>
        <div class="mx-meta">
          <button
            type="button"
            class="mx-btn primary"
            disabled={busy() || !state().page?.actor.canWrite || !state().draft || state().draft?.page !== state().page?.page}
            onClick={() => void props.controller.save()}
          >
            Save
          </button>
          <button type="button" class="mx-btn" disabled={busy()} onClick={() => void props.controller.refresh()}>
            Refresh
          </button>
          <Show when={state().draft || state().conflict}>
            <button type="button" class="mx-btn" disabled={busy()} onClick={() => void props.controller.discardDraft()}>
              Discard changes and reload
            </button>
          </Show>
          <Show when={state().saving}><span role="status">Saving…</span></Show>
          <Show when={state().loading}><span role="status">Loading…</span></Show>
        </div>
      </div>
      <Show when={state().warnings.length > 0}>
        <div class="mx-card" role="status">
          <For each={state().warnings}>{(warning) => <p>{warning}</p>}</For>
        </div>
      </Show>
      <Show when={state().error}>
        {(error) => (
          <div class="mx-empty" role="alert">
            <strong>{error().message}</strong>
            <For each={error().detail?.errors}>{(detail) => <p>{detail}</p>}</For>
          </div>
        )}
      </Show>
      <Show when={state().conflict}>
        {(conflict) => (
          <div class="mx-empty" role="alert">
            <strong>Changes conflict with a newer version.</strong>
            <p>{conflict().message}</p>
            <Show when={conflict().detail?.by}>{(by) => <p>Last changed by <bdi>{by()}</bdi>.</p>}</Show>
          </div>
        )}
      </Show>
      <Show when={state().page} fallback={
        <Show when={!state().loading && !state().error && !state().conflict}>
          <div class="mx-empty" role="status">No page is available.</div>
        </Show>
      }>
        {(page) => props.children(page())}
      </Show>
    </MxPage>
  )
}
