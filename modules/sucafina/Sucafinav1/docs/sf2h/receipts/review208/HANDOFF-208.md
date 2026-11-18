# Handoff — Mission 208 / S2-R2 integrity review

**Status:** PRE_FREEZE_REVIEW completo para fontes disponíveis, **não FINAL**. **Verdict: FIX_FIRST**. **GLOBAL_RELEASE=false**. Modelo efetivo: GPT-6; sessionID: **não exposto**. Reviewer sem autoria do produto, sem acesso a Azure/segredos e sem execução de testes, compilação, validators ou workflows. Produto examinado: `sf2-stack@6130f682014662964a2f2fcd2c0c487a904ecd3e`, tree `6bef2964c3904aef5b92017c6e0e1aaa2d236a25`. Branch de recibos `sf-review-integrity`, epoch `cold-review-e1-browser208`.

## Resultado causal

**REV208-NEW-001 (P2)** — guard de unidade BI aceita unidade física incompatível quando moeda coincide: `product/analytics/semantics.ts:21`, blob `ef1adaaf457c2ef3846fe12be8674455ca2d72c4`; consumidor `product/analytics/view.ts:267-285`, blob `b131fb28a385105f0e8ef5b337ffa4e5bca15f21`. Contraexemplo: `value.unit='hours'`, `value.currency='USD'`, `series.unit='USD'`. Não alterar regra de cálculo/FX; impedir rotulagem/escala falsa. **Owner:** BI semantic producer via 189, N02/A08 e N26/U20–U21 apenas na lease adequada. **Recheck:** 200 executar seleção BI no C admitido, positivos e negativo de unidade explicitamente discordante, null/zero e rótulos.

**REV208-NEW-002 (P2)** — `product/host-binding/atlas-store.ts:19-38`, blob `0d7a1fa1d0f138d99fd0dc358ab898ebf828dcbf`, aceita evento persistido após troca de `seq` por outro inteiro seguro; a comparação usa `{...event, seq:expected.seq}` e depois ordena pelo seq adulterado. Não se afirma que um usuário externo pode editar o journal, e não se propõe comparar diretamente seq com o ordinal constante de `versioned([record])`. **Owner:** WP10.T07/Atlas via 189, prova seletiva 198/200. **Recheck:** dois registros + reinício limpo, ordinal duplicado/trocado falha fechado sem vazamento, append subsequente monotônico e scanner real.

**NAV-01 (P1 herdado da 203, não novo)** — `apps/cli/src/sucafina-product/native-ui/router.ts:77-82` blob `17db52d914ca49934953e1161461b03856eb29c5` ainda não veta `q` na URI POST; registry POST/JSON/4096 já está declarado. 203 entregou patch inerte e request próprio a 200. Somente 189 pode integrá-lo. Não duplicar teste nem achado.

## Revisão 147 preservada (4 IDs, não encerrados)

- **PRE147-R02-01 (P1):** cross-installation/project; comparador agora veta contextos divergentes em `reviews/preserved/model.ts:33-54` blob `933426ea548c2c82c115f34c2f099df82379daee`. Mesmo-C negativa ainda **NOT_PROVEN**.
- **PRE147-R02-02 (P2):** unidade, moeda, evidência e `0/null` visíveis no comparador `reviews/compare/index.tsx` blob `638ca5f806f1d11b8549972ba5559b4913ba4e6b`. Mesmo-C acessibilidade/diferenças ainda **NOT_PROVEN**.
- **PRE147-R02-03 (P1):** mudanças sourceRefs, encarnação e proveniência agora detectadas no `model.ts` e `compare/index.tsx:199-205,250-295`. Mesmo-C revisão histórica e revogação ainda **NOT_PROVEN**.
- **PRE147-R02-04 (P2):** `imports/index.tsx:155-194,230-244` blob `ddd1b441f869e6824d6919827b9c53faa17f84ac` limpa targets por período e exige rediscovery. Mesmo-C janeiro→fevereiro e negativa com owner distinto ainda **NOT_PROVEN**.

## Cobertura e limites

Os **40/40 critérios próprios WP10/T03** estão explicitamente rastreados em `COVERAGE-208.json`: **40 NOT_PROVEN**, nenhum foi promovido a PASS por simples leitura estática. A matriz paralela diferencia FAIL nos pontos BI, journal Atlas e NAV-01 já conhecido; registra source-static PASS limitado para original Request auth, revisão cross-project, sanitização pré-download e ordenação C12 de execução. A inspeção passou por C03/C06/C12, semântica de cobertura/zero/null, Microsoft callback/PKCE/JWT/Graph role, operação e revogação de Request original, reports/download, scoping de memória, scanner e tombstone161. Não prometo atomicidade global: recibo é commit no domínio e a atualização de caso é reconciliação posterior; transações `transactionAll` só onde a porta concreta fornece a operação.

**Não confundir:** 43775214053 C08 e 43775606150 F04 provaram subsets em outros SHAs; 43775802204 AM01/AM03 falhou em outra seleção. Não há prova positiva integral no C final. Os bloqueios UI62 e UI57 já são da revisão207, e R148-NATIVE-01 da209: sem IDs duplicados.

## Próxima ação exata / owners

1. **189 / PR65:** revalidar HEAD/fence e cada preimage; encaminhar REV208-NEW-001 a writer da semântica BI e REV208-NEW-002 a writer Atlas, consumir patch NAV-01 da203; preservar 15 WPs/74 tasks/17 contratos/1610 critérios e todo UX congelado. Publicar novo C/tree/blobs causais.
2. **190 / PR107:** compilação/guards na própria lane somente se impacto do novo C, sem reexecutar W anterior idêntico.
3. **200 / PR106:** reconciliar fila/runs e pedir a mínima seleção discriminante para unidade BI e ordinal Atlas+restart, juntar rechecks U32/U23 quando os respectivos blobs mudarem, mantendo fixtures/oráculos negativos. Nenhum novo runner ou workflow.
4. **199:** entregar referência **não secreta** do manifesto de fixture aprovado e readiness/identidades por papel + prova D01 empacotada. Sem token, tenant secret ou mock.
5. **Reviewer independente sucessor:** no C formalmente aceito, confrontar deltas e same-C proofs das 40 linhas e findings; mudança após aceite reabre apenas o recheck causal. Nenhum `APPROVE` antes do predicado integral.

Este handoff conclui somente o escopo independente antecipado da208; comentários nas PRs são avisos, não ACK, wake ou liberação.