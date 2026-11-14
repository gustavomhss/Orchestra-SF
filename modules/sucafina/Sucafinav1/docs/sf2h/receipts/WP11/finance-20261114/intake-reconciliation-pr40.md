# Reconciliação PR #40 em astra-finance

Fonte: PR #40, head `be50d42d6a2c030d57d17038dec267ebd33ea78c`. Baseline próprio W14: `fe13ee693bdcec1830190bcdb5cc7f2794942c1f`, árvore `1ce4e9fcb2e9fb81e12dcfd773aa2daae64be39a`. Os blobs alvo permaneceram iguais a W14 enquanto outros incrementos chegaram à branch. Publicação e CI são do root.

## Resultado

**40 paths reconciliados: 28 blobs exatos, 6 merges delimitados e 6 arquivos correntes preservados.** São 34 paths com delta. Antes de escrever, todos correspondiam ao remote-state; os 52 blobs hidratados tiveram Git blob/SHA256 verificados. Nenhum teste, typecheck, CI ou escrita remota foi executado por este integrador.

## Correções concretas

- **CAS após aplicar:** PR40 já relê cases depois do produtor e usa a versão corrente/digest integral no CAS, preservando edição independente. A segunda consulta autoritativa de recibo do patch OPS-C12 faltava e foi unida aqui.
- **Última callback:** a revisão independente detectou que uma callback após a consulta final ainda poderia trocar só receipts sem mudar cases. O commit agora verifica no mesmo snapshot C08 a presença/igualdade do recibo já autorizado e seu review proof, além da unicidade da tupla do leitor canônico. A revisão final encontrou e fechou essa segunda janela de colisão com ID distinto. A leitura não fabrica autoridade e não chama produtor recursivamente sob lock. Os retornos de replay e póscommit têm observação C08 final após callbacks.
- **Negativos de recibo:** os três modos originais de execução permanecem. Seis novos modos cobrem retirada/troca/colisão antes e depois da consulta final; cada um também provoca corrida na última callback de retry reconciliado. Exigem recuperação do recibo exato, caso preservado, ausência de novo efeito e reopen.
- **Histórico C17:** a falha S5 era admissão UI emitida sem consumo. O teste usa o consumo real já implementado no fixture; Request permanece privado. Entram também os dois negativos PR40 de fonte/request alterados na última callback.
- **Fixtures e assertions:** preservadas igualdades integrais de cobertura, bounds exatos, init das três superfícies do W5 e limites sintéticos do AlternativeDraft. O fixture Procurement usa o projetor canônico corrente já pareado com seu resolver, sem importar políticas estrangeiras.

## Relação com OPS-C12

