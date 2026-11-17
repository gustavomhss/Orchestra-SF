// Deployment identity is a separate dimension from the user's theme or palette.
// A white-label build never changes CSS theme choices or emits an Orchestra favicon.
export function applyBrandIdentityToHtml(html, brand, artworkReady = false) {
  if (brand !== "sucafina") return html
  return html
    .replace(/<html\b/, `<html data-orchestra-brand="sucafina" data-sucafina-artwork="${artworkReady ? "ready" : "pending"}"`)
    .replace("<title>HuGR Orchestra</title>", "<title>Sucafina</title>")
    .replace(/<link rel="icon"[^>]*\/>/, '<link rel="icon" type="image/svg+xml" href="/brand/sucafina/favicon.svg" />')
    .replace('href="/site.webmanifest"', 'href="/brand/sucafina/site.webmanifest"')
}
