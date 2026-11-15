# 127 / Q02 — handoff de autoria (visual, acessibilidade, localização, piloto)

**Status:** `ARTIFACT_READY_AUTHORING_ONLY / BLOCKED_INTEGRATION_AND_QUALIFICATION`. **NÃO é PASS, INTEGRATED, FINAL ou GLOBAL_RELEASE.** O trabalho foi autorado diretamente em `sf-qual-presentation`, sem teste local, Actions, typecheck, merge, deploy ou Goal.

## Fence e autoridade

- Repositório: `gustavomhss/Orchestra-SF`; base/branch: `sf-qual-presentation`; destino PR: `sf2-stack`.
- HEAD original confirmado: `ef88762b673b6875d1012fd55f74681688b05853`; epoch `native-q02-e1`; actor GitHub `gustavomhss`.
- ACK **remoto real antes dos testes**: `b46d98dbd18a8429b8985e300e0b1e120ae7a7b6` em `Q02/ACK.json`.
- Código final dos quatro arquivos em HEAD `39b1e9f8c3ef4e3cc33d6f190946d7826061f442`, após 7 commits de autoria; detalhes de pre/postimage em [MANIFEST.json](./MANIFEST.json).
- Path preimage dos quatro arquivos: **ausente** no fence. Não foram modificados arquivos shared, produtores, gerados, dispatcher ou paths de outros autores.
- Autor 127: **somente autoria**. Integrador: **125**; CI hospedado/runner: **129**; compiler/guards: **128**; revisor de baselines: independente.

## Entrega / rastreabilidade

| Arquivo exclusivo | Casos previstos (não coletados) | Requisitos / oráculos |
| --- | ---: | --- |
| `e2e/sucafina/native/pilot-presentation.spec.ts` | 7 | `Q02.pilot`, `Q02-P0P1`; real F04/P0 draft CAS `values.pr.title` somente; requester/denied; P1 `pr_pending`/holder real, montante original, aceite/refetch; perda de resposta P0 **e** P1 sem replay; bloqueio desktop D01 |
| `e2e/sucafina/native/visual.spec.ts` | 35 | `Q02-AC01/03`; captura de **15 capítulos × Light/Dark = 30**, mais Graphite/Gruvbox/GitHub/Nord/AMOLED no frame e tokens/foco compartilhados; snapshot inicial exige assinatura de revisor |
| `e2e/sucafina/native/accessibility.spec.ts` | 10 | `Q02-AC02`, `LAYOUT-01`, `A11Y-01`; viewports **320/768/1024/1280/1440**, largura útil observada, overflow apenas em região de grade, foco e teclado; probes separados 200% texto e 400% reflow; grid mensal Home/setas/Escape sem POST; radio group; gráfico + tabela acessível |
| `e2e/sucafina/native/localization.spec.ts` | 34 | `COPY-01/02`; **15 capítulos × EN/PT-BR = 30**, duas verificações de `Title` fonte inglesa preservada vs novo `Review title change` traduzido, proibição CAP/UI/WP como labels e bloqueio desktop nativo |

**Total:** 86 definições de casos esperadas após montagem; **0 coletadas, 0 executadas, 0 aprovadas** nesta sessão. Contagens são da estrutura autorada, não resultado do Playwright. Selecionar por arquivos exatos; não há suíte total autorizada aqui.

### Matriz de entrada por capítulo (surface-manifest congelado)

| Capítulo | Entry/case | Entrada |
| --- | --- | --- |
| sf-dashboard | CAP01 | `/orchestra/sf-dashboard/executive` |
| sf-people | CAP06 | `/orchestra/sf-people/overview` |
| sf-portfolio | CAP09 | `/orchestra/sf-portfolio/overview` |
| sf-operations | CAP11 | `/orchestra/sf-operations/service` |
| sf-procurement | CAP14 | `/orchestra/sf-procurement/contracts` |
| sf-planner | CAP17 | `/orchestra/sf-planner/overview` |
| sf-home | UI29 | `/orchestra/sf-home` |
| sf-work | UI30 | `/orchestra/sf-work` |
| sf-decisions | UI33 | `/orchestra/sf-decisions` |
| sf-bi | UI45 | `/orchestra/sf-bi` |
| sf-reviews | UI47 | `/orchestra/sf-reviews/agenda` |
| sf-imports | UI55 | `/orchestra/sf-imports/new` |
| sf-documents | UI58 | `/orchestra/sf-documents` |
| sf-memory | UI61 | `/orchestra/sf-memory/signals` |
| sf-routines | UI64 | `/orchestra/sf-routines` |