O root leu por GitHub MCP o patch em `b98264317b39bec01c57e31a5c197802a954429f`, blob `fef1826566873e4cdd6b2b48184bf72f79892ab8`; a união externa está em `4bdd12ac162d61465557363953e25dfd99fad5e8`. [Alerta PR35](https://github.com/gustavomhss/Orchestra-SF/pull/35#issuecomment-6875610872). A PR40 original não era um superset integral: a consulta final e o fence de snapshot são deltas desta reconciliação. Os H02/H03/H05 precisam de consumo e validação do owner no pin publicado.

## Arquivos e blobs

| Arquivo | Ação | Blob PR40 | Blob resultante |
|---|---|---|---|
| `product/decisions/analysis-promotion.ts` | preserve-current | `e0c77974ac694132c5dbdc370fa3a48151c4d825` | `43e1de8c347faea2953ff5baa2919b3b061fc4e4` |
| `product/decisions/application-attempt.ts` | adopt-exact | `d7ef49df787cc4b058f0992b1fbbdc5c0cb6634e` | `d7ef49df787cc4b058f0992b1fbbdc5c0cb6634e` |
| `product/decisions/application-status.ts` | adopt-exact | `29a01e27af230df149e8862beb370f466abf0808` | `29a01e27af230df149e8862beb370f466abf0808` |
| `product/decisions/apply.ts` | merge-delimited | `229e64c2d8109b413a7667bbe1b208ffa3ab0a73` | `964a53310c340f4496d7410d66f8b852270b75f1` |
| `product/decisions/assumption-divergence.ts` | adopt-exact | `d70725ebd2ed99ffe9a617b21eac6fe17e089abd` | `d70725ebd2ed99ffe9a617b21eac6fe17e089abd` |
| `product/decisions/cost-coverage.ts` | preserve-current | `8fb15ebf1823314e565bef83509f3defa3905bcc` | `09097eaba2e0eae71d33d88077a2f86e83e1dde9` |
| `product/decisions/current-choice-preview.ts` | adopt-exact | `12f9bda4f964763e8c6d60fb67e5fb68a08cd9ee` | `12f9bda4f964763e8c6d60fb67e5fb68a08cd9ee` |
| `product/decisions/current-choice-promotion.ts` | adopt-exact | `2441642f59179516da09c9f9780b1b4764f6fd83` | `2441642f59179516da09c9f9780b1b4764f6fd83` |
| `product/decisions/host-product.ts` | adopt-exact | `74450e928e9bdf67df701f0a1e790ce5829016c7` | `74450e928e9bdf67df701f0a1e790ce5829016c7` |
| `product/decisions/http.ts` | adopt-exact | `596512b4e12c094fd178ea845f4b560bbf23a348` | `596512b4e12c094fd178ea845f4b560bbf23a348` |
| `product/decisions/human-grants.ts` | adopt-exact | `1cd4e7ddd5640fd3dd156ce45b486a4b3f0d6917` | `1cd4e7ddd5640fd3dd156ce45b486a4b3f0d6917` |
| `product/decisions/mutations.ts` | adopt-exact | `81513bbca0d087211e4d3d46afe805941bb98a6c` | `81513bbca0d087211e4d3d46afe805941bb98a6c` |
| `product/decisions/portfolio-bindings.ts` | adopt-exact | `8815cc1fc27b570d241e2dd464d925eff05e5455` | `8815cc1fc27b570d241e2dd464d925eff05e5455` |
| `product/decisions/portfolio-history.ts` | adopt-exact | `b90dcbc9e79e6dc505780da885c1fbd504c1fb4c` | `b90dcbc9e79e6dc505780da885c1fbd504c1fb4c` |
| `product/decisions/prepared-apply.ts` | preserve-current | `acb3b7fb3050264758a5470ffe8168fa5f581370` | `90c3e981d8418c562342660bd3d56d03f9995383` |
| `product/decisions/product.ts` | adopt-exact | `1ba2255fd5792cf78d161fe82233ed21cff54f04` | `1ba2255fd5792cf78d161fe82233ed21cff54f04` |
| `product/decisions/result-store.ts` | adopt-exact | `bc32bfb39e8b6012230ee0d136bed142340e5d89` | `bc32bfb39e8b6012230ee0d136bed142340e5d89` |
| `product/decisions/scenario-request-store.ts` | adopt-exact | `368a7f2e207c4f551ac3c6f77424797c97f794f3` | `368a7f2e207c4f551ac3c6f77424797c97f794f3` |
| `test/product/wp11/analysis-promotion.test.ts` | merge-delimited | `245a23677bf2bc317a768675fa7b267c9e999c1a` | `b6006c50664364aab74152286fa58d943b9f3a97` |
| `test/product/wp11/application-indeterminate.test.ts` | adopt-exact | `d13ec6d28ff5eb89bb00e8db39ef9065aab394a2` | `d13ec6d28ff5eb89bb00e8db39ef9065aab394a2` |
| `test/product/wp11/assumption-divergence.test.ts` | adopt-exact | `7427441bfb0fbc795f810265b302cd9563ea5bea` | `7427441bfb0fbc795f810265b302cd9563ea5bea` |
| `test/product/wp11/assumption-fixture.ts` | adopt-exact | `11ee78d20722a49be19e52bb21ecd42b010dfd7c` | `11ee78d20722a49be19e52bb21ecd42b010dfd7c` |
| `test/product/wp11/calculation-history.test.ts` | merge-delimited | `5c98fc71702c71ffb976735490fbaf1036a64e19` | `ae99e63e1e9987be91c46d231bba05ec24748ca1` |
| `test/product/wp11/case-authority-concurrency.test.ts` | adopt-exact | `4ab80cd8cdb2f2e310f7eb55908919d32f8e2444` | `4ab80cd8cdb2f2e310f7eb55908919d32f8e2444` |
| `test/product/wp11/case-import-incarnation.test.ts` | adopt-exact | `fe8e2173a1291efd8bed0305c8ef6b5c3e725a94` | `fe8e2173a1291efd8bed0305c8ef6b5c3e725a94` |
| `test/product/wp11/case-port.test.ts` | adopt-exact | `a74b7eb8e4510f20f61a4cdc5ee61fcac2e01c97` | `a74b7eb8e4510f20f61a4cdc5ee61fcac2e01c97` |
| `test/product/wp11/composite-coverage.test.ts` | merge-delimited | `02a78aa9ce4d87d2636db30c60128e2825d8af4b` | `3196d7885a6cecbc4afff9b3044857400753280a` |
| `test/product/wp11/coverage-access.test.ts` | preserve-current | `75714114bc555d017c7c801a5de486b92ab7d9f6` | `6b9f5a226e6167a22d1a579b812ad92b41b8fbd3` |
| `test/product/wp11/criterion-rules.test.ts` | adopt-exact | `ea9146c2bf47822f4a7fb47f540b0f66afa35615` | `ea9146c2bf47822f4a7fb47f540b0f66afa35615` |
| `test/product/wp11/cross-domain-execution.test.ts` | merge-delimited | `9b6bfc3ef7c7119274428e61c61c4d49c4a39e17` | `3cf9948e4fefbeceb4c2e99b04dc47b4e29ad816` |
| `test/product/wp11/current-choice-lifecycle.test.ts` | adopt-exact | `5b754d16c5d61764bffc8268075fbd4551dd2072` | `5b754d16c5d61764bffc8268075fbd4551dd2072` |
| `test/product/wp11/execution-reconciliation.test.ts` | merge-delimited | `62365bd79c1f90b6ee90e64746678bfe779011cf` | `b6499c30a3a2482cd96c72e3b4b6bf9b2a04c72e` |
| `test/product/wp11/http.test.ts` | adopt-exact | `864325e74086a6a39b7240cfddcd5ff16064160f` | `864325e74086a6a39b7240cfddcd5ff16064160f` |
| `test/product/wp11/planner-apply.test.ts` | preserve-current | `d01bf28e150197deb8dd2b06469f57a7dc0b0b5b` | `160df21d7dd44109c392cf213680629b6c26d450` |
| `test/product/wp11/portfolio-history-version.test.ts` | adopt-exact | `5d5491cd95fb989f1233ba49db6185214e980899` | `5d5491cd95fb989f1233ba49db6185214e980899` |
| `test/product/wp11/prepared-rejection.test.ts` | adopt-exact | `1ec3fa08e6ef4bdb226a5c26838b01553606872e` | `1ec3fa08e6ef4bdb226a5c26838b01553606872e` |
| `test/product/wp11/proposal-coverage.test.ts` | preserve-current | `be3f5a5116a09dea9c3549cc709bc6f99b23196f` | `fa55d820dec5c6dce1d449d469cb6f1d2c350b8a` |
| `test/product/wp11/renewal-choice-revision.test.ts` | adopt-exact | `c2901936d6730b56422b2c495069c0ed0a0705ce` | `c2901936d6730b56422b2c495069c0ed0a0705ce` |
| `test/product/wp11/renewal-human-choice-fixture.ts` | adopt-exact | `7e748ba9d2acacdc81b83ff50463c6d1dc4dd281` | `7e748ba9d2acacdc81b83ff50463c6d1dc4dd281` |
| `test/product/wp11/renewal-implementation-quote.test.ts` | adopt-exact | `39c8b0e9138c36d5bd4a92726279633f69381cf6` | `39c8b0e9138c36d5bd4a92726279633f69381cf6` |

## Preservações deliberadas

- `product/decisions/analysis-promotion.ts` — Renomeação local equivalente; preservado savedVersion do grupo.
- `product/decisions/cost-coverage.ts` — Set<string>.has e readonly array.includes equivalentes; preservada implementação C10 corrente.
- `product/decisions/prepared-apply.ts` — Somente alias de tipo PreparedOutcome; preservado produtor canônico corrente.
- `test/product/wp11/coverage-access.test.ts` — PR40 enfraquece igualdade integral para arrayContaining; preservadas assertions integrais e tipagem do grupo.
- `test/product/wp11/planner-apply.test.ts` — Preservada inicialização W5 das três superfícies; PR40 remove procurement do fixture.
- `test/product/wp11/proposal-coverage.test.ts` — Renomeação equivalente da mesma WeakSet compartilhada; correção funcional já publicada.

## Dependências e limites

Os factories exportados realmente consomem status de aplicação, divergência e current choice; não há stub que promova resultado. Compose precisa fornecer os callbacks obrigatórios de fonte, ressimulação, cobertura e snapshot privado, além do mount HTTP. O caller CLI atual não foi demonstrado neste checkout. O fixture cross-domain consome o par canônico disponível; não comprova o último host WP04.

Batch, calculation-persistence e resume-engine-freshness pertencem a incrementos paralelos explicitamente excluídos. Nenhum engine, contrato, host, artifact-store ou receipt anterior foi editado. Os 29 novos docs PR40 são consumidos intactos pelo root; o JSON registra cada blob.

## Evidência CI herdada

- Run 43580722320, produto `efa0e57e54862f99a07b2837af5e729adb881415`, seleção `bd0837b1fbd179cf044691981ba57e39c30f031c`: cancelado aos 45 min,48 passes / 4 falhas observadas,31 arquivos incompletos e sem resumo Bun final.
- Check 43584172588, produto `c52f7eed38cefd58962251a8d27a41777af18f6d`:143 TS (10 próprios Response do fixture import e 133 externos); guards passaram: 78/720/12 warnings/0 errors. O head traz a correção dos 10, ainda sem execução deste candidato.
- S5 do grupo em W14: 12 passes / 2 falhas; admissão history corrigida aqui, cálculo C17 aninhado: 195910 ms / 180000 ms ainda no incremento paralelo. Root anexa run/selection precisos.

Essas provas são históricas e não validam este merge. A revisão de autoridade é estática e delimitada; o último ajuste de fence foi relido por /root/review_final_apply, sem novo bloqueador concreto no recorte. A primeira folha proposta é execution-reconciliation.test.ts, seguida apenas dos consumidores afetados necessários. As demais folhas por mudança estão no JSON, sem propor epic de grupo nem runs duplicados.

**Estado:** candidato reconciliado para captura pelo root; validação hospedada, composição real, provas nativas e C/D permanecem pendentes. Não constitui aceite global.

## Diffs para captura

- `intake-reconciliation-pr40.diff`: W14 para candidato, somente os 34 paths autorizados.
- `intake-reconciliation-pr40-own-merge.diff`: diferenças locais além da PR40 nos seis merges delimitados.
- Os dois hashes finais do fence são `964a53310c340f4496d7410d66f8b852270b75f1` e `b6499c30a3a2482cd96c72e3b4b6bf9b2a04c72e`; foram relidos independentemente, sem novo bloqueador concreto no recorte e sem execução local.
