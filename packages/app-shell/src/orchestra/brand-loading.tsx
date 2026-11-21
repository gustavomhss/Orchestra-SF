import { useLanguage } from "@/context/language"
import { HugrSplash } from "./brand"

// Only used for the Sucafina deployment: no fake progress percentage, delays or new glass styling.
export function BrandLoading() {
  const language = useLanguage()
  return (
    <div
      class="fixed inset-0 z-[9999] sucafina-loading"
      data-tauri-drag-region
      data-app-loading
      role="status"
      aria-label={language.t("sf.common.loading")}
    >
      <HugrSplash />
    </div>
  )
}
