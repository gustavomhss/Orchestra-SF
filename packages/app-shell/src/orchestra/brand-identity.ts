// Brand identity is deployment-owned. The user's selected Orchestra theme is independent.
export function isSucafinaBrand() {
  return typeof document !== "undefined" && document.documentElement.dataset.orchestraBrand === "sucafina"
}
