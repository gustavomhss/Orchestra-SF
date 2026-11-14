import type { Application } from "../../runtime/application.ts"

export type SfProductHtml = NonNullable<Application["productHtml"]>

/** Optional private composition hook; the application has already authorized the page. */
export function getSfProductHtml(host: object | undefined): SfProductHtml | undefined {
  if (!host || !("productHtml" in host) || typeof host.productHtml !== "function") return undefined
  return host.productHtml as SfProductHtml
}
