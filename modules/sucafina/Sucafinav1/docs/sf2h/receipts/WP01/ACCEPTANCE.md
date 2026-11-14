# WP01 — acceptance and delivery receipt

**Disposition: DRAFT / BLOCKED.** Implementation, focused hosted checks and the complete 75-criterion matrix are published for S0 review. The linked pack is not fully qualified. The functional run and package typecheck retain their failed conclusions; the browser qualification and repository guards are reported separately.

PR: [#25](https://github.com/gustavomhss/Orchestra-SF/pull/25), branch `astra-wp01`, base `sf2-stack` at `6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0`. Tested product W8: [`61348f2279d301a5f9f8e28c562208ce3b8160ee`](https://github.com/gustavomhss/Orchestra-SF/commit/61348f2279d301a5f9f8e28c562208ce3b8160ee); tree `b48e6066ac4bedeb27933f38a5fb32445650e0aa`. The delivery commit adds only receipt documents after W8. Its exact identity and receipt-only comparison are recorded in the PR.

## Implementation by task

| Task | Implemented consumer behavior | Remaining acceptance boundary |
|---|---|---|
| T01 — shell/navigation | Canonical Dashboard/Planner/Procurement destinations, independent period/version, history/scroll/focus, pending edits and access-revocation fences. | Full three-surface DoD explicitly requires WP10 composition; legacy producer access revisions remain open. |
| T02 — review/edit/decide patterns | Responsive components, field errors, current-versus-attempted values, keyboard details and conditional C10 coverage/history. | Assertions qualify their declared routes and data; they do not establish every native/domain state. |
| T03 — edits/failures/conflicts | Frozen mutation body/key, duplicate and late-response fences, bounded requests, dirty-draft preservation and explicit confirmation/reconciliation. | Monthly/portfolio durable receipt composition and broader C03 domain journeys remain open. |
| T04 — search/views/responsibility | Authorized record search with canonical identity/context, effective period, revalidation and direct focus; personal views and preferred entry recovery. | Full C06 responsibility/provisioning, removed-version counter proof and atomic multi-page ACL revision are not established. |
| T05 — Today/decision workbench | Real contextual contract evidence/case creation; current-case analysis preparation; saved-author Reviewer adapter; edit/choice/sensitivity/apply/portfolio consumers; C10 distinctions. | All 18 skills/five profiles, actual native Session/model witnesses, complete decision HTTP composition and choice before contextual return remain open. |

Implementation details and concrete dependencies B01–B11: [IMPLEMENTATION.md](IMPLEMENTATION.md). Each original criterion, its consumer, exact observed tests, required proof and remaining scope: [criteria.json](criteria.json).

## Hosted checks

| Gate | Run | Actual observation |
|---|---|---|
| Browser lifecycle qualification on W7 (2 explicit files; helper unchanged in W8) | [43535146652](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43535146652) | 5 pass / 0 fail. One Chromium, three acquired/released leases, no retained contexts, disconnection and actual PID exit. |
| Complete focused selection (21 explicit files) | [43537602523](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537602523) | 140 pass / 1 fail, 141 tests, 2693 assertions, 153.69 s; conclusion `failure`. See the exact failed test below. |
| Late repetition of the identical W8 selection | [43537953955](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537953955) | 140 pass / 1 fail, 141 tests, 2693 assertions, 147.06 s; the same B10 failure. |
| Package typecheck, candidate and immutable seed | [43537002262](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537002262) | Candidate 132; seed 155 diagnostics. Both typechecks fail. Strict comparison: 130 common / 2 added / 25 removed complete messages; zero diagnostics in the 49 paths changed since the seed. |
| Guards against the fetched `origin/dev` | [43537002262](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537002262) | `success`: 78 rules, 582 paths, 0 gate findings, 23 warnings and 0 errors. Base identities and warnings are in STATIC-W8.txt and CI.json. |

Commands: `bun typecheck` in `modules/sucafina`; `bun run check:guards --base origin/dev` at repository root. The runner fetched the actual dev ref. No local product tests, local typecheck, epic or full suite were used.

The typecheck comparison preserves complete diagnostic messages and multiplicity. Message variants at unchanged foreign files are shown separately from the location/code comparison. They are not silently normalized into exact matches. No diagnosis of the seed host runtime is inferred from its typecheck.

### Failed functional observations

- `Sucafinav1/test/product/wp01/workbench-analysis.test.ts` — **Workbench analysis HTTP enforces human authority and hides forged run references**.

B10 is the retained real-host bootstrap failure: `sf_maestro` requests `sf_watch_prepare`, but none of its seven selected skills publishes that operation. The host passes the profile operations to registration, whose selection check rejects `invalid-resident-profiles`; `/api/agent` returns 500 before the full analysis assertions. The manifest, host composition and validator blobs are identical to the immutable seed. The seed host runtime was not separately executed; source equality and the candidate failure are distinct evidence. The expected HTTP 200 assertion remains unchanged.

### Snapshot binding and reproducible selection

Functional snapshot S10: [`4ab900e1b41226b15468239394d91a8c46f7dc02`](https://github.com/gustavomhss/Orchestra-SF/commit/4ab900e1b41226b15468239394d91a8c46f7dc02), tree `2a85fc75b479feb1fd10e3ffddd107f4b6ea5e17`. Its only addition to W8 is `.ci-run.json`, blob `617b781f188ce8a9b236093e340e53316810b451`, SHA-256 `d7bebaae838e8f5ef0b0f2ef3d67191f60d748b629f9f3602dd54657b98a33b6`.

All 43 original root entries match by path, mode, type and object SHA. Identical subtree object IDs recursively bind all product, test, config and fixture blobs; the snapshot has 44 entries including the request. The canonical validator also accepted the request inside Actions. Snapshot branches are temporary and cleanup is recorded separately. S9 initially had no observable run in repeated branch/head/check-run queries. After about five minutes of zero-run preflight, S10 reused the identical product/request/tree in a fresh unique ref. GitHub then created the delayed S9 run at 01:01:24Z, causing workflow overlap. The exposed GitHub MCP has no cancellation operation. Both runs were observed through completion. Workflows overlapped for 61 seconds, but their Run tests steps did not overlap: S10 ended at 01:02:19Z and S9 began at 01:02:59Z, a 40-second gap. CI.json records the raw timestamps and cadence deviation. Both cleanup jobs succeeded and root subsequently observed HTTP 404 for both temporary refs; neither result is omitted.

The normalized request uses `package: sucafina`, `directory: modules/sucafina`, the canonical `packageSelector: packages/sucafina`, `runner: bun`, empty requested environment and `--timeout 120000`. Files are explicit and ordered:

```text
./Sucafinav1/test/product/wp01/preview-browser.test.ts
./Sucafinav1/test/product/wp01/bi-browser.test.ts
./Sucafinav1/test/product/wp01/components.test.ts
./Sucafinav1/test/product/wp01/http.test.ts
./Sucafinav1/test/product/wp01/import-receipt-browser.test.ts
./Sucafinav1/test/product/wp01/personal-views.test.ts
./Sucafinav1/test/product/wp01/planner-monthly.test.ts
./Sucafinav1/test/product/wp01/workbench-analysis.test.ts
./Sucafinav1/test/product/wp01/component-coverage.test.ts
./Sucafinav1/test/product/wp01/edit-recovery.test.ts
./Sucafinav1/test/product/wp01/record-search.test.ts
./Sucafinav1/test/product/wp01/shell-state.test.ts
./Sucafinav1/test/product/wp01/view-recovery.test.ts
./Sucafinav1/test/form-layout.test.ts
./Sucafinav1/test/screen.test.ts
./Sucafinav1/test/visual-layout.test.ts
./Sucafinav1/test/product/wp10/integration/ui-authority.test.ts
./Sucafinav1/test/product/wp01/contextual-decision.test.ts
./Sucafinav1/test/product/wp01/decision-mutations.test.ts
./Sucafinav1/test/product/wp01/portfolio-recovery.test.ts
./Sucafinav1/test/product/wp01/browser-lifecycle.test.ts
```

S7 failed at initial Chromium acquisition when BI was first; the runner terminated orphan Chrome processes after the helper never obtained a Browser/PID. S8 changed only the order, moving preview first; S10 keeps that order after the W8 request-specific fixture correction. There is no proven FileHandle/SQLite/GC cause. This browser harness is qualified for the recorded Linux sequential explicit selection with preview first and its finalizer last. Other modes require lifecycle composition; the result is not transferable to automatic discovery or another product tree. Omni control `not applicable` for this focused declared-control request is not proof of native resident spawning.

### Evidence files and artifact inventory

[CI.json](CI.json) preserves every attempt, exact request, source/tree bindings, run/job identities, controls, conclusions, artifacts and diagnostic comparisons. [TEST-S6.txt](TEST-S6.txt), [TEST-S7.txt](TEST-S7.txt), [TEST-S8.txt](TEST-S8.txt), [TEST-S9.txt](TEST-S9.txt), [TEST-S10.txt](TEST-S10.txt) and [STATIC-W8.txt](STATIC-W8.txt) archive the final observations and source log hashes. Ephemeral authentication codes are redacted in published test excerpts; any omitted large diagnostic payload is identified by its source hash.

The Bun test lane returned no downloadable Playwright artifacts. Screenshot counts in a job log describe work performed there, not a published image archive. Static artifact IDs and digests are retained exactly in CI.json. Browser fixture request counters are not proof of producer idempotence, native execution or domain effect-once.

## Complete criterion matrix

A scoped PASS closes only the exact invariant and assertions described in criteria.json. Partial and blocked rows remain unclosed; none is implied ready by a rendered component, catalog or passing harness check.

| Status | Count |
|---|---:|
| `BLOCKED_INTEGRATION_PROOF` | 6 |
| `BLOCKED_NATIVE_EVIDENCE` | 8 |
| `PARTIAL_IMPLEMENTATION` | 1 |
| `PARTIAL_NOT_VERIFIED` | 1 |
| `PARTIAL_VERIFIED` | 54 |
| `PASS_SCOPED` | 5 |

| Criterion | Status | Original criterion |
|---|---|---|
| `WP01.DOD.01` | `BLOCKED_INTEGRATION_PROOF` | Shell e componentes são consumidos pelas três superfícies reais e as entradas canônicas continuam acessíveis; o pacote local pode chegar a READY_FOR_INTEGRATION, mas este critério de conclusão só fecha na prova WP10. |
| `WP01.DOD.02` | `PARTIAL_VERIFIED` | Navegação, contexto, teclado e estados de falha têm evidência em telas largas e estreitas. |
| `WP01.DOD.03` | `BLOCKED_INTEGRATION_PROOF` | Hoje e mesa de decisão consomem casos, IA, cenários, perguntas e recibos reais; entrada contextual e operação direta funcionam sem exigir um caso para tarefas simples. |
| `WP01.DOD.20` | `PARTIAL_VERIFIED` | UI usa os resultados e a cobertura reais C10 em alternativa, escolha e reavaliação. |
| `WP01.DOD.30` | `BLOCKED_NATIVE_EVIDENCE` | Entradas de trabalho da mesa consomem as 18 saídas da matriz C15 em cenários pertinentes; cinco perfis deixam contribuições verificáveis e o Revisor tem run próprio. |
| `WP01.INV.01` | `PARTIAL_VERIFIED` | Visibilidade de controles não substitui autorização; pesquisa e preferências nunca expõem dados fora do acesso existente. |
| `WP01.INV.02` | `PARTIAL_VERIFIED` | Trocar visualização não altera registros financeiros, estado de compra ou período silenciosamente. |
| `WP01.INV.20` | `PASS_SCOPED` | UI não transforma pending em zero nem esconde condição financeira por haver um número válido. |
| `WP01.INV.30` | `PARTIAL_VERIFIED` | Catálogo, nome de perfil ou chat sem outputRef consumido não satisfaz entrega; perfil não concede autoridade nova e fonte oficial continua no domínio. |
| `WP01.QLT.01` | `PARTIAL_VERIFIED` | Revisar, editar e decidir têm hierarquias próprias; linguagem de negócio substitui nomes técnicos no fluxo do usuário. |
| `WP01.QLT.02` | `PARTIAL_VERIFIED` | Manter foco visível, status além de cor, texto legível e controles operáveis por teclado e toque. |
| `WP01.QLT.20` | `PARTIAL_VERIFIED` | Estado e categoria pendente acompanham o subtotal, fonte e próximo passo, inclusive por teclado/tabela. |
| `WP01.QLT.30` | `PARTIAL_VERIFIED` | Mostrar contribuição, fontes e progresso útil; detalhes de perfil/modelo/skill/versão/run ficam sob demanda e seleção manual de agente não é obrigatória. |
| `WP01.CMP.01` | `PARTIAL_VERIFIED` | Cobrir os três módulos, todas as entradas canônicas, detalhe/volta, estados vazios/erro/carregando e recuperação de edição. |
| `WP01.CMP.02` | `BLOCKED_INTEGRATION_PROOF` | Hoje e mesa de decisão consomem casos, IA, cenários, perguntas e recibos reais; entrada contextual e operação direta funcionam sem exigir um caso para tarefas simples. |
| `WP01.CMP.20` | `PARTIAL_VERIFIED` | Cobrir categoria ausente, zero confirmado, comparação condicionada, fonte revogada e inversão posterior. |
| `WP01.CMP.30` | `BLOCKED_NATIVE_EVIDENCE` | Cobrir18 skills com witnesses de carga/digest/saída persistida/consumo real, cinco perfis distintos e falta/falha/stale/cancelamento, usando as seis provas integradas. |
| `WP01.SUC.01` | `PARTIAL_VERIFIED` | O usuário abre um registro e retorna à mesma consulta e posição sem refazer filtros. |
| `WP01.SUC.02` | `PARTIAL_VERIFIED` | Cada pessoa chega à sua tarefa a partir da entrada escolhida, sem atravessar a experiência executiva inteira. |
| `WP01.SUC.20` | `PARTIAL_VERIFIED` | A pessoa reconhece por que a comparação está condicionada e vê a consequência da resposta sem reconstruir o caso. |
| `WP01.SUC.30` | `BLOCKED_NATIVE_EVIDENCE` | Usuários concluem enquadramento, comparação, pergunta, revisão, preparo ou reavaliação sem coordenar cinco conversas nem reconstruir resultado no chat. |
| `WP01.T01.CHK.01` | `PARTIAL_VERIFIED` | Todas as capacidades da matriz continuam alcançáveis por seus papéis. |
| `WP01.T01.CHK.02` | `PARTIAL_VERIFIED` | Voltar de detalhe restaura filtros/scroll/seleção e abrir link direto restaura contexto permitido. |
| `WP01.T01.CHK.03` | `PASS_SCOPED` | Ano do Planner não sobrescreve silenciosamente mês de Operations ou referência de Security. |
| `WP01.T01.DOD.01` | `PARTIAL_VERIFIED` | Navegação nova funciona no shell real com cobertura de todas as entradas mapeadas. |
| `WP01.T01.INV.01` | `PARTIAL_VERIFIED` | URLs e estado de navegação não criam referências ou permissões de negócio. |
| `WP01.T01.QLT.01` | `PARTIAL_VERIFIED` | Nomes dos módulos permanecem reconhecíveis; grupos e ações raras reduzem densidade sem esconder o trabalho principal. |
| `WP01.T01.CMP.01` | `PARTIAL_VERIFIED` | Incluir acesso direto, voltar/avançar, recarregar, filtro inválido, página não autorizada e tela pequena. |
| `WP01.T01.SUC.01` | `PARTIAL_VERIFIED` | O usuário sabe em que módulo, período e versão está e chega ao registro que procura sem reconstruir a consulta. |
| `WP01.T02.CHK.01` | `PARTIAL_VERIFIED` | Conferir em 320, 768 e 1440 px: texto/ações essenciais sem corte; rolagem horizontal confinada a grades que exigem largura. |
| `WP01.T02.CHK.02` | `PASS_SCOPED` | Teclado alcança controles, fecha detalhe e devolve foco ao registro correto. |
| `WP01.T02.CHK.03` | `PARTIAL_VERIFIED` | Cor não é a única indicação de atraso, seleção, erro ou sucesso. |
| `WP01.T02.DOD.01` | `PARTIAL_VERIFIED` | Os três layouts são reutilizáveis e foram exercitados com dados longos, ausentes e restritos. |
| `WP01.T02.INV.01` | `PARTIAL_VERIFIED` | Componente visual não inventa cálculo, causa, recomendação ou ação permitida. |
| `WP01.T02.QLT.01` | `PARTIAL_VERIFIED` | Densidade serve à atividade; tipografia e alinhamento numérico permitem comparar sem decoração competitiva. |
| `WP01.T02.CMP.01` | `PARTIAL_VERIFIED` | Cobrir cabeçalhos, tabelas, formulários, detalhes, comparações, estados vazios e ações de conclusão. |
| `WP01.T02.SUC.01` | `PARTIAL_VERIFIED` | WPs de domínio conseguem compor as telas sem criar um segundo sistema de componentes. |
| `WP01.T03.CHK.01` | `PARTIAL_VERIFIED` | Uma falha não exibe Saved e não descarta o texto digitado. |
| `WP01.T03.CHK.02` | `PARTIAL_VERIFIED` | Dois usuários alteram a mesma versão: o perdedor vê conflito e sua tentativa; nenhum merge silencioso. |
| `WP01.T03.CHK.03` | `PARTIAL_VERIFIED` | Refresh de dados não substitui formulário sujo nem muda o número estável de reunião. |
| `WP01.T03.DOD.01` | `PARTIAL_VERIFIED` | Salvamento, validação, cancelamento e conflito têm estados completos e recuperáveis nos componentes reais. |
| `WP01.T03.INV.01` | `PARTIAL_VERIFIED` | Reconciliação visual nunca faz escrita não solicitada nem ignora a versão esperada. |
| `WP01.T03.QLT.01` | `PARTIAL_VERIFIED` | Mensagens citam campo/registro e próximo passo útil; JSON bruto e códigos internos ficam fora do fluxo normal. |
| `WP01.T03.CMP.01` | `PARTIAL_VERIFIED` | Cobrir sucesso, validação, perda de conexão, timeout, conflito, read-only e navegação com edição pendente. |
| `WP01.T03.SUC.01` | `PARTIAL_VERIFIED` | A pessoa consegue corrigir o problema e continuar sem redigitar sua contribuição. |
| `WP01.T04.CHK.01` | `PASS_SCOPED` | Usuário restrito não encontra registro proibido nem recebe contagens/títulos que o revelem. |
| `WP01.T04.CHK.02` | `PARTIAL_NOT_VERIFIED` | Uma visão salva não força versão inexistente; explica referência indisponível e permite corrigir. |
| `WP01.T04.CHK.03` | `PARTIAL_VERIFIED` | Nenhuma pendência resulta em estado claro de conclusão, não em erro ou painel vazio sem orientação. |
| `WP01.T04.DOD.01` | `BLOCKED_INTEGRATION_PROOF` | Entradas, busca e visões salvas têm comportamento local comprovado; seu DoD fecha quando retomam contexto válido nos três módulos reais na composição WP10. |
| `WP01.T04.INV.01` | `PARTIAL_VERIFIED` | Preferência não altera dado de negócio nem contorna papel; Meu trabalho é uma projeção dos registros canônicos. |
| `WP01.T04.QLT.01` | `PARTIAL_VERIFIED` | Configuração inicial é curta e opcional; defaults úteis funcionam sem personalização obrigatória. |
| `WP01.T04.CMP.01` | `PARTIAL_VERIFIED` | Cobrir usuário novo, preferência existente, registro removido/inacessível, busca sem resultado e nenhuma pendência. |
| `WP01.T04.CMP.02` | `PARTIAL_IMPLEMENTATION` | Primeiro ciclo distingue ausência de configuração, ausência de acesso e ausência de pendência; permite selecionar registros, período e responsáveis confirmados pelo diretório já autorizado. |
| `WP01.T04.SUC.01` | `PARTIAL_VERIFIED` | Responsáveis chegam aos seus registros, André à revisão e aprovadores às suas decisões com contexto preservado. |
| `WP01.T05.CHK.01` | `PARTIAL_VERIFIED` | Abrir de contrato e retornar ao mesmo registro/filtro depois da escolha. |
| `WP01.T05.CHK.02` | `PARTIAL_VERIFIED` | Trocar permissões com análise antiga e confirmar ausência de vazamento na tela e nos detalhes. |
| `WP01.T05.CHK.03` | `BLOCKED_INTEGRATION_PROOF` | Confirmar premissa, escolher, aplicar por domínio e reavaliar a cotação pela UI integrada. |
| `WP01.T05.CHK.20` | `PARTIAL_VERIFIED` | No caso de treinamento omitido, a mesa mostra subtotal 210000 e diferença conhecida30000 condicionados; após confirmação40000 mostra total 250000/diferença -10000 e a escolha histórica com sua ressalva. |
| `WP01.T05.CHK.30` | `BLOCKED_NATIVE_EVIDENCE` | Executar os cenários compartilhados da matriz de18 skills e registrar, por skill, perfil/versão/digest efetivamente carregados, run, outputRef persistido e ação no consumidor após reload. Cada perfil deve contribuir de forma distinta em caso pertinente; Revisor possui execução própria. Apenas catalogar arquivos, renomear um perfil genérico ou mostrar texto de chat falha. |
| `WP01.T05.CHK.31` | `BLOCKED_NATIVE_EVIDENCE` | Para cada classe de saída da matriz, provocar falta de entrada, falha, cancelamento e mudança material durante execução: consumidor mostra needs-input/failed/cancelled/stale e preserva trabalho confirmado; não cria saída pronta nem amplia acesso por perfil. Variantes podem compartilhar uma execução de prova. |
| `WP01.T05.DOD.01` | `BLOCKED_INTEGRATION_PROOF` | Hoje e mesa funcionam com casos persistentes, atores reais e resultados de IA/engine recebidos pelo host. |
| `WP01.T05.DOD.20` | `PARTIAL_VERIFIED` | UI usa os resultados e a cobertura reais C10 em alternativa, escolha e reavaliação. |
| `WP01.T05.DOD.30` | `BLOCKED_NATIVE_EVIDENCE` | Entradas de trabalho da mesa consomem as 18 saídas da matriz C15 em cenários pertinentes; cinco perfis deixam contribuições verificáveis e o Revisor tem run próprio. |
| `WP01.T05.INV.01` | `PARTIAL_VERIFIED` | UI nunca inventa permissão, confirmação, resultado de IA ou sucesso de comando; chat não é fonte única dos dados da decisão. |
| `WP01.T05.INV.20` | `PASS_SCOPED` | UI não transforma pending em zero nem esconde condição financeira por haver um número válido. |
| `WP01.T05.INV.30` | `PARTIAL_VERIFIED` | Catálogo, nome de perfil ou chat sem outputRef consumido não satisfaz entrega; perfil não concede autoridade nova e fonte oficial continua no domínio. |
| `WP01.T05.QLT.01` | `PARTIAL_VERIFIED` | Uma ação principal por estado, fonte consultável, foco preservado, teclado/toque e layout legível em 320/768/1440 px. |
| `WP01.T05.QLT.20` | `PARTIAL_VERIFIED` | Estado e categoria pendente acompanham o subtotal, fonte e próximo passo, inclusive por teclado/tabela. |
| `WP01.T05.QLT.30` | `PARTIAL_VERIFIED` | Mostrar contribuição, fontes e progresso útil; detalhes de perfil/modelo/skill/versão/run ficam sob demanda e seleção manual de agente não é obrigatória. |
| `WP01.T05.CMP.01` | `PARTIAL_VERIFIED` | Cobrir novo caso, caso existente, lacuna, análise em curso, cancelamento, falha, stale, escolha, aplicação parcial, reavaliação e acesso revogado. |
| `WP01.T05.CMP.20` | `PARTIAL_VERIFIED` | Cobrir categoria ausente, zero confirmado, comparação condicionada, fonte revogada e inversão posterior. |
| `WP01.T05.CMP.30` | `BLOCKED_NATIVE_EVIDENCE` | Cobrir18 skills com witnesses de carga/digest/saída persistida/consumo real, cinco perfis distintos e falta/falha/stale/cancelamento, usando as seis provas integradas. |
| `WP01.T05.SUC.01` | `PARTIAL_VERIFIED` | O participante identifica a pergunta, a alternativa, a pendência e o próximo passo sem reconstruir contexto em outra ferramenta. |
| `WP01.T05.SUC.20` | `PARTIAL_VERIFIED` | A pessoa reconhece por que a comparação está condicionada e vê a consequência da resposta sem reconstruir o caso. |
| `WP01.T05.SUC.30` | `BLOCKED_NATIVE_EVIDENCE` | Usuários concluem enquadramento, comparação, pergunta, revisão, preparo ou reavaliação sem coordenar cinco conversas nem reconstruir resultado no chat. |

## Integration actions required

1. WP10/WP12: align the resident profile, selected skill operations and real registration contract at `product/ai/manifests/resident.json`, `apps/cli/src/sucafina-product/host-context.ts` and `product/host-binding/resident-agents.ts`; rerun the retained real-host test. Do not remove the profile or weaken its assertion to mask the mismatch.
2. WP10/WP11: compose the real decision HTTP/mutation/comparison services and their authority, source and cost-coverage dependencies. Then prove actual choice followed by return to the same contextual contract and filters.
3. WP11/WP10: reconcile historical portfolio retries in `product/decisions/http.ts` with the durable receipt path in `business-services.withCase`. The published allowHistoricalRetry list excludes portfolio evaluation/promotion/preparation; advancing the case can deny a lost-response retry before receipt replay.
4. WP00/WP03/WP08 and integration owners: publish annual/entity Planner contracts, complete C06 responsibility/work-selection composition and current access revision for legacy documents. Preserve the explicit unavailable states until their actual consumers can be bound.
5. Owning producer packages: correct the remaining package typecheck failures. WP01-owned paths have separate evidence; the package gate remains failed until those diagnoses are fixed.
6. WP12/WP10: supply all 18 skill/five-profile native runs, loaded skill bytes/digests, persisted outputs, post-reload actions, revoked-source handling and an independent Reviewer Session/run. Compose the campaign C/D/G and AM01–AM06 evidence and eight final selections afterward.

These are concrete producer seams outside WP01 writing ownership. No producer branch was merged or copied, no new authority was manufactured, and no global release, merge or deployment is declared.

## Implementation path inventory at W8

The independently checked W8 diff against sf2-stack contains 50 paths: 49 owned WP01 paths and the specifically authorized static workflow. Every published blob matched the reviewed local bytes. The subsequent delivery adds/updates only the receipt files in this directory.

```text
.github/workflows/astra-wp01-check.yml
docs/guides/sucafina-workbench.md
modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP01/IMPLEMENTATION.md
modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP01/criteria.json
modules/sucafina/Sucafinav1/product/interface/analysis-http.ts
modules/sucafina/Sucafinav1/product/interface/analysis-input-port.ts
modules/sucafina/Sucafinav1/product/interface/case-analysis-input.ts
modules/sucafina/Sucafinav1/product/interface/contextual-decision.ts
modules/sucafina/Sucafinav1/product/interface/html.ts
modules/sucafina/Sucafinav1/product/interface/http.ts
modules/sucafina/Sucafinav1/product/interface/planner-http.ts
modules/sucafina/Sucafinav1/product/interface/review-analysis-input.ts
modules/sucafina/Sucafinav1/product/ui/components.ts
modules/sucafina/Sucafinav1/product/ui/contextual-decision.ts
modules/sucafina/Sucafinav1/product/ui/contribution-body.ts
modules/sucafina/Sucafinav1/product/ui/decision-apply.ts
modules/sucafina/Sucafinav1/product/ui/decision-choice.ts
modules/sucafina/Sucafinav1/product/ui/decision-create.ts
modules/sucafina/Sucafinav1/product/ui/decision-edit.ts
modules/sucafina/Sucafinav1/product/ui/forecast-analysis.ts
modules/sucafina/Sucafinav1/product/ui/import-preview.ts
modules/sucafina/Sucafinav1/product/ui/personal-views.ts
modules/sucafina/Sucafinav1/product/ui/planner-monthly.ts
modules/sucafina/Sucafinav1/product/ui/portfolio.ts
modules/sucafina/Sucafinav1/product/ui/record-search.ts
modules/sucafina/Sucafinav1/product/ui/shell-state.ts
modules/sucafina/Sucafinav1/product/ui/work-collaboration.ts
modules/sucafina/Sucafinav1/src/nav.ts
modules/sucafina/Sucafinav1/src/screen-shell.ts
modules/sucafina/Sucafinav1/test/form-layout.test.ts
modules/sucafina/Sucafinav1/test/product/wp01/bi-browser.test.ts
modules/sucafina/Sucafinav1/test/product/wp01/browser-fixture.ts
modules/sucafina/Sucafinav1/test/product/wp01/browser-lifecycle.test.ts
modules/sucafina/Sucafinav1/test/product/wp01/component-coverage.test.ts
modules/sucafina/Sucafinav1/test/product/wp01/components.test.ts
modules/sucafina/Sucafinav1/test/product/wp01/contextual-decision.test.ts
modules/sucafina/Sucafinav1/test/product/wp01/decision-mutations.test.ts
modules/sucafina/Sucafinav1/test/product/wp01/edit-recovery.test.ts
modules/sucafina/Sucafinav1/test/product/wp01/http.test.ts
modules/sucafina/Sucafinav1/test/product/wp01/import-receipt-browser.test.ts
modules/sucafina/Sucafinav1/test/product/wp01/personal-views.test.ts
modules/sucafina/Sucafinav1/test/product/wp01/planner-monthly.test.ts
modules/sucafina/Sucafinav1/test/product/wp01/portfolio-recovery.test.ts
modules/sucafina/Sucafinav1/test/product/wp01/preview-browser.test.ts
modules/sucafina/Sucafinav1/test/product/wp01/record-search.test.ts
modules/sucafina/Sucafinav1/test/product/wp01/shell-state.test.ts
modules/sucafina/Sucafinav1/test/product/wp01/view-recovery.test.ts
modules/sucafina/Sucafinav1/test/product/wp01/workbench-analysis.test.ts
modules/sucafina/Sucafinav1/test/screen.test.ts
modules/sucafina/Sucafinav1/test/visual-layout.test.ts
```
