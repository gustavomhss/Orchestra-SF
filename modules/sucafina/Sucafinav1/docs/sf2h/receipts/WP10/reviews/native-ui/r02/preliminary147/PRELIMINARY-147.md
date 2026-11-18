# Missão 147 — R02 antecipada: revisão financeira e de autoridade (PRELIMINAR)

**Veredito:** `PRELIMINARY_FIX_FIRST`. Quatro achados de código, ainda **OPEN_STATIC_RECHECK**. Nenhum teste executado; nenhum resultado de CI concedido; nenhuma aprovação R02 FINAL, waiver, C/D, release ou Goal. Produto e testes permaneceram exclusivamente em leitura.

- Ator: nova conversa ChatGPT, modelo efetivo **GPT-6**; ID de sessão não exposto; epoch `pre-r02-e1-browser147`.
- Branch exclusiva `sf-review-integrity`; material congelado somente para esta inspeção `d8f14f81855858120f914af4f3934406bfdb74f1`, árvore `c792f5d0d3be378ca86aea09bcabdd8781734d8f`. **Esse corte não equivale a C final aceito**.
- ACK real por GitHub MCP/CAS `force=false` em `a18df9c92b749e819fab68192be4a46b5c179150`; blob `c6f18f61e3eaa313a4592cf730a21119c7493e38`.
- Rechecagem de **mesmos blobs de produto** na integradora `sf2-stack@8094e599e3d18609e269548d24619a3246fbc735` para `reviews/preserved/model.ts`, `reviews/compare/index.tsx`, `imports/index.tsx`. Persistem sem correção nesse snapshot; não se presume ausência de correções futuras ou em branches de autores.
- Fonte imutável missão147: `81fbb8364ca474db8f718faad20c9235519e98fe`, blob `86a6337ebb97a770488a6eb5ac845c3203a9c53a`. Revisão de plano normativo `cbac654784714f68779ae1434d30e6ea8970c4d1`; planejamento canônico `dbf9547211d9b0fade619790de7c19c0869b7c7d`. `AGENTS.md` raíz lido; fence132 blob `a9e06598c464998c1e47b2747cc1cd378d02df73`.

## Achados causais novos

1. **PRE147-R02-01 — HIGH — comparabilidade sem identidade de instalação/projeto.** `reviews/preserved/model.ts:24–35` compara período, moeda, superfície e engine, mas não `installationId/projectId` previstos em `packages/schema/src/sucafina/reviews.ts:49–54`. `reviews/compare/index.tsx:143–160` pode apresentar cortes de origens diferentes como compatíveis. A leitura é individualmente reautorizada; **não alegamos vazamento cross-tenant comprovado**. Recheck negativo e positivo necessários. Autor **152/PR152**, integração **132/PR65**.
2. **PRE147-R02-02 — MEDIUM — moeda, unidade e confiabilidade invisíveis no diff financeiro.** `reviews/preserved/model.ts:45–49` detecta mudança de `currency`, `unit` e `evidenceState`; `reviews/compare/index.tsx:181–185` exibe só os números. Exemplo autorizado: `100 USD → 100 EUR` aparece `100 → 100`. Autor **152/PR152**.
3. **PRE147-R02-03 — HIGH — mudança de versão/linhagem da fonte vira “inalterado”.** `reviews/preserved/model.ts:39–50` e `reviews/compare/index.tsx:110–116,158–165` não consideram `sourceRefs.version/incarnation/observedAt`. Duas revisões com valores iguais e fonte v7→v8 chegam ao fallback “inalterado”, apesar de proveniência distinta. O schema publica esse histórico em `reviews.ts:25–29,83–92`. Autor **152/PR152**.
4. **PRE147-R02-04 — MEDIUM — destino de importação não é invalidado ao mudar período.** `imports/index.tsx:141–165` mantém `targets/selectionRef` ao chamar `change()`; `imports/index.tsx:401–416` chama esse caminho ao alterar datas; `imports/index.tsx:201–224` reaproveita o destino selecionado na admissão, sem `files.import-targets` para novo período. O backend ainda deve reautorizar; **não afirmamos commit não autorizado**. Autor **157/PR157**.

Detalhes determinísticos com URL exata de **SHA/path/linhas/blob**, cenário de reprodução estático, impacto, owner, critério e próximo recheck estão no `FINDINGS-147.json`.

## Deduplicação independente

`PR100` (R1-91-001 firstsave; R1-91-002 export egress; R1-91-003 final proof), `PR97` (F92-EGRESS/PURE/FIRSTSAVE/C10/M31/AUTH/ATLAS/HTTP/COMPOSE) e `PR98` (gallery/runtime/CI) continuam **referências históricas OPEN/MISSING_PROOF**, e não quatro achados relançados. A correção de primeiro save não foi declarada resolvida porque o novo CAP25 ainda exige prova de idempotência, reload e reconciliação por recibo.

## Controles positivos, sem extrapolar PASS

- CAP14/CAP25 usam códigos de ação de contexto e projeção, validam versões para alterações, fazem `401/403/409` e evitam retrial automático de POST nos caminhos lidos. Isso é somente observação de fonte; produtor, tenant e CAS dentro da transação **NOT_RUN**.
- `SfStatePanel` exclui conteúdo no estado `unavailable`: o caminho waterfall/timeline de BI é subordinado ao painel. Não foi emitido falso achado de vazamento BI fora do state gate.
- Zero permanece distinguível de `null` em caminhos BI e renderização simples observados, mas não houve fixture nem oráculo completo; cobertura numérica C10/C12 e FX permanece **MISSING_PROOF**.

## Matriz de prova e limite

| Critério | Estado do exame147 |
| --- | --- |
| `U32-AC01` comparação/versão/corte | **OPEN**, PRE147-R02-01/02/03 |
| `U32-AC02` acesso negativo/revogação | **MISSING_PROOF**, requer casos reais do 150 |
| `U23-AC01` import/preview/impact/receipt | **OPEN**, PRE147-R02-04 |
| `U23-AC02` autorização e stale | **MISSING_PROOF** |
| `U20-AC01` BI/waterfall/zero/ausente | **MISSING_PROOF**, sem finding causal novo nessa amostra |
| `A07-AC01` valor/nulo/zero/versão | **OPEN**, linhagem e exibição UI49 |
| `R02-AC01`, `R02-AC02` | **PLANNED/NOT_RUN**; candidato C final não aceito |
| Checks 149/PR107, 150/PR106 e gates C→D | **NOT_RUN/NÃO VERIFICADOS nesta missão** |

As categorias foram examinadas por leitura de fonte; **ausência de execução não é PASS**. Reexecutar validações somente por responsáveis autorizados 149 e 150; nenhum novo dispatcher.

## Roteamento e handoff

O arquivo `HANDOFF-132.md` ordena exatamente as correções de 152/157, reconciliação por CAS por 132, pedidos de compilação a 149 e testes cirúrgicos a 150. Revisão R02 definitiva exige candidato C congelado, correções integradas e recheck independente da mesma árvore mais provas admitidas. **GLOBAL_RELEASE=false; Goal pausada**.
