import { plannerMonthlyScript } from "../ui/planner-monthly.ts"
import { personalViewsScript, personalViewsWidget } from "../ui/personal-views.ts"
import { importPreviewScript, importPreviewWidget } from "../ui/import-preview.ts"
import { documentEvidenceScript, documentEvidenceWidget } from "../ui/document-evidence.ts"
import { dashboardWorkbenchScript, dashboardWorkbenchWidget } from "./dashboard-workbench.ts"

/** Decorate only a document the host has already authorized and rendered. */
export function decorateSfProductHtml(html: string, surface: string, page: string) {
  if (!["dashboard", "planner", "procurement"].includes(surface)) return html
  const script = `;(() => { const initialize = () => {${personalViewsScript}${documentEvidenceScript}${surface === "planner" && (page === "OPEX" || page === "CAPEX") ? plannerMonthlyScript : ""}${surface === "planner" || surface === "dashboard" ? importPreviewScript : ""}${surface === "dashboard" ? dashboardWorkbenchScript : ""}}; initialize(); const root = document.querySelector('#content'); if (root) new MutationObserver(initialize).observe(root, { childList: true, subtree: true }) })();`
  return html.replace('<div class="workspace-tools">', '<div class="workspace-tools"><a href="?sf=workbench">Workbench</a>').replace("</main>", `${personalViewsWidget({ surface, page })}${documentEvidenceWidget}${surface === "planner" || surface === "dashboard" ? importPreviewWidget : ""}${surface === "dashboard" ? dashboardWorkbenchWidget(page) : ""}</main>`).replace("</body>", `<script>${script}</script></body>`)
}
