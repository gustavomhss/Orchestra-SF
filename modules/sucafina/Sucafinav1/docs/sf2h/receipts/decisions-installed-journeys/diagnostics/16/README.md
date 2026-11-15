# Diagnóstico16 — adendo separado, zero aceitação

**Estado:** diagnóstico concluído, 3 PASS / 2 FAIL; missão52 ACTIVE. Este adendo não altera checkpoint15, critérios15 ou financeirov8 e não declara release, handoff terminal ou conclusão de WP11.

## Resultado observado

O run [43682706028](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43682706028), job132716569985, terminou failure; cleanup132717571992 terminou success. O artefato14149655821 tem3.835.118 bytes,17 arquivos e SHA256 `3d6130ac4be6a3f7b4f56f40e21692b66aa5151738355f88429c0d1f38eb22d5`.

| Jornada | Resultado diagnóstico | Limite observado |
| --- | --- | --- |
| J1 | FAIL,73.712 ms | Três respostas de comparação HTTP200 e registro da regra HTTP200. O único POST decision-choose abortou com net::ERR_ABORTED antes de interceptar a resposta original. |
| J2 | FAIL,14.727 ms | Requests GET503 / procurement-queue-unavailable, formulário0. Mutação financeira, aprovação formal e Apply não alcançados. |
| J3 | PASS,10.569 ms | Corpo original de criação/edição/reabertura concluído somente neste diagnóstico. |
| J4 | PASS,7.051 ms | Corpo original de catálogo/alternativas concluído somente neste diagnóstico. |
| J5 | PASS,7.518 ms | Corpo original de recuperação da criação incerta concluído somente neste diagnóstico. |

**A persistência da escolha e a captura P9 são UNKNOWN_UNQUALIFIED.** O aborto não prova ausência de commit, nem sucesso. A perda deliberada da resposta de escolha, retry, histórico persistido e mudança posterior da fonte não foram alcançados. J1 permanece FAIL. Os três PASS diagnósticos também acrescentam **zero fragmentos de aceitação**.

## Identidade da composição e instrumentação

- Base histórica C45/terminal71: `384f9eb172f0e6761a2af1e92d8b4bb11d9b01df`.
- Parent W15: `c725f9b8307a84562258c478414ec0b39d428b99`, tree `44d2d591fac429609ff1a1e02c892185cfed4944`.
- W16: `c7591b8a99f95e7b5f356663e984bd4fdfc3d8fd`, tree `1e807f754efc40adbb89cf43090128058a58aac5`.
- S real executado: `bba4a4f0487df3194ed2acb8e353c719325311fc`, tree `a9ef18dcddfdd3e8a993f3a77b0eb1dcde436eb0`.
- Request: `3619f1fd8b14262b0c89ee9830269f2b05356aaf`,229 bytes; os mesmos cinco casos,180.000 ms por teste,deadline UI10.000 ms,worker1,retries0.

São **cinco arquivos de instrumentação**: novo `runtime/sf52-profile.ts`, wrapper CLI `decision-case-http.ts`, `runtime/local-store.ts`, `product/host-binding/state-provider.ts` e `product/contracts/canonical.ts`. O manifesto entrega as quatro preimagens,cinco postimagens,Git blobs,SHA256 e o patch completo. A diferença textual reconstruída dessas imagens é idêntica ao patch original. Nenhuma alteração desses arquivos foi aplicada à branch compartilhada por este adendo.

A revisão independente `independent-static-review.json` encontrou nenhum bloqueio material estático e preserva seus limites. Todas as cinco diferenças diagnósticas, incluindo o novo helper, devem estar ausentes da próxima qualificação nominal. Nenhuma fonte, autorização, digest, clone, SQL, assertion, identidade ou ação UI é substituída por esta instrumentação.

## Custos medidos e interpretação

| Comparação | Intervalo do produtor (ms) | Chamadas canonical.digest | Tempo inclusivo digest (ms) | Chamadas currentSnapshots | Tempo inclusivo snapshots (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 5717.404 | 111,956 | 1956.582 | 4,030 | 2018.476 |
| 2 | 5663.461 | 111,956 | 1931.233 | 4,030 | 1983.121 |
| 3 | 8711.001 | 167,110 | 3002.856 | 6,004 | 3065.590 |

Esses intervalos começam dentro do callback de comparação, após admissão externa. **Não são latências HTTP.** Etapas pai/filho se sobrepõem; os totais não podem ser somados como CPU exclusiva. `runtime.auth.sql` cobre o callback síncrono completo, incluindo cópias e verificações, e não somente o motorSQL. O custo da própria instrumentação não foi isolado. As três respostasHTTP200 são comprovadas pelas observações de rede, independentemente dos marcadores de tempo. Não há marcador que qualifique o commit da escolha.

## Erratum do sentinel

O primeiro S `87620bef3d4d661702436bb7f6584076af0805d0` recebeu acidentalmente `[skip ci]` na mensagem e originou **zero workflows**. O root criou o filho fast-forward `bba4a4f0487df3194ed2acb8e353c719325311fc` sem essa diretiva, conservando exatamente a tree `a9ef18dcddfdd3e8a993f3a77b0eb1dcde436eb0` e o mesmo código,request/configuração/oráculos. O run acima pertence ao S corrigido. Nenhum teste foi executado com skip e nenhuma tentativa de teste foi apagada. `dispatch/sentinel-erratum.json` preserva os hashes e os envelopes original/corrigido/final; o preflight original continua explicitamente histórico.

## Composição observada posteriormente

O alvo posterior `eeff9b78219b5efe1ad78e68d4490af0d7c5ed07`,tree `072950bafdc50b9eddc549f7a327742bc5086bf6`, é filho documental de C53 `180212940105e7b9ad15171b067c1c1b7841df5f`: quatro recibos105 adicionados e zero delta de produto. A leitura integral da autoridade terminal105 permanece uma reconciliação do root no corte deste adendo. Essa observação não modifica o contexto C45/71 de15/16 e não transfere qualquer prova ao alvo posterior. A série52 e a fila101 continuam exigindo reconciliação/deduplicação conforme seus mandatos existentes.

`diagnostic-16.json` é copiado integralmente e conserva seu SHA256 `81b403026b54f7f124648643a5d2fc7724efe47e32dec3c7c01da6ef58cd4521`. `cost16-summary.json` conserva `1d0cf9dd5343d0ed20e8069702b717c2dd88da2d2f111b46ebbdddfee3b3cb63`. Nenhum teste,build,compiler,produto,dispatch ou escrita remota foi executado na montagem deste adendo.
