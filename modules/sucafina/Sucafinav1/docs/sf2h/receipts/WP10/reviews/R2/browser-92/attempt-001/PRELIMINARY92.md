# Missão92 / S2-R2 — parecer independente PRELIMINARY_FIX_FIRST

**Escopo:** `RUN-REVIEW-INTEGRITY`, WP10.T03, todos WP00–WP14 (somente leitura). **Autoria:** revisão nova GPT-6; sessão não exposta; login GitHub compartilhado `gustavomhss` não prova identidade da sessão. Nenhuma autoria anterior do produto por esta instância, nenhum teste/CI disparado, nenhuma modificação de código.

## Fotografia e regra de aprovação
- C44 `eecbdacb21734695094332deb6142aa35d5c9c3c`, tree `4d4b149917a2c74cfeb73e45774fe098666c208d`; planejamento imutável `dbf9547211d9b0fade619790de7c19c0869b7c7d`; branch review-integrity-final.
- A missão exige FINAL somente com C explicitamente congelado e recheck do diff desde C44. **Não foi apresentada aceitação FINAL C**. PR fonte/receipts anteriores não equivalem a provas no candidato composto.
- Critérios: `CRITERION-INDEX92.json` contém integralmente os **1560 IDs** presentes nos 15 `review_sources_read_only` do pack S2-R2 (estado conservador NOT_CERTIFIED). São subset do escopo global imutável declarado de 1610; **não converter 1560 em 1610 nem remover os demais 50 sem reconciliar a fonte global**. Os 40 IDs próprios de WP10.T03 e provas associadas estão indexados. Zero critérios certificados.

## Findings próprios com classificação
| Finding | Estado em C44 | Writer/correção | Evidência |
|---|---|---|---|
| F92-EGRESS-01 | OPEN / HIGH | 86+71 | `runtime/application.ts:780–798`: export byte egress após lock sem revalidar; PR86 propõe second-fence |
| F92-PURE-02 | FIX_FIRST / HIGH | 81+71 | `signal-registry.ts:58,89,169`; `outcome-selection.ts:50`: state.transaction na camada de memória |
| F92-FIRSTSAVE-03 | MISSING_INTEGRATION+PROOF | 87/52/71 | C44 draft blob a0c1d07b; PR92 d880fe5a e rota; diferente da recuperação body-retido65 |
| F92-C10-04 | SOURCE_PRESENT, RELEASE_PROOF_MISSING | 80/71/45 | C44 blob bfcb6e419 = PR90, R3 PASS em outro S, R4 failure counterfactual |
| F92-M31-05 | MISSING_EXACT_C_PROOF | finanças/71/45 | Porta mantém valor/holder, mas não se observou teste de ciclo instalado do mesmo C |
| F92-AUTH-06 | MISSING_COMPOSITE_NEGATIVE_PROOF | 72/59/85/71/45 | Local fence/write/restart/Graph composition pendente |
| F92-ATLAS-07 | MISSING_FINAL_C_AM05_PROOF | 69/71/45 | Snapshot store lido, faltam scanner real/restart/ACL no C |
| F92-HTTP-08 | MISSING_NODE_EFFECT_PROOF | 74/71/45 | Byte limit leitor lido, faltam listener e POST completo no C |
| F92-COMPOSE-09 | FINAL_GATE_BLOCKER | 71/S0 | sem C congelado/review delta e provas 8 CI + AM01–06 + G7C/G8D |

**Não foi afirmada exploração executada ou regressão sem reprodução.** Conjuntos de linhas, blobs, owners, counterexamples, provas e correções necessárias estão em `FINDINGS92.json`.

## Código real lido
- C10 `assessCostCoverage` e `reassessScenarioCoverage`: entrada/evidência destacada, nulidade e classificação; falta validar sobre a composição final e os consumidores. Oráculos normativos 55000/15000, 70000→235000 e 5000 de vantagem, FX EUR e versões permanecem intactos.
- M31: `porta/act.ts:239–268`, `src/procurement.ts:32–67`, `runtime/procurement.ts:629–654`. Código contém congelamento de aprovação; resultado funcional completo NÃO testado por R2.
- C12: `decision-host.ts:210–285,410–432`, `prepared-apply.ts` e `choice-result-lookup.ts:11–33` lidos; lookup de cenário possui leituras repetidas e último revalidate; primeira gravação draft pós-ACK distinta.
- Segurança: `auth-maintenance.ts`, `request-body.ts`, `application.ts` e correções fonte PR86.
- Atlas: `atlas-store.ts:1–52`; registries WP14 chamam persistence diretamente; fronteira e reinício exigem prova.

## Prova externa verificada, sem reexecução
- GitHub Actions [C10 R3 `43675129605`](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43675129605): success, S=`da3097fc435b232ab3dcf77c036f3d3dfb5e0142`; é seleção focada, não suite final C44.
- [Counterfactual C10 R4 `43676126745`](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43676126745): expected failure, S=`1b0359f078951b819622d0438394ac63ef43e010`; **não integrar**.
- Query GitHub Actions com `head_sha=C44` retornou 0. Snapshot S descendente pode existir e exige busca por dispatcher45; não inferir ausência universal.
- No PR86 egress proposal foi encontrado o mecanismo pós-download. Em C44 o código não o possui. O R2 não adotou o parecer84 como evidência autossuficiente.

## Encaminhamentos feitos
- [PR86 comentário 6889361413](https://github.com/gustavomhss/Orchestra-SF/pull/86#issuecomment-6889361413), [PR92 comentário 6889361757](https://github.com/gustavomhss/Orchestra-SF/pull/92#issuecomment-6889361757), [PR90 comentário 6889362045](https://github.com/gustavomhss/Orchestra-SF/pull/90#issuecomment-6889362045), [PR65 comentário 6889362463](https://github.com/gustavomhss/Orchestra-SF/pull/65#issuecomment-6889362463).
- Dispatcher45: ler `CI-REQUEST45.json` e deduplicar seleção por SHA/tree/request/config/test/fixture; oito suites mínimas, typecheck, guards, AMs, casos causais.
- Integrador71: compor apenas patches de owners com CAS e provenance exatos, entregar C congelado, delta completo, provas do C, sem reescrever plano, sem redesenhar política financeira.
- S0: aplicar gate G7C/G8D, 3 pareceres independentes, não liberar enquanto obrigatório OPEN/MISSING_PROOF.
- Revisor S2-R2: reavaliar todos os fixes e arestas somente no exato C final, emitir um novo receipt append-only com SHA/tree, nunca transformar este preliminar em FINAL retroativo.

**Parecer:** `PRELIMINARY_FIX_FIRST`. **GLOBAL_RELEASE=false**.
