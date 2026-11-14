# WP07 — revisão estática da retomada

## Escopo e independência

Revisão feita por um agente sem autoria nos arquivos de produto examinados, com uma segunda leitura independente da navegação. Foram examinados o delta do candidato `46781943bf93bad698233b995354d15c90c4821c` em `contribution.ts`, `thread-access.ts`, `port.ts`, `workspace.ts` e suas regressões; depois, as correções de UI e o receipt compacto de preservação. O revisor escreveu somente este documento. Nenhum teste, build ou typecheck foi executado localmente.

Esta revisão não substitui os reviewers independentes da campanha, a montagem no host, provas nativas, os checks hospedados ou o aceite dos 86 critérios. **Não declara READY_FOR_REVIEW, DONE ou aceite global.**

## Achados de UI e correções observadas

| Achado no candidato inicial | Correção examinada | Evidência e limite |
| --- | --- | --- |
| P2: `unavailable()` removia o único botão de atualização; falha transitória, stale ou recusa do destino deixavam a pessoa sem ação própria de recuperação. O botão `Host refresh` existia somente no harness. | A view conserva apenas a mensagem não sensível e `Retry access`, que faz nova leitura, respeita geração/dispose e mantém o pin de digest do request inicial. | O teste Chromium exercita recuperação pela ação do componente, inclusive digest inicialmente fixado. |
| P2: o envelope C11 autorizado chegava à UI sem apresentação de perfil, skill/versões, execução, fontes ou digests. | A view apresenta detalhes recolhíveis de proveniência a partir do envelope recebido. O browser client recusa proveniência ausente; a UI não infere grants nem cria recibos nativos. | O teste verifica apresentação, limpeza após revogação e recusa de resposta sem proveniência. Os dados continuam explicitamente identificados como fixtures. |

Os achados derivam de `CAMP.QLT.03` e `CAMP.QLT.90`, que exigem próximo passo útil e proveniência explícita. A matriz própria liga o consumidor C11 a `WP07.DOD.10`, `WP07.CMP.10` e `WP07.SUC.10`; corrigir essas duas lacunas próprias não satisfaz suas dependências nativas restantes.

A resolução foi observada no teste individual **`Chromium reauthorizes contribution navigation and discards revoked or superseded results`**, **PASS em 3.549,49 ms**, no [run 43536210514](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43536210514), [job 132265720831](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43536210514/job/132265720831):

- Produto W: `dd30b8238143306958ef070cfb9a670544a2ac89`.
- Snapshot CI S: `1fcc5a04be1f26edaeeea0d2a5efc20501cc1d05`.
- SHA-256 do log completo lido: `02b3b3cc80ab9c2db4e19136b0620015f95ac0b827d58d55b8986c3b6259dcbf`.
- **O run completo terminou FAIL: 1 PASS / 1 FAIL.** A segunda preservação anual levou 5.172 ms e excedeu o limite de ação de 5.000 ms. O PASS individual do consumidor não transforma o run em aprovado.
- O check separado desse produto também terminou FAIL: 137 diagnósticos externos e um diagnóstico próprio na instrumentação opcional de `currentSnapshots`. O diagnóstico próprio foi corrigido no candidato posterior; sua aprovação depende de novo check.

## Receipt compacto: revisão do candidato congelado

Produto examinado: **`dcde725380e76ff3180b1415e3c0838b9ca7df34`**, tree **`c9c97786a5fa8692d861d87663f66e7803440514`**. A raiz confirmou o freeze e a publicação antes de registrar este parecer.

| Arquivo | Git blob SHA | SHA-256 |
| --- | --- | --- |
| `product/reviews/port.ts` | `1b93fd89a1f544808455c15d12f9c06cc18e21f3` | `d7e90864107251cc988511b5afe66c2362baf2aa317c6b0b09cd990832493377` |
| `test/product/wp07/review-port.test.ts` | `77ef3a9e1a289953999abc976557257849bb9237` | `a33f93ee8f841863ef328d3d8462562e2538057b5166e113f40bb31d29cdbcfe` |

O [C08 existente](https://github.com/gustavomhss/Orchestra-SF/blob/dcde725380e76ff3180b1415e3c0838b9ca7df34/modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts) grava em `transactions[key].value` uma cópia do valor retornado pela transação. Antes, o WP07 retornava o corpo inteiro da revisão, que já existia em `reviews`. O patch próprio passa a retornar `{ schema: "sf-review-receipt-v1", reviewRef, reviewDigest }`, sem alterar C08 ou o contrato compartilhado de `value: unknown`.

Invariantes conferidos no código:

- O corpo completo permanece em `reviews`; nenhuma seleção, valor, comentário ou referência é removido.
- `commandDigest`, chave de idempotência, alvo e incarnation permanecem iguais. O probe continua antes da consulta às projeções mutáveis.
- Ambos os valores recebidos de C08 são tratados como `unknown`. O decoder valida schema, referência e digest; referência diferente, versão de schema desconhecida, campos ausentes e hash inválido não são aceitos.
- Retry e pós-commit usam o **receipt efetivamente devolvido pelo C08**. Isso cobre a corrida na qual outra chamada da mesma intenção grava entre o probe e o commit; o candidato local perdedor não substitui o resultado já preservado.
- A revisão é reaberta pela mesma porta `read` autorizada, com todos os checks de saída, antes de comparar seu digest integral com o receipt. Não se devolve diretamente o corpo de um receipt antigo.
- Os passes completos de autorização anteriores à gravação permanecem. Não houve cache de autoridade entre operações, mudança de limite do teste ou ampliação de acesso histórico.
- O formato legado de receipt com corpo inteiro continua legível e é comparado integralmente. Não há migração nem reescrita dos receipts existentes.
- O codec SQLite preserva `undefined` e `-0` por tags, compatível com a representação distinguida pelo digest canônico.

**Parecer estático: nenhum achado impeditivo nesse patch.** A redução da duplicação vale para novas preservações. Receipts legados conservam o corpo integral; não se promete redução de snapshots históricos já existentes nem ganho de latência sem medição do novo candidato.

## Regressão de durabilidade examinada

O teste novo **`compact review receipts survive SQLite restart, legacy replay and concurrent preservation`** usa o C08 e SQLite reais, com autenticação/projeções controladas. Ele verifica o receipt compacto e o corpo original, fecha e reabre o mesmo store, recompõe a porta, repete a intenção com seletor indisponível e confirma ausência de nova seleção. Também cobre leitura legada sem migração, schemas/digests/IDs inválidos, corpo adulterado, revogação e concorrência entre probe e commit.

Na corrida, a primeira chamada aguarda fora da transação; a segunda grava 1.320. A primeira retoma com projeção de 1.400 e deve receber a revisão vencedora de 1.320, com uma única gravação da intenção. Isso testa o resultado retornado pelo C08, não uma simulação de seu protocolo.

**Ao encerrar esta revisão, a regressão nova e o ganho anual ainda aguardavam resultado hospedado no candidato congelado.** Os resultados posteriores pertencem aos receipts de CI vinculados aos seus SHAs. A revisão estática não os antecipa.

## Demais limites conferidos

Não foi identificado bypass de autoridade no compartilhamento de leitura de comentários dentro da chamada, na união das fontes de revisão/decisão, na verificação de cobertura e ordem de artefatos ou na navegação com digest/alvo/generation. Esse resultado é restrito aos trechos examinados. C11 com fixtures continua distinto de execução nativa; a integração C06/C17 exercitada não prova edição histórica de mensagem nem continuidade page-to-record.
