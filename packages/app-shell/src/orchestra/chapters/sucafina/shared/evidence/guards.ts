// S04 fail-closed presentation guards; they do not grant ACL or source access.
import type { SfEvidence, SfUiState } from "./types"

export function canPresentEvidence(state: SfUiState): boolean {
  return state === "ready" || state === "partial"
}

// Revoked/unavailable items may remain in an owner's redacted result for status
// continuity, but neither title nor private fields/excerpts may be displayed.
export function canInspectEvidence(state: SfUiState, item: SfEvidence): boolean {
  return canPresentEvidence(state) &&
    (item.state === "candidate" || item.state === "confirmed" || item.state === "stale")
}
