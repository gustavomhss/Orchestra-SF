# SF2H 123 — Handoff de regressões runtime / C58

**Estado: PATCH_HANDOFF, não FIXED.** ACK `ACK123.json`; matriz verificável `MANIFEST-123.json`. As nove observações dos runs originais continuam OPEN até reexecução e evidência da 120. Nenhuma fonte de produtor foi alterada na branch. Patches completos são arquivos `.patch` + blobs-alvo GitHub já gerados, ancorados nos blobs-base originais do C58. O plano fixo `dbf9547211d9b0fade619790de7c19c0869b7c7d` permanece intacto.

## Artefatos de implementação entregues

| Patch | Autoridade a reconciliar (antes de aplicar) | Origem → blob alvo |
| --- | --- | --- |
| `patches/01-planner-revocation.patch` | produtor Planner / 114 | `02d75207` → `cf940bb5` |
| `patches/02-wp00-journey-bindings.patch` | owner corpus WP00 / 114 | `d99589bb` → `8ebe7679` |
| `patches/03-wp08-private-writer-fixture.patch` | **owner do teste, extensão de patch allowlist** | `ca0e83b3` → `2fc7dcb0` |
| `patches/04-import-preview-contribution-links.patch` | **owner UI, extensão de patch allowlist** | `42878a8e` → `a8b6aa9e` |
| `patches/05-analysis-run-admission-egress.patch` | produtor CLI de Analysis / 114 | `1d9a8a95` → `9eea7bb8` |
| `patches/06-business-case-historical-aba.patch` | **owner Business Services, extensão de patch allowlist** | `7f77d244` → `ec17b45e` |

**Instrução para 114:** antes de consumir um patch, verificar HEAD, blob-base atual, autoridade do writer, lease e contrato. Se o arquivo foi alterado por outro autor depois do C58, reconciliar os dois textos em vez de instalar o blob-alvo antigo. Somente 114 pode coordenar intake/integrar; o silêncio não revoga writer. Cada patch tem diff completo e SHA Git real do blob-base e do blob-alvo, ambos conferidos por reconstrução textual da fonte, **não por execução de testes**.

## Matriz das nove falhas originais

1. **118A / source-observation:86:** short-circuit em `requestFor` pula `revalidate` após revogação. `01` revalida primeiro e retorna `denied` sem autenticação/source-read. **PATCH_READY_UNVERIFIED**.
2. **118B / baseline-corpus:60:** J01–J08 sem `fixtureBindings` e `executionStatus`. `02` adiciona caminhos de testes reais como vínculos candidatos; **todos `NOT_RUN`**. **PATCH_READY_UNVERIFIED**.
3. **118B / host-answer-reuse (11.767s > 5s):** causa de custo/espera ainda sem estágio delimitado. Sonda real `test/product/runtime-regression-fix/host-answer-stage-probe.test.ts` preserva as assertions e o limite de 5s, imprime `SF123_WP08_PHASE`. **OPEN_NEEDS_PHASE_EVIDENCE; não aumentar timeout**.
4. **118B / collaboration-journey:105:** o guard privado de escritor de `sf:case-work-selection:` deve ser o mesmo na instância C08 e no host; `03` unifica o token sem mudar a asserção. **PATCH_READY_UNVERIFIED**.
5. **118B / decision-conflict-recovery:32:** pool Chromium sem startup — traceback `browser-fixture.ts:232`. Não é prova de regressão do produto. **RECHECK_SELECTION_READY**, com startup primeiro, consumer entre e lifecycle último; não remover guard.
6. **118B / analysis-lifecycle:67:** rollback v2→v1 ressuscita selectedCase/resolveCase históricos. `06` armazena versão real inicial no `CaseScope` lexical e veta retorno a uma versão inferior nas projeções frescas; `05` reobserva C08. **PATCH_READY_UNVERIFIED**.
7. **118B / analysis-lifecycle:122:** revogação de participante ocorre no `human.authorize` final. `05` relê C08 **depois** da autorização e recusa payload sucesso anterior. **PATCH_READY_UNVERIFIED**.
8. **118B / analysis-lifecycle:187:** faltava read C08 em admission/egress sob outer snapshot; `05` rejeita mudança no snapshot e lease encerrada mesmo com callback C08 `ok`. **PATCH_READY_UNVERIFIED**.
9. **118B / import-analysis:156/326:** contribution persistida não renderizava link da seleção C04. `04` usa exclusivamente `payload.importPreviewRef` em link guardado `/sucafina/planner?sf=imports&importPreviewRef=...`; nenhum mock ou apply. **PATCH_READY_UNVERIFIED**.

## Recheck cirúrgico solicitado a 120 / PR106

Somente após a admissão dos patches afetados por 114:

- Diagnóstico A: `test/product/diagnostics/calculation/source-observation.test.ts`.
- WP00: `test/product/wp00/baseline-corpus-coverage.test.ts`.
- WP08 jornada: `test/product/wp08/collaboration-journey.test.ts`; para timeout, executar **uma vez a sonda diferencial** `test/product/runtime-regression-fix/host-answer-stage-probe.test.ts` e obter último estágio; depois implementar correção causal antes de repetir o teste original.
- WP01: **uma única seleção em ordem rígida** `wp01/browser-startup.test.ts` → `wp01/decision-conflict-recovery.test.ts` → `wp01/browser-lifecycle.test.ts`, preservando Omni e lifecycle.
- WP10: `test/product/wp10/integration/analysis-lifecycle-admission.test.ts` (três oráculos e seus subcasos).
- WP06: `test/product/wp06/native/import-analysis.test.ts` (prova longa/real após patch da UI).
- 119/PR107: typecheck e guards da seleção autorizada, com **Bun e não tsc direto**, antes de qualquer integração aceita.

Pedir run/job/W/S exatos, comparação de hashes e critério por finding. Falha parcialmente coberta não reduz a matriz; sem testes executados por esta sessão. Não há GLOBAL_RELEASE, dev merge, deploy, Azure, engine edit ou Goal retomada.

## Dependências e riscos explícitos

- `03`, `04`, `06` são propostas fora de `producer_patch_paths` do pacote; 114 precisa trazer o writer proprietário para uma autorização explícita. Não editar fonte por silêncio.
- WP08 timeout permanece sem patch causal (somente sonda de baixo impacto). A integração completa de 123 não pode ser declarada pronta enquanto não houver diagnóstico/correção e prova.
- No caso C08, `withCase` histórico pode continuar lendo contexto autorizado anterior, **mas fresh selectedCase e resolveCase não podem ganhar autoridade por rollback**. Auditoria 112/113 deve revisar.
- O link de importação é apenas navegação para o host; a página deve continuar rejeitando ref errada, expirado/revogado e falsa aplicação. 
- Planos, critérios e jornadas J01–J08 continuam imutáveis/não-executados, respectivamente.

*Arquivo de evidências máquina:* `MANIFEST-123.json`, com SHA integral de cada source, alvo e estado dos nove oráculos.