**Acoplamento ao produto:** `nativeInstalledFixture` é o export público de F04/W05 (PR #120, head `d2ea82b...`), ainda **não instalado nesta branch**. Usa `readNativeManifest` privado/isolado, SHA vinculado ao candidato e `proveWeb` contra discovery e contexto reais. `WEB_INSTALLED_CONTEXT_OBSERVED` comprova o vínculo de contexto/capítulo, **não** a transação P0/P1 ou Electron. A corpus seed F04 `DOMAIN_FIXTURE_NOT_INSTALLED` não aceita login, aprovação ou desktop. U11 title-save e F03 frame também estão em branches autoras separadas; sua presença nesta PR isolada **não é assumida**. Nenhum caso aceita mock, fallback WP04, `test.skip` ou sucesso sintético.

## Esperados por gate e pendências

1. **125 — composição, fonte e identificação:** comparar HEAD/tree/allowlist e ingerir os **quatro blobs pós-imagem exatos** do manifesto; não fazer merge wholesale da coorte. Integrar F01/F02/F03/F04/I00, CAP routes e U11/U13 reais com producer admission; expor três sessões autenticadas independentes `requester/holder/denied` no **mesmo** storage isolado. A inscrição local-operator por UID não prova três atores. Seed/host/scratch distintos **por caso mutante**, pois o P0 salvo não pode contaminar o cenário P0 de perda de resposta. Se a composição mudar contratos congelados, encaminhar ao owner correspondente, não improvisar stub.
2. **129 — CI cirúrgico:** após a composição 125, selecionar exatamente `visual.spec.ts`, `accessibility.spec.ts`, `localization.spec.ts`, `pilot-presentation.spec.ts` com a configuração F04 de seleção real (não `--list` como prova); registrar candidate SHA, run/job, spec coletada, testes/exceptions, vínculo do host, principal autenticado, request/response original, negative ACL e ausência de segunda mutação. Sem manifesto/runner/host real = **FAIL/BLOCKED**, não SKIP/PASS. Não expor tokens/cookies/IDs privados em artefatos de screenshot.
3. **128 — compiler/guards:** compilar/guardar somente a árvore composta por 125; import F04 não deve ser substituído por cópia privada. Esta branch Q02 nunca foi compilada.
4. **Revisor independente — snapshots:** rever imagens das 30 entradas Light/Dark e das cinco paletas compartilhadas, confirmar conteúdo fonte (não loading/fixture/legacy) e **assinar** baselines. `toHaveScreenshot` sem baseline deliberadamente falha; 127 não aceita/gera baseline unilateral.
5. **A11Y/zoom:** `200%` usa sonda de CSS font-size; `400%` usa equivalência 1280→320 CSSpx. Ambos testam aspectos de reflow, mas **não provam** zoom nativo do navegador; 129/revisor devem anexar uma medição hospedada real de text-only zoom e browser zoom. Estados específicos erro/empty/readonly/draft e contrates deverão ter prova de instalação controlada, não apenas amostra de tokens.
6. **D01 desktop:** F04 expõe `desktop: NOT_RUN_D01_REAL_ELECTRON_REQUIRED`, sem API pública de sessão Electron main/preload/callback. Os dois gates de desktop no piloto/localização **falham explicitamente**, em vez de aceitar web como desktop. A integração deve fornecer interface legítima de consentimento/cancelamento e execução P0/P1 e anexar observação autêntica.
7. **Locale:** no shell, seletor real `[data-action="settings-language"]`, armazenamento `br` e `document.lang=pt-BR`. As strings novas são en/pt-BR do manifesto; `Title` da fonte Procurement é inglês literal em ambos por decisão `legacy-source-copy-preserved`. Não traduzir runtime na suíte.

## Estado de aceitação

- `Q02-AC01`: **AUTORADO / NÃO EXECUTADO / baseline não assinada**.
- `Q02-AC02`: **AUTORADO / NÃO EXECUTADO / zoom nativo pendente**.
- `Q02-AC03`: **NÃO COMPROVADO** até host real, revisão independente e recibos.
- `Q02-P0P1`: **AUTORADO WEB / NÃO EXECUTADO / DEPENDÊNCIAS / DESKTOP BLOQUEADO**.
- **GLOBAL_RELEASE = false**. Sem C qualificado nem aceite de 1610 critérios/Goal.

A PR contra `sf2-stack` é veículo de entrega e handoff de blobs, **não** autorização para merge direto ou deploy.
