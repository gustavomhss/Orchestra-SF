import { plannerMonthlyScript } from "../ui/planner-monthly.ts"

/** Decorate only a document the host has already authorized and rendered. */
export function decorateSfProductHtml(html: string, surface: string, page: string) {
  if (surface !== "planner" || (page !== "OPEX" && page !== "CAPEX")) return html
  return html.replace("</body>", `<script>${plannerMonthlyScript}</script></body>`)
}
