# WP01 C03: primeiro selector publicado e consumo W9

## Estado

**Implementação própria concluída para revisão; testes W9 pendentes de GitHub Actions. Nenhum aceite integrado, nativo ou global é declarado.** Este adendo preserva `wp01-c03-answer-selector.md` como registro histórico W7 e atualiza o finding **WP01-C03-01**: a primeira emissão já foi publicada pelo produtor e agora tem consumidor de interface. A montagem completa do HTTP/host continua sendo responsabilidade da integração.

Critérios relacionados: `WP01.T03.CHK.01`, `WP01.T03.CHK.02`, `WP01.T03.DOD.01`, `WP01.T03.INV.01`, `WP01.T03.CMP.01`, `WP01.T03.SUC.01` e `WP01.T05.CMP.01`. As novas contraprovas contribuem para esses critérios, sem declarar sua totalidade coberta.

## Fontes imutáveis reconciliadas

PR33 foi consultada via GitHub MCP e apresentou o head `ea5a6f965c803d436202934872c3650ab8f8eb19`, tree `8535b4ffdbbeee8549bc8820fec2551fa6cf9d09`. Nesse pin:

| Fonte | Blob | Uso nesta fatia |
| --- | --- | --- |
| `product/collaboration/http-routes.ts` | `8e43041300f452a83d6b8f1895e73188a81138a3` | Contrato publicado da nova leitura; consultado, sem substituir o host local. |
| `product/collaboration/http.ts` | `91091bf444bc23221d1f427138ebb9e5ca4c51bb` | Envelope/autorização consultados; montagem completa não alegada. |
| `product/collaboration/answer-reuse.ts` | `134ce5cd8c4f0779380936de6a439c9ea124d932` | Único input estrangeiro novo requerido pelo fixture; hidratado verbatim pelo root. |
| `product/collaboration/host.ts` | `5d69b45569067afc682b4ec48c026e4e4dd4ceab` | Callbacks de resposta/escopo consultados; integração completa permanece externa. |
| `test/product/wp08/answer-first-confirm-http.test.ts` | `87ac92b71e5b715a595368460f01fed97694f80e` | Contraprova publicada do produtor, consultada; não tratada como execução nossa. |

Os paths da tabela começam em `modules/sucafina/Sucafinav1/`. O port `answer-reuse` é byte a byte igual ao publicado em compose `4306b310e4d6dac77f9beab461adad4e8e924849`.

Para a classificação do conflito de inclusão, foram lidos no pin compose `a1e9eb62aa7fa862322622cc38474ef0ff5a7d09`:

| Fonte | Blob |
| --- | --- |
| `product/decisions/http.ts` | `b1fca9569190eb42880387bd12c49dd769304522` |
| `product/decisions/mutations.ts` | `922358d17c470c16b43076510bdf04744e2306e4` |
| `apps/cli/src/sucafina-product/business-services.ts` | `4b96a408bd43e73a6e614977f959b6f58f9559e0` |

## Consumidor implementado

Para uma pergunta aberta sem `answerRef`, a UI seleciona a última mensagem do destinatário da thread autorizada. Exige ID, incarnation e versão positiva da mensagem. Envia os quatro campos fechados `{questionId,messageId,incarnation,version}` a `collaboration-answer-prepare-message`. O navegador não constrói referências de evidência.

O produtor emite a referência, confere a identidade exata selecionada e prepara a confirmação no mesmo contexto admitido por `collaboration.answer.prepare`. A UI conserva o `answerRef`, `observationRef`, `observedSourceVersion` e `expectedScopeFingerprint` retornados. O namespace do CAS permanece `threads`. Uma referência já fornecida pela projeção continua usando `collaboration-answer-prepare`; esse caminho não foi removido.

`stale / answer-selection-changed` durante a preparação não pode produzir confirmação. A UI desabilita o candidato antigo e pede reabertura da conversa. A mensagem sem selector e sem identidade completa continua fechada, mantendo o reply utilizável. O teste negativo anterior conserva suas assertions de controles, texto e ausência de mutação; seu nome/mensagem agora descrevem essa condição precisa.

As tentativas de reply e de confirmação já incertas continuam usando seu corpo e chave originais. A limpeza por revogação inclui os novos dados de resumo do caso e revisão de acesso. Nenhuma resposta tardia pode reconstruir a conversa revogada.

## Conflito próprio na inclusão da resposta

