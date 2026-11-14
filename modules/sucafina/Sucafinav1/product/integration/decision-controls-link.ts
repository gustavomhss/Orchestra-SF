/** Add a static destination to the document the application has already authorized. */
export function decorateSfDecisionControlsHtml(html: string, surface: string) {
  return ["dashboard", "planner", "procurement"].includes(surface)
    ? html.replace("</main>", '<nav aria-label="Controles de decisão"><a href="?sf=decision-controls">Controles da decisão</a></nav></main>')
    : html
}
