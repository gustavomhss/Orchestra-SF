// Brand identity is deployment-owned. The user's selected Orchestra theme is independent.
export function hasSucafinaArtwork() {
  return typeof document !== "undefined" && document.documentElement.dataset.sucafinaArtwork === "ready"
}

export function isSucafinaBrand() {
  return typeof document !== "undefined" && document.documentElement.dataset.orchestraBrand === "sucafina"
}
