# Avaliação do conflito conhecido de seleção — W16

**Não foi acrescentado um teste artificial.** O produtor admitido não converte o CAS de versão mais comum no `409` específico que abre a revisão explícita da interface. A fixture real atual não expõe uma observação que ordene a outra janela interna capaz de produzir esse retorno.

Candidato: `f4ed6dfd82502bcebc091b9be6ce74d4eccf89b7`, tree `71fc6e6bb70f44b50cfb66e33a86ccd149ab32ad`. Esta avaliação é somente leitura e não é um gate global ou nativo.

## Cadeia causal

| Fonte publicada | Comportamento lido |
| --- | --- |
| `product/host-binding/state-provider.ts`, blob `2fd55c7304add0829d7434917c80664fe86356b9`, linhas 72–87 | O recibo idempotente anterior é resolvido antes do CAS. `expectedStorageVersion` desatualizado retorna `conflict/product-state-changed`. |
| Mesmo arquivo, linhas 88–96 | `preview` exige que o callback real execute e retorne `commit:false`, com autoridade e alvo ainda válidos. |
| `product/collaboration/case-selection.ts`, blob `ec80e2916c8a06cbb471cf02e30bb1cb5ebd9cc0`, linhas 151–180 | O caso e as fontes são lidos antes da transação. Apenas `preview` vira `conflict/selection-not-committed` e HTTP409. Os outros resultados não-ok, inclusive o CAS desatualizado, viram HTTP503 `selection-unavailable`. |
| `product/ui/case-work-selection.ts`, blob `3f76f17d51d09b86fa63a5c98c70cd4e77c91713`, linhas 48–54, 117–129 e 166–171 | Só a primeira resposta409 com essa razão exata libera o botão de revisão. A revisão relê caso e versão, não grava. Uma tentativa já incerta mantém a chave/corpo original. |

## O que as seams reais permitem

Segurar o POST do navegador, concluir uma segunda seleção pelo HTTP canônico e só então encaminhar o POST original causa um CAS recusado no namespace `preferences`. Pela implementação publicada, o resultado seria503; esse cenário não prova o ramo409 solicitado. Não foi executado.

Segurar o POST e concluir uma mudança real de caso antes de encaminhá-lo também não produz o409 desejado: o produtor passa a ler o caso novo como atual. O quarto teste existente já cobre a confirmação real dessa gravação seguida do aviso de mudança do caso, sem reenvio automático.

O409 pode acontecer se o caso ou a fence mudar depois da última leitura interna e antes do callback C08. Para ordenar essa janela, seria necessário introduzir uma interceptação em `state`, `cases` ou `fence`, ou apostar numa corrida de tempo. A fixture atual não oferece essa observação. Não foi introduzido novo seam de produtor nem um teste dependente de timing.

## Finding para o owner

**`WP01-SELECTION-KNOWN-CAS-REJECTION`** — avaliar no produtor `product/collaboration/case-selection.ts` a tradução específica de `conflict/product-state-changed` do C08 para a rejeição conhecida `conflict/selection-not-committed`, além do `preview` já traduzido. Não agrupar nessa tradução erros arbitrários de indisponibilidade, autoridade, alvo ou idempotência.

O produtor resolve o recibo durável antes de comparar a versão; essa razão específica representa recusa anterior ao efeito. A UI ainda preserva o tratamento separado de uma tentativa previamente incerta. Nenhum arquivo estrangeiro foi alterado nesta avaliação.

Com um blob desse contrato publicado pelo owner, a contraprova pode usar apenas ordenação de transporte: segunda seleção real com chave própria, primeiro request encaminhado intacto,409 real e ausência de efeito/recibo da intenção recusada, revisão explícita com leituras autorizadas, depois nova chave/versão e uma única seleção da nova intenção. A seleção concorrente seria contada separadamente.

## Preservação e limite

Os cinco casos existentes, suas assertions e seus prazos permanecem byte a byte. Nenhuma alteração em produto, fixture ou teste; nenhuma execução de produto/check/CI. O ramo de revisão409 permanece implementado e revisado por fonte, sem contraprova runtime específica. O finding é uma dependência de mapeamento do produtor e uma lacuna de prova delimitada; não remove a evidência anterior dos cinco casos nem concede aceite completo de WP01.T04.CMP.02, host, nativo ou gates globais.

## Patch OWNER-ONLY preparado

`wp01-case-selection-known-cas-owner-only.patch` altera uma única condição e tem preimage publicado `ec80e2916c8a06cbb471cf02e30bb1cb5ebd9cc0`, confirmado novamente por GitHub MCP no pin `2784daafbb0d3b58b6019822288a07fa38e5c5b0`. O manifesto vizinho registra postimage, hashes, análise de idempotência e o roteiro da futura contraprova. O patch não foi aplicado ao repositório nem executado.

A inferência de não-commit é limitada a essa razão C08: ela é retornada antes da invocação do callback e depois da resolução de recibos prévios. Conflito de conteúdo idempotente tem outra razão e permanece fora da tradução. O armazenamento SQLite só grava/commita quando `result.commit` é verdadeiro e faz rollback da transação ainda aberta. A UI previamente incerta continua sem autorização para gerar uma nova intenção.
