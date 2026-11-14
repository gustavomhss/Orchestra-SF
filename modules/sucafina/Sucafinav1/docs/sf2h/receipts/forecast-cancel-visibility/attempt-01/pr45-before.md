## Problema e resultado

A revisão preservada deve continuar em 1300 após a fonte canônica mudar para 2400, com reautorização atual e nova observação apenas após ação explícita.

**Status: PARTIAL_OWNER_INTEGRATION_REQUIRED.** O positivo original e a jornada browser completa passaram no input publicado de WP10. O candidato `ui-review` ainda usa o mount fresh-only da base fixa. A composição de contexto My work também permanece externa. Esta PR fica em draft para preservar esses limites de aceite.

## Delta desta PR

- Seis arquivos próprios em `test/product/ui-split/ui-review/`: reader real, pin/escopo exato, reabertura, nova observação e revogação no browser.
- Recibos completos, W/S, trees, requests/SHA256, logs, nonces Omni e reconciliação dos heads.
- Três propostas **NOT_APPLIED** para os owners: mount mínimo, intake do reader/integrity e módulo de contexto publicado por Collaboration.

Nenhum fonte de produção ou fixture compartilhada foi alterado. O renderer já está montado e valida metadados; os defeitos reproduzidos estão nos inputs/mount externos. `meeting-number.test.ts` conserva todas as assertions e o blob `53834c8c0802bf90a2336527460e2ecbf9aa8c97`.

## Evidência cirúrgica

| Run | Produto / resultado | Alcance |
| --- | --- | --- |
| [43619653668](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43619653668) | WP10 `a1434e7e`: **1 pass, 0 fail, 38 assertions** | Positivo original WholeReview 1300→2400, mesma incarnation, HTTP 200 e corpo original. |
| [43620401922](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620401922) | ui-review `a08d2c6a`: **3 pass, 4 fail, 74 assertions** | Reproduz contexto denied e histórico ausente após mudança; revogação do reader passa. Dois problemas próprios de organização/inspeção dos testes foram corrigidos. |
| [43621128874](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43621128874) | ui-review `4183ebdb`: **6 pass, 0 fail, 53 assertions** | Casos corrigidos de pin/escopo e revogação browser. |
| [43621543227](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43621543227) | WP10 + testes próprios `ba85e0c6`: **4 pass, 2 fail, 2 erros, 81 assertions** | Reload mantendo 1300, preservação explícita de outra revisão 2400 e revogação browser passam. Dois arquivos não carregam porque falta `product/reviews/thread-context.ts`. O job agregado é FAIL. |

Cada snapshot S é filho do produto W e acrescenta somente `.ci-run.json`. Os seis blobs de teste são idênticos entre ui-review e o produto de prova WP10. Os fontes de UI/host não são todos iguais; o resultado externo não é promovido a PASS do candidato ui-review. Os testes mantêm os deadlines e as verificações de negócio. Não houve teste local de produto nem suite epic.

## Dependências para fechamento

1. **WP10/compose-resume:** integrar o reader histórico e mover a criação de Dashboard services para depois do BusinessContext, com `evidence: context`. O patch preserva o restante do mount.
2. **Collaboration/composição:** reconciliar `reviews/thread-context.ts` publicado em `collab-resume@0d982092` e seu fechamento de dependências. O módulo falta em WP10 e compose. A proposta dirigida a WP10 é a adição exata, blob `20d98a97`.
3. **My work:** montar os providers reais de contexto e provar emissão/revogação no consumidor instalado. Renderizar um pin real diretamente não fecha essa emissão.
4. Executar typecheck/guards e qualificar o candidato composto. A seleção de contexto proposta está nos recibos e **não foi despachada**.

Revalidação de publicação: compose avançou para `ad7fcdef` sem alterar os preimages críticos; collab avançou para `0d982092`. Nenhum trabalho dos owners foi sobrescrito.

## Gates e handoff

`bun typecheck` e `bun run check:guards --base origin/dev`: **NOT_RUN**, Bun ausente (exit 127). Os workflows de checks existentes usam refs externas ao lease. `node --check` passou nos seis arquivos, com crédito apenas de sintaxe. Os três patches passaram no `git apply --check` textual, sem aplicação.

Findings: `IR-EXT-C05-WHOLE-REVIEW`, `C05_PRESERVED_MEETING_HISTORY`, `IR-EXT-WORK-REVIEW-CONTEXT`. Os criterion_ids e limites estão no [handoff completo](https://github.com/gustavomhss/Orchestra-SF/blob/32bae2bcc8008b2e81948e434dc1e3326dc4f947/modules/sucafina/Sucafinav1/docs/sf2h/receipts/ui-split/ui-review/README.md). Os 153 critérios WP01/WP02 permanecem íntegros; sem declaração de GLOBAL_RELEASE.

Head publicado: `32bae2bcc8008b2e81948e434dc1e3326dc4f947`  
Tree: `de0b250f0d0a0b19cd9bfa579d44b11444d1d34a`  
Produto exercitado próprio: `4183ebdb53b17b8e4efe9c8835ff2b0012e98624`. O commit final acrescenta somente recibos, conforme compare W→head.

