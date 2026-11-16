# Missão 212 — fechamento de autoria, aguardando validação do candidato C

**Branch:** `sf-hypothetical-fix` · **epoch:** `hypothetical-e1-browser212` · **PR:** [#193](https://github.com/gustavomhss/Orchestra-SF/pull/193) (*draft*, base `sf-closure-bundle`, consumidor PR #191) · **code commit:** `ce88b1b6083b9e37c9e9310a8e20b30d0bfdc8b4`.

**Identidade:** GPT-6 efetivo nesta sessão; sessionID e modelo native provider não expostos. S0-FENCE verificado; ACK comitado no SHA `958b1aa1b8ac0d615c7b7c7bc72dd70973e7d568`. Nenhum lifecycle externo inferido.

## Diagnóstico verificável

Run original `43775802204`, job `133001695266`, `CI200-AM01-HYPOTHETICAL-TOTAL`: o helper promovia `{operations: [], assumptions: []}` e exigia `baseline.result.total === null`; recebeu `240000`. O produtor normativo `product/planner/scenario-port.ts` seleciona **observação de fonte** quando os dois arrays estão vazios. Com C10 completo retorna legitimamente `comparisonStatus: complete, total: knownSubtotal`. Logo, a falha causal era no **setup de cenário do helper**, não no produtor e nem na assertion normativa da simulação hipotética.

A correção extrai da projeção Planner autorizada um único serviço de janeiro confirmado (`wp12-cost-service:1`) e constrói uma operação `replace` com **o próprio valor observado**. Esse comando roda sobre snapshot clonado, sem persistir no domínio. O novo resultado deve manter `total: null`, `comparisonStatus: conditioned`, `scenario-is-hypothetical` e `preview-not-applied`; as asserções do total nulo não foram relaxadas. O valor é lido da fonte, não fabricado.

Os três cenários preservam a distinção exigida por C09/C10: baseline **240000** com treinamento zero explicitamente confirmado; pending **210000** sem linha de treinamento (cobertura `pending/missing-category`, não zero); complete **250000** com treinamento confirmado **40000**. Os subtotais conhecidos não viram total aprovado, nem autorizam aplicação.

## Código comitado e contrato de integração

| Path | Preblob | Postblob | Situação |
| --- | --- | --- | --- |
| `modules/sucafina/Sucafinav1/test/product/wp12/native-scenario-preparation.ts` | `3f02a1ad9ee2985b4094690bd32c16e22a0dda75` | `5d483cad26e595b7744794098a9ffe15605e3b8f` | **Aplicado por 212** |
| `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am01/hypothetical-closure212.test.ts` | Ausente | `f20fdab67655572f181f78e64b3023f993346d7c` | **Novo spec aplicado por 212** |
| `modules/sucafina/Sucafinav1/test/product/wp12/native-execution-scenarios-review.test.ts` | `80da902f35f80d9b61175fd90d5c10fa7b3f00aa` | `cef673fe075775a8e4000734b4f028e941fa875f` | **Patch INERTE para 211; NÃO aplicado** |

Novo regression spec: contraprova da rota de observação; três previews reais; ausência distinta de zero confirmado; persistência C09 e `resultRef` após reabrir host; digest do Planner idêntico antes/depois. Não instala provider, output LLM, grants externos nem fatos falsos.

O consumidor original `native-execution-scenarios-review.test.ts` ainda mandava o LLM executar `operations/assumptions` vazios. O patch inerte completo em [`patches/211-native-scenarios-review.json`](patches/211-native-scenarios-review.json) substitui apenas esta instrução pelos dois pedidos de cenário exatos já persistidos. Preblob foi observado no HEAD da 211 (`b0159b461f843fdb2cc6f708b5d1eb9d3331b0d4`). 211 verifica novamente HEAD e preblob, comita sob seu CAS e **não escreve nas branches de autores**.

## Requests — não despachados

- **214:** [`CI-REQUEST.json`](CI-REQUEST.json) apresenta seletores reais de `hypothetical-closure212.test.ts`, `native-execution-scenarios-review.test.ts`, `wp03/scenario-costs.test.ts` e provas AM01 da 196, com paths relativos a `modules/sucafina`. Só o dispatcher 214 reconciliado pode executar em Actions, depois de 211 compor o mesmo candidato e aplicar patch, sem duplicar run/proof.
- **190:** [`COMPILER-REQUEST.json`](COMPILER-REQUEST.json) solicita o script existente do pacote Sucafinav1 (`tsgo --noEmit`) para o mesmo candidato C. 212 não executou typecheck, build, teste nem validator local.
- **196:** fonte `2c0416ca80c2367843be7b39dbc4a7fb677a2185`, cinco perfis/18 skills e os testes AM01/AM02 mantidos intactos. Prova positiva nativa exige modelo instalado, C15/C16 reais e Reviewer com run independente.

**Validação:** correção **NOT_RUN**, compile **NOT_RUN**, inferência C15/C16 **NOT_RUN**. O log da falha original não é evidência de PASS. **GLOBAL_RELEASE=false**, goal nativa pausada. Aceite final exige composição do produto, AM01–06 no mesmo C, 214/190, D válido, reviews 207–209, G7D/G8 e proof remoto.

**Próxima ação contratada:** 211 consome o commit `ce88b1b6083b9e37c9e9310a8e20b30d0bfdc8b4`, verifica pre/post e aplica o patch inerte; 214 recebe o CI request, 190 recebe o compiler request. Nenhuma instrução nova em outro chat, segundo S0/watchdog, dev merge, deploy ou bypass.
