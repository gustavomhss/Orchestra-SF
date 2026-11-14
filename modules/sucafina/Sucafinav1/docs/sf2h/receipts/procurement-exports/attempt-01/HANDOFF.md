# Procurement exports — terminal handoff

**EXPORT-01 e EXPORT-02: corrigidos e comprovados em CI.** Status agregado: **PARTIAL somente pelo typecheck Sucafina herdado de WP14**. O resultado funcional é **11 pass / 0 fail / 396 assertions**. CLI e guards passaram. Esta entrega encerra o delta de exportações; não declara aceite integral de WP04 ou da campanha.

[PR #57](https://github.com/gustavomhss/Orchestra-SF/pull/57): `sourcing-money → astra-operations`, preservada aberta, sem merge. Ator S2-A, sessão `procurement-exports-20261114`, lease epoch1. **Handoff terminal: writer desta sessão liberado**, sem run da missão em voo. Próximo consumidor: owner de Operations/composição, após nova leitura do head real.

## Candidato, autoridade e reconciliação

- Head recebido: `2a185e05967f611d63796684379761ded991092b`; tree `5f3f826dcafe7ac78817290160d2540f6a7d1723`, igual à missão e ao handoff terminal anterior.
- Produto testado **W**: `e1fe9561f199dc594a5fd559d06d450253e571bc`; tree `5cb441e60a88dce057534548796dc6e7b1e40f74`. Pai único: head recebido.
- Target real observado: `astra-operations@15df31a67efab0aae6e2bff2b7eb8e5e59511324`; é a fonte das duas falhas. A resposta de metadata da PR ainda informa base_sha histórico `ba8a09e...`; o ref real foi consultado diretamente.
- Missão: `5e5c6b6ad29b985376880b4da40cb51c7424849b:.../parallel-wave/procurement-exports.json`. COMMON: `c708ec0609dbfc95b259707d8c38481617f74f11`. AGENTS, execução COMMON, pack S2-A completo e seus dois anexos obrigatórios reconciliados no planejamento `dbf9547211d9b0fade619790de7c19c0869b7c7d`.
- Autoridade de continuação: instrução explícita do usuário + handoff terminal anterior; não se inferiu abandono por silêncio. Antes do fechamento documental, branch e PR ainda apontavam W, descrição histórica intacta e nenhum comentário novo.
- O commit documental **D** que contém este recibo tem pai W e só acrescenta arquivos nesta pasta. Seu SHA/tree e o compare W→D são registrados na descrição da PR após criação. Produto, testes, configurações, fixtures e recibos antigos permanecem idênticos a W. Nenhum green novo é atribuído a D.
- Atualização por GitHub MCP e CAS `expected_sha=W`, sem force/reset. Nenhuma outra branch de produto, PR, alteração de base, merge ou deploy.

Detalhes de input, hashes, dependências, requests, jobs, resultado e critérios: [RESULTS.json](RESULTS.json). O [INTAKE.json](INTAKE.json) registra o estado pré-CI e permanece imutável; este recibo acrescenta o resultado observado.

## Correção aplicada

Único arquivo de produção alterado nesta missão: `runtime/downloads.ts`, **8 adições / 4 remoções**. Preimage `fa365f9d350be341348ab69d789e40779c8b9756` conferido contra o patch Operations `d47538f593c2b563e34c75434044def6e070de58`. Postimage `7fa9c254c7c08b894d8b4c3336653c32b6270126`.

`purchaseOrderMoney` usa uma visão temporária `po_draft` apenas para ler a PO futura nas etapas `sourcing/src_pending/src_rejected`. O status real e o registro persistido não mudam. A PO futura obtém sua estimativa pelo helper existente, enquanto sourcing conserva sua própria aprovação108USD/1.08.

Cada linha HTML também chama `purchaseOrderMoney` com a visão de uma única linha. O total continua usando a PO inteira. Não há nova fórmula ou alteração do produtor `procurementMonetaryFacts` (blob `c9a224b12c13b7cec506be90527300caa7e984fd`), política, alçada ou scoring.

Runtime Procurement, UI, fixtures compartilhadas, configs e engines ficaram readonly. PO efetivamente submetida e cancelada continuam usando as semânticas existentes.

## Falhas publicadas e downloads reais

Fonte preservada: Operations@15df31a..., `operations-consumers/attempt-01/HANDOFF.md`, patch e regressões. O [run original43628901747](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43628901747) efetivamente tinha **10 pass / 2 fail**, com as duas falhas lidas no log; não foi repetido.

As cópias seletivas ficam somente em `test/product/procurement-exports/`. A fixture mantém comandos reais de criação, submissão, aprovação, propostas e seleção. A precondição antiga `view.record.value=108` dependia de uma correção readonly de Operations; a cópia verifica os fatos persistidos de sourcing108USD/1.08 e ausência de aprovação PO, preservando os mesmos oráculos de CSV/HTML. Originais e snapshots completos não foram importados.

O CI executou a função de produção `download(register|po)`, conferindo nome, MIME, bytes decodificados, campos, unidades e proveniência. São **18 pares / 36 arquivos gerados**. O snapshot completo foi comparado após cada download e o registro persistido antes/depois de cada par: todas as comparações passaram.

| Caso | Observado nos arquivos efetivamente gerados |
| --- | --- |
| EXPORT-01 | CSV e HTML: PO original100EUR; base200USD; FX2/current/estimate. Aprovação/FX submetidos da PO indisponíveis. Status real `src_pending` preservado; sourcing continua108USD/1.08 no registro. |
| EXPORT-02 | HTML: primeira linha40.00, segunda60.00, quantidade1 e unidade service em cada linha; total100.00EUR. CSV: total original100 e base200USD. |
| PO submetida → FX3 | Após `submit_po` real em FX2, CSV/HTML mantêm200USD/2/submitted/pending-approval mesmo com Settings FX3. |
| Cancelamento | Após submissão, preserva200USD/2/submitted com estado cancelled. Cancelamento direto do sourcing mantém200USD/2/current/cancelled e aprovação PO indisponível. |
| FX corrente ou histórico ausente | Conversão fica indisponível, nunca zero. PO submetida sem FX histórico não usa FX3 como fallback; aprovação200USD continua identificada separadamente. |
| Base USD→GBP | Conversão corrente indisponível; histórico submetido permanece200USD/2, sem relabelar200GBP. |
| Quantidade/preço/amount | 2day×20 e3hour×20 geram40 e60, mesmo com amount redundante999/888; total100. |
| Ausência versus zero | Qty/preço ausente ou NaN gera Unavailable; zero observado gera0/0.00 e total0. PO sem linhas, vazia ou malformada não empresta a proposta selecionada. |
| Sourcing e sourcing rejeitado | PO futura continua200USD/FX2/current/estimate, sem aprovação da PO. |

As premissas de linhas múltiplas ou entradas inválidas usam clones de leitura descartados, sem persistir alterações artificiais. Não representam permissão para tais mutações no domínio.

### Arquivos primários arquivados sem normalização

São cópias exatas do conteúdo UTF-8 emitido pelo CI, sem regeneração, edição ou troca de quebras de linha. Os quatro hashes e tamanhos foram recalculados por dois leitores independentes. [EXPORTS.json](EXPORTS.json) contém os payloads e todas as18 observações.

| Arquivo | Bytes | SHA256 |
| --- | ---: | --- |
| [EXPORT-01 CSV](files/EXPORT-01/procurement-register.csv) | 749 | `093e72bc5be8db0212fab2b14f9d6c26c7b0b73a6368ed8fc21ce83df1ee481e` |
| [EXPORT-01 HTML](files/EXPORT-01/PO-2026-0001.html) | 1870 | `41d0ab4d31d1ab03959a235daf7c5f92e2a11d72d24b267e336282e146966c77` |
| [EXPORT-02 CSV](files/EXPORT-02/procurement-register.csv) | 749 | `093e72bc5be8db0212fab2b14f9d6c26c7b0b73a6368ed8fc21ce83df1ee481e` |
| [EXPORT-02 HTML](files/EXPORT-02/PO-2026-0001.html) | 1996 | `d25317b2bd21968b20d19429ab3b99b0b5995b917cfb85ebf4907772ebc4a066` |

Isso prova o gerador de downloads real em CI hospedado com registros sintéticos persistidos. Não é uma jornada de browser/HTTP ou uma aceitação nativa/AM.

## CI cirúrgico de fechamento

| Prova | Snapshot S / job | Resultado |
| --- | --- | --- |
| [Funcional43632315600](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43632315600) | `b7a3fe9b03fa490238fb47acdc67924f3b0e417a`; job132561444043 | **11 pass / 0 fail / 396 assertions**, dois arquivos,637ms; job e cleanup success. |
| [Checks43632616824](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43632616824) | `cd4e8f8c63db9b66d4ab6742f3893c1dd3e8dd27`; job132562347834 | Sucafina failure somente TS2741 herdado. CLI success. Guards success: **78 regras / 852 paths / 0 gate / 11 warn / 0 errors**. |

Seleção funcional explícita: `./Sucafinav1/test/product/procurement-exports/export-regressions.test.ts` e `export-controls.test.ts`, runner Bun, package sucafina, directory `modules/sucafina`, env vazio e timeout120000. As duas regressões são testes normais, sem skip, inversion ou expected failure.

S funcional tem pai W e acrescenta somente `.ci-run.json`; S checks tem pai W e acrescenta somente `.astra-operations-check.json`, fazendo checkout explícito de W. Comparações completas confirmaram igualdade de todos os blobs de produto/teste/config/fixture. Validadores e workflows existentes permaneceram inalterados. Base real dos guards: `a1d37698a7bb097c1578f827eba6a19b9917ef07`.

Dedupe antes de cada disparo por W/tree/seleção/config/env/fixtures: nenhum equivalente encontrado. Dois runs novos, sem rerun, um por vez; checks começaram depois do funcional terminar. Sem testes locais, epic ou full suite.

Omni: único nonce `d9fb27f7b137e2a4cfe974b933ed502b`, controle correspondente **not applicable**. Não houve teste declarante/spawn; não é prova de Omni.

Logs crus decodificados, BOM/LF preservados:

- Funcional:98444 bytes; SHA256 `f40a980bcb7c2026a11bbe84a5e637880c5a83a78e89351675c8d065d5b81cac`.
- Checks:67900 bytes; SHA256 `d5621b4c14a9be7563e22ca9554a961f2b882184806ebe61ac5f73e3fef510a0`.

O workflow Bun não publica artefato genérico; a API retornou lista vazia. Os bytes de download estão preservados nos arquivos acima. O [artefato de checks14129021623](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43632616824/artifacts/14129021623), `astra-operations-check-1`, tem1579bytes, digest `sha256:3c9d547be53ac18f5c7b32234e8009cd5ac91aef5c16ce1cede7ed32acf9e12a`, expira2026-11-28T19:34:23Z. Upload/manifest/digest conferidos; compilador e guards lidos no log, sem download separado do ZIP.

## Critérios, revisão e limites

Os111 IDs/textos canônicos do S2-A continuam intactos; digest `de5df06984f523dea5807ba687a86a81e395655d1fbfac33410106f99570118f`. [RESULTS.json](RESULTS.json) inclui texto exato e limite de cada critério relacionado; o estado normativo do planejamento não é reescrito.

| Critério | Evidência complementar deste delta |
| --- | --- |
| WP04.INV.02; T03.CHK.03 | Igualdade antes/depois, PO congelada apósFX3, cancelamento e ausência de FX sem fallback. |
| WP04.INV.03; T03.INV.02; T03.DOD.02 | Ausência versus zero; moeda, estado e proveniência nos arquivos. Permissões completas não foram revalidadas. |
| WP04.CMP.02; T03.CHK.05; T03.QLT.02 | Valores próprios por linha, total preservado e qty×preço. Não cobre toda matriz monetária/arredondamento nem apresentação das duas bases e discrepância exigida pelo CHK.05 completo. |
| WP04.T03.INV.01 | Diff reutiliza produtor e preserva política/alçada/scoring. |
| WP04.T04.CHK.02; T04.DOD.01; T04.QLT.02; T03.SUC.02 | PO futura tem estimativa própria; PO submetida tem aprovação própria. Não é paridade global de telas/C02/C06/valor legado. |
| WP04.T05.CHK.03/04 | FX não reescreve snapshot e campos monetários/unidades são preservados no download. Reset, importação/exclusão/IDs e sigilo completo não foram reaceitos. |

Revisões independentes de `exports_review`, `pack_review` e `ci_contract`, sem autoria de produto e sem disparar testes, constam em [SOURCE-REVIEW.json](SOURCE-REVIEW.json). São revisões focadas; não substituem três aprovações finais do mesmo C. Nenhum aceite global WP04/E05/AM, C/G7, D/G8 ou GLOBAL_RELEASE.

## Sourcing anterior preservado

- [43625920456](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625920456):58 pass no W `aa5d8c0ee49777ea82bc707df8c976d311728292`, S `532a73aa2d7b8e7f5e57e0156b0de67f7ac1fb1c`.
- [43626658534](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43626658534):5 testes afetados revalidados no W `a3b7fb9b45d7852a3000e01098336a1aca9526c3`, S `fb440a03e4d712e0d6f40f021997b31a80943a3d`.
- São58 testes distintos e5 revalidações; não63 distintos nem novo run58 no W desta missão. O impacto novo em downloads foi coberto pela seleção11. Recibos/testes/produtor de sourcing não foram alterados.
- [Handoff anterior imutável](https://github.com/gustavomhss/Orchestra-SF/blob/2a185e05967f611d63796684379761ded991092b/modules/sucafina/Sucafinav1/docs/sf2h/receipts/review-fixes/sourcing-money/attempt-02/HANDOFF.md) e [resultado anterior](https://github.com/gustavomhss/Orchestra-SF/blob/2a185e05967f611d63796684379761ded991092b/modules/sucafina/Sucafinav1/docs/sf2h/receipts/review-fixes/sourcing-money/attempt-02/RESULT.json).

## Pendências externas e próximo responsável

**WP14/composição — package check ainda falha.** `test/product/wp14/source-access-atlas.test.ts(167,41): TS2741`, propriedade `procurementEvidenceWrites` ausente na chamada de `createSfBusinessServices`. É a única mensagem de erro TypeScript no run. Caller blob `fbe627ffde443ff7e2d3b1204bbcf67523404f41` e callee `apps/cli/src/sucafina-product/business-services.ts` blob `9aee116a091c684ba467f81316d2fb915b3f8758` são idênticos no head inicial e W. Não se executou baseline adicional.

A correção já está separadamente publicada no target Operations15df31a... (caller blob `d7d2a69837560f42438d470b83724c1a61939a73`). O integrador deve reconciliá-la ao compor o candidato autorizado e executar os checks afetados. Não foi importada, alterada ou validada como composição nesta missão.

**WP04/runtime — valor legado.** A correção do consumidor `runtime/procurement.ts` pertence ao trabalho de Operations e ficou readonly. Continua necessária sua reconciliação no candidato integrado para declarar paridade de todos os consumidores; as exportações agora usam o helper corretamente.

As11 advertências dos guards pertencem a manifests herdados (10 dep-new-added) e `wp01/personal-views.test.ts:82` (test-timeout-raised), todos fora do delta. Próxima ação: Operations consumir este W/recibo, preservar suas próprias correções e qualificar a composição sob sua autoridade. Repetir os mesmos dois runs sem mudança material não acrescentaria evidência.
