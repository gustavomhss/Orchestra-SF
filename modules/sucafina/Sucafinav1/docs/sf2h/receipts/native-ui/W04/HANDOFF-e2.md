# W04 / F03 e2 — ARTIFACT_READY, entrega para 114

**Autoria material concluída** em `sf-ux-w04`, PR #129, epoch `ux-native-w04-e2`. **Não integrada nem qualificada.** GitHub actor `gustavomhss`, modelo efetivo `GPT-6`, label pedido Astra, session ID não exposto. ACK real no commit `8ecdb063`, após fence `dae7d74`; S0 admission `8852ed4`. e1 revogado, preservado integralmente.

## Arquivos e commits efetivos

- `33df9db105587dbbf290da391653eeab90e269b5`: instalados **8/8** arquivos históricos da proposta F03 nos paths exclusivos, todos com preimage `ABSENT` no fence.
- `e2c2ff9d832b258a3b12f05890fb18a9c93bb9cf`: protege contexto de chart denied/session-expired; remove menu mobile com rótulo semanticamente errado/ações duplicadas; preserva controles secundários no reflow; SELECT emite só request ao owner e mantém seleção autorizada; unadmitted não exibe modelSession; DOM tests de privacidade e seleção.
- `cb00639ad4e698f8e0b67c3fa7c3f441a5f5baed`: aplica errata verificável e1 para tipos importados diretamente de `@orchestra/schema/sucafina/context` (W02 schema pin `423050658692902ddb94358574762906fc06ccff`) e corrige `cwd` do hosted Bun test para `../..`; adiciona caso gráfico zero conhecido vs unavailable sem perder testes e2.
- **FULL final do e2:** `F03-FULL-e2.patch` blob `e3e009ba341f6b774429f978eccf4271b58c9bfd`, 8 arquivos INTEIROS relativos a preimage ABSENT, sem shared writes. **Hashes:** `MANIFEST-e2.json`. O `F03-FULL.patch` e `MANIFEST.json` antigos são históricos e NÃO substituem os arquivos materializados.

| Path | Preimage no fence | Final SHA |
| --- | --- | --- |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/frame/types.ts` | ABSENT | `d1eb054cca2f41dfd99c41bcfbd761410ee74da8` |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/frame/presentation.tsx` | ABSENT | `d868f673d1bec44a24b7bd83c0163784e04a695d` |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/frame/index.tsx` | ABSENT | `efd0e794526297be54f648315f8d6ad01e29198e` |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/frame/frame.css` | ABSENT | `5cfa5f50569586c940ae19ac75ec93c67f89ee24` |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/states/index.tsx` | ABSENT | `7084c442f96e3b7d0f91b66027118df6eb003ebc` |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/states/states.css` | ABSENT | `1bc1027f8888e2937f4a486ecedd883803e3f0c6` |
| `packages/app-shell/src/i18n/orchestra-chapters/sf-common.ts` | ABSENT | `9195c2c91f8c69af2b6f7c0761800f720c24bdd8` |
| `packages/app-shell/test-browser/sucafina-native/page-frame.test.ts` | ABSENT | `0d0cd166eda9c2f81d2a77e034c89c0206c78c0f` |

## Funcionalidade coberta

Exports exatos: `SfPageFrame`, `SfContextBar`, `SfChartFrame`, `SfStatePanel`, `SfRunState`. F03 foi implementado com primitives Solid/Mx existentes, tokens do Orchestra sem palette nova, layout baseado na largura **útil** por um ResizeObserver, density e responsividade, tab/focus/teclado, COPY-01 **72** chaves en/pt-BR, 13 estados, privacidade em denied/session-expired, contexto owned pelos consumidores, chart com SVG consumer-owned + tabela acessível que não substitui dados indisponíveis por zero, run state discriminado e sem fake receipt/result.

**Lacunas de contrato tratadas sem deriva:** `SfContextControl` só possui `label` da opção selecionada, não `labelKey` próprio; manter rótulo autorizado do produtor, registrar revisão de semântica com 114. COPY-01 não tem `moreActions`, então ações secundárias permanecem visíveis em reflow, sem usar indevidamente `showDetails`. Frozen chart plot/table tem `selectionRef` e não tem `sourceRef`; `onOpenSource` NÃO é fabricado. Gráfico concreto depende do `children` do consumidor real. Nenhum schema permissivo, clone de produtor ou backend paralelo.

## Patches compartilhados / bloqueios reais

- Única integradora **114/C00 (PR65)** importa **seletivamente os 8 blobs** do manifesto e não faz merge integral da PR #129: a branch herda o envelope documental UX. Mantém todos os autores e estados existentes, reconcilia preimages com candidato real.
- `packages/app-shell/src/i18n/orchestra.ts` pertence exclusivamente a114. Patch original completo `SHARED-I18N.patch@3366ab22b956fbe629e2e3492ebc1ad26cf61bff`, preimage observada em `sf2-stack` `2eeaa42e02a45b3301fc765c6c92635af5101079`, postimage proposta `9c1d5ef7e785e56439db5ef3b9a7d0ad2ff46dd7`; aplicar após reconciliação live, sem W04 escrever shared.
- F01 ainda não estava instalado em `sf2-stack@2105c17b51fd9cb5131418c116433a05f9479cb7` durante esta leitura: `context/contracts.ts` ausente. F03 agora depende apenas do Schema canônico para `SfHref,SfRef,SfVersion`; ainda é preciso integrar F01/Schema e owner provider reais. Não criar stub de compatibilidade.

## Provas, gates e fechamento

**NENHUM teste/validador/typecheck local executado.** Teste `packages/app-shell/test-browser/sucafina-native/page-frame.test.ts` é source-only **NOT_RUN**. Após integração real/qualificação de dependências pela114, solicitar à120 seleção cirúrgica hospedada desse arquivo, sem duplicar dispatcher e preservando run/job/SHA.119 executa `bun typecheck` em `packages/app-shell` e guards via Actions; não assumimos green herdado. A revisão independente N0 valida sete temas, zoom 200%/400%, largura 320px, foco e semântica visual. Se falhar, devolver diagnóstico ao autor para correção causal.

**Estado terminal da autoria e2: `ARTIFACT_READY`; slot de escrita liberado após handoff.** Consumer `114`, CI `120`, compiler `119`. Sem merge, force/reset, deploy, Azure, restart ou Goal. **GLOBAL_RELEASE=false**.
