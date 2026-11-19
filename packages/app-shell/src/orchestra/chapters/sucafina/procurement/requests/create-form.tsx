export function SfRequestsCreateForm() {
  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    const form = event.currentTarget
    if (!(form instanceof HTMLFormElement)) return
    const values: Record<string, unknown> = {}
    const assign = (name: string, value: unknown) => {
      const path = name.split(".")
      let node: Record<string, unknown> = values
      for (let index = 0; index < path.length - 1; index++) {
        const key = path[index]!
        const next = node[key]
        node[key] = next && typeof next === "object" ? next : {}
        node = node[key] as Record<string, unknown>
      }
      node[path[path.length - 1]!] = value
    }
    for (const input of form.elements) {
      if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement)) continue
      if (!input.name || input.disabled) continue
      assign(input.name, input instanceof HTMLInputElement && input.type === "checkbox" ? input.checked : input.type === "number" ? (input.value === "" ? null : Number(input.value)) : input.value)
    }
    await fetch(location.pathname, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        page: form.dataset.page,
        action: form.dataset.command,
        id: form.dataset.record || undefined,
        version: Number(form.dataset.version || "0"),
        values,
      }),
    })
  }
  return (
    <section>
      <h1>Requests</h1>
      <form data-command="create" data-page="Requests" data-record="" data-version="0" onSubmit={submit}>
        <label>Title<input name="pr.title" type="text" /></label>
        <label>Type<select name="pr.type"><option value="">Choose…</option><option value="product">product</option><option value="service">service</option></select></label>
        <label>Description<textarea name="pr.description" /></label>
        <label>Estimated amount<input name="pr.estAmount" type="number" step="any" /></label>
        <label>Cost centre<input name="pr.costCenter" type="text" /></label>
        <label>Needed by<input name="pr.needBy" type="date" /></label>
        <label>Justification<textarea name="pr.justification" /></label>
        <button type="submit">Create request</button>
      </form>
    </section>
  )
}
