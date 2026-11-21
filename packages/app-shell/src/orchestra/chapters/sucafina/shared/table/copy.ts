import { useLanguage } from "@/context/language"
import type { SfCopyKey, SfMessage, SfText, SfUiState } from "./contracts"

export const sfS01Key = (key: string): SfCopyKey => key as SfCopyKey

// Locale selection, interpolation and fallback belong to Orchestra's shared typed i18n service.
// The F03/I00 registration publishes these frozen sf.common and S01 leaf keys.
export function useSfS01Copy() {
  const language = useLanguage()
  const t = (key: SfCopyKey, params?: Readonly<Record<string, string | number>>) =>
    language.t(key as Parameters<typeof language.t>[0], params)
  const message = (value: SfMessage) => t(value.key, value.params)
  const text = (value: SfText) => value.kind === "data" ? value.text : message(value.message)
  return { t, message, text, intl: language.intl }
}

export function sfS01StateKey(state: SfUiState): SfCopyKey {
  switch (state) {
    case "loading": return sfS01Key("sf.common.loading")
    case "empty": return sfS01Key("sf.common.empty")
    case "filtered-empty": return sfS01Key("sf.common.filterEmpty")
    case "partial": return sfS01Key("sf.common.partial")
    case "not-found": return sfS01Key("sf.common.removed")
    case "stale": return sfS01Key("sf.common.stale")
    case "conflict": return sfS01Key("sf.common.conflict")
    case "denied": return sfS01Key("sf.common.noAccess")
    case "session-expired": return sfS01Key("sf.common.loginAgain")
    case "outcome-unknown": return sfS01Key("sf.common.operationUnknown")
    case "invalid": return sfS01Key("sf.common.invalidLink")
    case "unavailable": return sfS01Key("sf.common.unavailable")
    case "ready": return sfS01Key("sf.common.unknown")
  }
}
