# Sucafina brand identity — separate from Orchestra themes

## Contract

**Brand** = deployment-owned company identity. **Theme** = user-selected Orchestra appearance. Neither may overwrite the other.

The existing Orchestra palette catalog, theme picker, colors, glass, blur, borders, shadows, geometry, typography, route hierarchy and business flows are not modified by this implementation. No new Sucafina palette is registered.

A Sucafina web distribution opts in at build time with `ORCHESTRA_BRAND=sucafina`. This produces a Sucafina tab title, installation manifest, company identity marker and a discreet loading treatment. The default distribution retains HuGR and all existing visuals. Any palette can be selected inside the Sucafina distribution without reverting the brand.

### Unfinished assets — release blocker

The official Sucafina mark, lockups and favicon require approved original artwork; none are generated or traced. See `packages/app-shell/public/brand/sucafina/README.md`. Currently the UI uses plain text in the logo slots as an explicit fallback. PWA icons and favicon are deliberately not fabricated. **Do not mark white-label complete or deploy this distribution as final until approved assets are provided, hooked into the head/manifest and reviewed.**

The previously discussed photographic background also needs a licensed/original asset and a true Orchestra screenshot for visual validation. Do not ship AI-generated UI screenshots as layouts or arbitrarily replace the existing wallpaper.

### Acceptance gates

1. Verify Sucafina logo and company name in full/compact sidebar, splash, connection error, browser tab, favicon, notifications, PWA installation and any customer-visible header/footer.
2. Verify all pre-existing Orchestra palettes (system, dark, light, graphite, gruvbox, github, nord, amoled) remain selectable and never switch brand identity.
3. Pixel-diff real Orchestra-SF before/after: page geometry, glass, blur, panels, shadows, navigation, charts, procurement, planner and admin unchanged.
4. Test web desktop/mobile and reduced-motion, failure/loading and auth states. No artificial loading delay, invented dashboard, neon accent or new glass rule.
5. Do not merge until official assets and visual evidence pass; no changes to go-live assembly branch.