O primeiro `decision-answer-question` com resposta `409`, status `stale` e razão `case-changed` é distinguido de resultado incerto. Essa classificação é uma inferência estática estreita: o produtor verifica replay antes de `loadCase`; essa combinação é emitida pela conferência da versão antes do save. `withCase` permite retry histórico e devolve o resultado da ação, sem produzir esse stale depois dela. O fallback `conflict / case-changed` não foi incluído na exceção.

A UI conserva a confirmação pronta e oferece **Review current decision**. O GET atual usa credenciais, `no-store` e deadline, verifica acesso/revisão/principal e localiza a mesma pergunta no mesmo ID/incarnation do caso. Exibe objetivo, período, moeda, pergunta e versão atuais. `answer-read` precisa devolver exatamente a referência, o conteúdo, o autor e a versão observada já confirmados.

Somente **Attach confirmed answer to this version** autoriza nova tentativa de inclusão. Antes do POST, a UI relê o caso e a resposta confirmada; se a comparação mudou, exige nova revisão. Somente a inclusão recebe nova versão e chave. A preparação e a confirmação não são repetidas. Se uma tentativa anterior de inclusão já ficou incerta, um posterior409 não habilita essa revisão: seu corpo e chave permanecem exatos.

## Composição da contraprova real

`thread-domain-fixture.ts` preserva o operador criptografado, a autoridade de instalação/fonte, C03 e C08 reais. Acrescenta `createThreadAnswerEvidence`, o `createDashboardConfirmationObserver` real e o port publicado `createAnswerReusePort`. Os callbacks verificam a mensagem por leituras reais, reemitem a evidência no thread solicitado, comparam os digests e conferem a autorização atual. O escopo é o subconjunto de fonte Dashboard atual e única; o manifesto, o observer e o fence C06 permanecem reais.

Os envelopes HTTP são finos e declarados, correspondentes ao contrato publicado. **Não são a montagem completa de `createCollaborationHttp` ou do host WP10.** A projeção do caso continua sendo entrada de apresentação. A rota de inclusão devolve explicitamente `unavailable / decision-attachment-not-mounted-in-c03-component`; não devolve sucesso fictício e não reivindica escrita na decisão.

A nova prova real começa sem selector no DOM, cria uma resposta pelo C03, rejeita uma seleção com versão incorreta sem vazar conteúdo/ref, obtém a primeira referência do emissor, confirma por C06/C08 e corrompe apenas a entrega depois do commit real. O retry exige corpo/chave idênticos e a mesma versão C08, sem segundo efeito. Uma falha de inclusão não pode repetir a confirmação.

O arquivo fica com 18 observações: seis com produtores reais C03/C08, incluindo a nova confirmação C06; doze de contrato/transporte. As três novas observações de transporte cobrem mensagem editada, revisão após primeira inclusão rejeitada e preservação de uma inclusão incerta. Todos os resultados W9 permanecem pendentes.

## Reconciliação dos failures W8

O run `43585122170`, job `132417843606`, executou o produto `770ca62aa97f66deb70126a32d9819ddf7f32833`, tree `de52a224e9468ce70ed442d5b6ccefe03cd6cfc1`. O log mostra cinco failures dos casos reais na navegação de enrollment, antes da jornada, e um failure no count imediato dos botões. Não há crédito de confirmação real nesse run.

A fonte `operator-identity.ts` redireciona a sessão criada para `/sucafina/dashboard`. O fixture anterior não atendia esse destino e retornava404 vazio. A correção atende esse destino com redirecionamento ao GET autorizado da conversa, sem modificar identidade, cookies ou autorização. O helper de browser agora exige200 e URL final canônica. O count de dois botões aguarda o segundo botão visível; as assertions de cardinalidade, bloqueio da mensagem antiga e ausência de mutação permanecem.

## Pendências exatas

- Executar a seleção cirúrgica no GitHub Actions após publicação W9; nenhum teste/typecheck/guard local foi executado.
- A integração deve consumir a rota e o host publicados e comprovar pergunta real aberta, resposta de destinatário distinto, primeira emissão, C06 e inclusão no caso pelo HTTP completo, com perda de resposta/revogação. Esta fatia não substitui essa prova.
- A correlação de reply ainda pode ser ambígua quando o port do destinatário retorna uma leitura atual contendo duas novas mensagens idênticas do mesmo autor. O consumidor conserva a tentativa; um recibo do produtor ligado à identidade da mensagem continua sendo necessário para resolver esse caso sem suposição.
- Read-only scope, Atlas, execução residente nativa e gates globais permanecem nas provas próprias e com seus owners. Nenhum critério foi promovido a DONE integral por este adendo.
