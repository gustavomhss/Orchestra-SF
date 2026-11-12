const saved = new Map<string, string>()

export function rememberQuestion(id: string, text: string) {
  saved.set(id, text)
}

export function questionLabel(id: string) {
  return saved.get(id)
}
