// A zoom the user asked for. A stale write (a newer zoom already replaced it) is not this request.
// A failed current write reverts the requested factor and is reported. It does not reject.
export function settleZoom(input: {
  write: Promise<void>
  current: () => boolean
  apply: () => void
  revert: () => void
  report: (error: unknown) => void
}) {
  return input.write.then(
    () => {
      if (!input.current()) return false
      input.apply()
      return true
    },
    (error: unknown) => {
      if (!input.current()) return false
      input.revert()
      input.report(error)
      return false
    },
  )
}

// Pinch and repeated keys can fail on the same outage. Log each one. Toast only the first.
export function noteFailedZoom(input: { error: unknown; shown: boolean; report: (error: unknown) => void }) {
  console.error(input.error)
  if (input.shown) return true
  input.report(input.error)
  return true
}
