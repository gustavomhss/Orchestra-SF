# W11 — contexto de reunião em My work, somente apresentação

## Entrega e limite

Esta fatia acrescenta ao consumidor real `workbench-work` a apresentação readonly dos contextos de reunião que o produtor de My work já autorizou. Não fornece autorização de leitura, emissão de pin, abertura de reunião, criação de conversa ou confirmação C06. Não modifica o destino existente de `Open work`.

Base do trabalho: `astra-interface`, commit `0c3d98dd1263a305ce294c78ad5939cdda110a78`, tree `5c236ef687871149e9150630a16c4ce0ac70c2a7`. A implementação deste incremento está local para publicação pelo root. Os testes novos estão declarados e não foram executados por este agente.

## Código próprio

- `modules/sucafina/Sucafinav1/product/ui/work-review-context.ts`: renderer independente com entrada `unknown`, validação dos dois formatos publicados e saída HTML escapada.
- `modules/sucafina/Sucafinav1/product/interface/http.ts`: o ramo real de My work chama o renderer em cada item devolvido por `runtime.work.listPresentation`, depois dos gates existentes de admissão/revalidação.
- `modules/sucafina/Sucafinav1/test/product/wp01/work-review-context-render.test.ts`: oito contraprovas de componente, sem host ou produtor simulado.
- `docs/guides/sucafina-workbench.md`: descreve os metadados informativos e a indisponibilidade, sem prometer abertura de reunião.

Os itens antigos continuam com o mesmo HTML quando não há campos de contexto. Uma lista de contextos vazia também não acrescenta conteúdo. Um campo presente e inválido produz apenas `Review context is unavailable.`; o conteúdo parcialmente válido e os detalhes privados da falha não são renderizados.

O renderer preserva as referências e versões exatas emitidas pelo produtor. Não inventa título, autor, destino ou estado operacional da reunião. Para ação encaminhada, mostra a referência do encerramento/encaminhamento; para discussão, mostra a seção. O digest é validado estruturalmente e descartado da projeção de texto: não aparece em texto, atributo, JSON embutido ou script.

## Formatos publicados consumidos

| Campo opcional do item | Forma fechada de cada contexto | Apresentação |
|---|---|---|
| `reviewContexts` | `{ closureRef, reviewRef, reviewVersion, reviewDigest }[]` | Referência e versão da reunião; referência do encaminhamento. |
| `reviewContext` | `{ reviewRef, reviewVersion, reviewDigest, sectionId }` | Referência e versão da reunião; seção preservada. |

Referências precisam ser strings não vazias, versão precisa ser inteiro seguro positivo e digest precisa ter 64 caracteres hexadecimais minúsculos. Chaves extras, símbolos, formas trocadas, duplicação de `closureRef` e valores inválidos fecham a apresentação do contexto. A lista mantém a ordem recebida. Getters que falham são tratados apenas nessa fronteira opcional de apresentação, sem vazar detalhes do produtor.

Esses gates validam a forma; não provam ACL, continuidade física ou validade de um digest. A autoridade continua no produtor que alimenta `listPresentation` e nos gates HTTP existentes.

## Pins inspecionados por GitHub MCP

Produtor Collaboration: PR33, `2784daafbb0d3b58b6019822288a07fa38e5c5b0`. Integração comparada: PR32, `35b9fd4f532abeb1058f00281d4ad8885ca9966f`.

Os caminhos `product/...` abaixo têm prefixo `modules/sucafina/Sucafinav1/`.

| Caminho | Pin | Blob |
|---|---|---|
| `product/collaboration/work-port.ts` | PR33 2784 | `a01b11e23e650ffb218fd0a64640110fbc2f8710` |
| `product/collaboration/work-review-context.ts` | PR33 2784 | `323ad234b37a4005a10a7bf5bfd185cb23831fab` |
| `product/reviews/closure-action.ts` | PR33 2784 | `caf603047af112cf4e11130601fb5e171403d8ab` |
| `product/reviews/thread-context.ts` | PR33 2784 | `993d8fed23f398c4317dc6ed63bed05a5b79fd08` |
| `product/reviews/http.ts` | PR33 2784 | `ce0e5655f19d7d60246024af013c811bf921b042` |
| `product/reviews/services.ts` | PR33 2784 | `f37a2c540b009a8c5bed90365c267b95303e646b` |
| `product/reviews/application.ts` | PR33 2784 | `de76611be141d599b9eecc96e1173559e06be26d` |
| `product/collaboration/host.ts` | PR33 2784 | `0376f81eb7978807106d259d6f65a9b4e1ed3a2a` |
| `product/collaboration/work-port.ts` | PR32 35b9 | `22a2a7fab04757667fcfed82147b7676d6928fee` |
| `product/reviews/application.ts` | PR32 35b9 | `9a508eea9d01cdebc28ee2fed72a279782c0ba79` |
| `apps/cli/src/sucafina-product/business-services.ts` | PR32 35b9 | `4b02413b5a98e750187fa8f5fa54f3cb2415f4e3` |
| `apps/cli/src/sucafina-product/host-context.ts` | PR32 35b9 | `0d3abcf642deb3d2f6c6346cdddc8bfb40141532` |

