# Sucafina brand identity — separate from Orchestra themes

## Contract

**Brand** = deployment-owned company identity. **Theme** = user-selected Orchestra appearance. Neither may overwrite the other.

The existing Orchestra palette catalog, theme picker, colors, glass, blur, borders, shadows, geometry, typography, route hierarchy and business flows are not modified by this implementation. No new Sucafina palette is registered.

A Sucafina web distribution opts in at build time with `ORCHESTRA_BRAND=sucafina`. This produces a Sucafina tab title, installation manifest, company identity marker and a discreet loading treatment. The default distribution retains HuGR and all existing visuals. Any palette can be selected inside the Sucafina distribution without reverting the brand.

### Official identity asset provenance

The actual `group.sucafina.com/img/base/logo.svg` has now been retrieved, verified and versioned. See `packages/app-shell/public/brand/sucafina/README.md`. Dark/compact derivatives preserve the source vector paths and require brand-owner final approval. Favicon/PWA now use the real mark crop.

The previously discussed photographic background also needs a licensed/original asset and a true Orchestra screenshot for visual validation. Do not ship AI-generated UI screenshots as layouts or arbitrarily replace the existing wallpaper.

### Acceptance gates

1. Verify Sucafina logo and company name in full/compact sidebar, splash, connection error, browser tab, favicon, notifications, PWA installation and any customer-visible header/footer.
2. Verify all pre-existing Orchestra palettes (system, dark, light, graphite, gruvbox, github, nord, amoled) remain selectable and never switch brand identity.
3. Pixel-diff real Orchestra-SF before/after: page geometry, glass, blur, panels, shadows, navigation, charts, procurement, planner and admin unchanged.
4. Test web desktop/mobile and reduced-motion, failure/loading and auth states. No artificial loading delay, invented dashboard, neon accent or new glass rule.
5. Do not merge until official assets and visual evidence pass; no changes to go-live assembly branch.

Brand-specific assertions run separately via `node --test script/sucafina/brand-identity.test.mjs` and `sucafina-brand-identity` Actions. The SF app source suite has a signed exact historical case inventory; do not widen or weaken it to admit brand tests without review.
