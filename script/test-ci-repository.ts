// Orchestra-SF owns its CI snapshots. Never fall back to the source repository's remote.
export const ciRepository = { name: "gustavomhss/Orchestra-SF", id: 1455724710 } as const

export function requireCiOrigin(origin: string, configured?: string) {
  if (configured !== undefined && configured !== ciRepository.name)
    throw new Error("Orchestra-SF CI refuses another repository override")
  if (
    origin !== "git@github.com:gustavomhss/Orchestra-SF.git" &&
    origin !== "git@github.com:gustavomhss/Orchestra-SF" &&
    origin !== "https://github.com/gustavomhss/Orchestra-SF.git" &&
    origin !== "https://github.com/gustavomhss/Orchestra-SF"
  ) throw new Error("Orchestra-SF CI requires origin to point at its exact destination")
  return ciRepository.name
}

export function requireCiIdentity(value: unknown) {
  if (value === null || typeof value !== "object" ||
    !("full_name" in value) || value.full_name !== ciRepository.name ||
    !("id" in value) || value.id !== ciRepository.id)
    throw new Error("Orchestra-SF CI repository name and numeric ID must match")
  return ciRepository.name
}