Nenhum desses arquivos estrangeiros foi copiado, adaptado ou editado nesta fatia. O renderer não precisa alterar o contrato antigo para tolerar os campos opcionais: recebe a entrada como `unknown` e conserva o caminho sem metadados.

## Montagem estrangeira que permanece pendente

A composição PR32 35b9 não oferece ainda esses campos em seu `WorkPresentationItem` e não conecta `reviewContexts` / `authorizeReviewThreadContext` ao host de colaboração. O owner precisa consumir os produtores publicados e ligar:

1. `reviews.closures.listByAction` a `collaboration.reviewContexts` para contexto autorizado de ação.
2. `reviews.threadContext.authorize` a `authorizeReviewThreadContext`, incluindo os gates de thread e recipient publicados, para discussão vinculada a seção preservada.
3. `reviews.threadContext` ao HTTP de review para disponibilizar `POST ?sf=review-thread-context` quando essa capacidade realmente estiver montada.

Não substituir `host-context` ou `business-services` pela baseline de outra sessão. A closure deve ser publicada pelo owner e consumida por blobs exatos. Esta mudança UI está pronta para receber os metadados quando forem entregues pelo produtor real; o renderer vazio na baseline antiga não constitui prova dessa integração.

### Pauta, WholeReview e confirmação

O endpoint de contexto de thread exige `{reviewRef, sectionId, basis}` e usa `sf_review_prepare`. O servidor emite o pin fechado de quatro campos após ler a reunião e autorizar a base. Um preview de pauta ainda não preservado não possui esse pin. W11 não chama essa rota, não deriva `reviewDigest` e não cria `draft.reviewContext`.

O finding `analysis/c05-current-closure.md` documenta separadamente o leitor histórico de WholeReview já publicado e a montagem Dashboard ainda pendente. O positivo HTTP do W8c exigiu200 e recebeu403 após1300→2400; este renderer não altera nem resolve esse cenário.

Além disso, PR33 `collaboration/host.ts:206` devolve `review-answer-confirmation-scope-unavailable` quando a mensagem possui `reviewContext`. Contexto de reunião não significa disponibilidade de confirmação C06 da resposta. W11 não acrescenta CTA para essa capacidade.

## Contraprovas próprias e seleção cirúrgica

Arquivo único proposto para Actions:

`./Sucafinav1/test/product/wp01/work-review-context-render.test.ts`

Oito casos declarados:

1. Ausência dos campos na baseline antiga e lista autorizada vazia mantêm saída vazia.
2. Ações preservam referências e versões exatas; digest não aparece.
3. Contexto de seção permanece distinto de referência de encaminhamento.
4. Formas inválidas, campos privados extras, valores impróprios, duplicações e contexto parcialmente válido produzem mensagem neutra.
5. Referências com HTML são escapadas como texto e não produzem elementos executáveis ou links.
6. O HTML não possui navegação, formulário, botão, script ou gatilho de preparação/criação/confirmação.
7. A entrada e a ordem dos contextos permanecem intactas.
8. Falhas de accessor do produtor não vazam mensagens privadas.

Esses testes chamam o renderer de produção diretamente. Não instalam adapter de autorização, mock de C05/C06/C08 nem fixture que finja o host completo. Não substituem testes ou consumidores existentes. Não requerem Chromium ou processo filho.

Status: `NOT_RUN` para esta fatia. Apenas o root/agente de CI poderá publicar a seleção e executar Actions, junto do static gate com `bun typecheck` no package e guards aplicáveis. Nenhum teste de produto, typecheck ou guard local foi executado; não houve alteração de Protocol/Server HttpApi que exigisse geração.

## Mapeamento de critérios sem conclusão integral

- `WP01.T04.INV.01`: mantém My work como projeção dos produtores canônicos; o contexto não vira dado operacional, permissão ou comando.
- `WP01.T04.SUC.01`: acrescenta o contexto de reunião à apresentação dos itens; retomada real e composição nas superfícies continuam pendentes do host/prova pertinente.
- `WP02.T04.INV.02`, relação parcial: mostra somente os metadados recebidos do produtor; não transfere conteúdo privado nem amplia ACL. A prova de autorização do encaminhamento continua pertencendo ao produtor e à integração.

Nenhum critério completo, gate nativo ou aceite WP10 é declarado concluído por este incremento. Próxima ação: publicar a UI, executar o teste específico/static e consumir a futura montagem do owner para provar My work com os produtores reais.
