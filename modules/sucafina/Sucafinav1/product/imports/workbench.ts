import { documentHtml, pageMain } from "../../src/screen-shell.ts"
import { htmlPolicy } from "../../runtime/application.ts"
import { importWorkbenchScript } from "./workbench-script.ts"
import { importAnalysisMarkup } from "./analysis-workbench.ts"

/** This page uses only the authorized import HTTP port; file bytes stay in the human flow. */
export function renderSfImportWorkbench(surface: string) {
  const options = surface === "planner"
    ? `<label><input name="newVersion" type="checkbox">Create a new Planner version</label><label><input name="removeMissing" type="checkbox">Remove records missing from supplied sheets</label>`
    : `<label data-replace-option hidden><input name="replace" type="checkbox">Replace existing members or projects</label>`
  const body = `<p><a href="?sf=workbench">Workbench</a></p><section data-import-workbench>
    <h1>Import with impact preview</h1><p>Choose a destination, review the simulation and apply it explicitly. Previewing never applies domain changes.</p>
    <label>Period start<input data-period-start type="date"></label><label>Period end<input data-period-end type="date"></label>
    <button type="button" data-find>Find destinations</button>
    <form data-import-form><label for="sf-import-target">Destination</label><select id="sf-import-target" name="target" required><option value="">Choose a destination</option></select>
    <label>File<input name="file" type="file" accept=".xlsx,.xls,.json" required></label>
    ${options}
    <button type="submit">Preview changes</button></form>
    <p role="status" aria-live="polite"></p><section data-context></section><section data-impact></section>
    <section data-changes></section><section data-receipt></section>
    <button type="button" data-cancel disabled>Cancel preview</button><button type="button" data-repreview disabled>Refresh destination and preview again</button>
    <button type="button" data-apply disabled>Apply reviewed import</button><button type="button" data-receipt-retry disabled>Refresh receipt</button>
    ${importAnalysisMarkup}
  </section>`
  const html = documentHtml("Imports", surface, "", pageMain({ drawn: true, key: "Imports", index: 0 }, body), "")
    .replace("</body>", `<script>${importWorkbenchScript}</script></body>`)
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": htmlPolicy(html), "X-Content-Type-Options": "nosniff" } })
}
