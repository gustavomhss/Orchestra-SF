# Focused BI06 capture — PASS

Run [44990477521](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44990477521), test job137110210773 and cleanup137111188106 all succeeded: **1 passed (3.2m)**. Product `01ced03042f396941902820487db67cf469336c4`; snapshot `fa6b988e79c820886ad80f32e66a3ed664ad83c4`; permanent full spec `7d4af62590e256ed9f034fd8a00bbce5694f1c25`; disposable focused overlay `ca59b5b232445687df3169f29c1466989426a484`.

Production runtime is identical to native attempt2. This overlay omits the already-green Portfolio, BI01/catalog and BI11 journeys; it preserves the original BI06 native-body acquisition, source resolution200, wrong-digest403, EN/pt scalar-to-DOM checks, page/console-error checks and external-write guard. No original response was mocked or synthesized, and no readback fallback was used.

The original EN age0.0014994675925925926 days renders0.00149947. The later Portuguese invocation age0.0016391550925925927 days renders0,00163916. Exact source values remain in the original projection; only presentation is rounded to six significant digits. The separate original unit remains `days` in both languages. Both sessions have zero console and page errors.

## Actual visual review

Five JPEGs were emitted individually and manually inspected: light320 plot after alignment, dark390 plot after alignment, pt-BR320 plot/table numbers, pt-BR320 scrolled unit column, and light desktop table. All five are approved for their represented state. The numeric labels are fully visible inside the native horizontal scroller; both decimal separators are legible; the table's unit and period remain visible through horizontal scrolling. Native2's far-end crop is superseded, not silently relabeled as approved. The remaining12 JPEGs are retained without a manual-review claim from this reviewer.

All17 chunk sets are complete. [manifest.json](manifest.json) records each original name, blob, viewport, exact manual-review outcome, source summaries and artifact hash. PNG originals remain in artifact14741114781 (`sha256:48e8b3677bed1e256f53c148887acd19304ca7feca583c57a366d3f0d5c0c577`); these JPEGs persist beyond the artifact retention period.
