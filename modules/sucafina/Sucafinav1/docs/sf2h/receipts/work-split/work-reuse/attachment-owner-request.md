# Attachment: request para S0 e Composition/WP10

## Estado

**NOT_APPLIED / NOT_RUN na composição real.** O diagnóstico R01 chegou à chamada de attachment depois do timeout; o 404 pertence ao fixture que monta somente Colaboração. O endpoint do produto já existe. Não criar um segundo mount e não trocar a expectativa por sucesso artificial.

Referência inspecionada e rechecada: `compose-resume` em `ad7fcdef7739e1bc471e42fac082452799de751b`, tree `885ce466354d2b8dcf674472561c9c1fc3b632ff`.

## Implementação existente

| Arquivo | Blob | Responsabilidade |
| --- | --- | --- |
| apps/cli/src/sucafina-product/portfolio-http.ts | c434de513cb7ceae4acad1fc595e776785ec85af | Rota decision-answer-question, admission decisions.answer-question, envelope fechado, withCase e mutations.answerQuestion. |
| apps/cli/src/sucafina-product/portfolio-services.ts | 83c525e733b2cb21637734e3b1e07950e72f4f97 | Mutations, intent fences e resolução reais. |
| apps/cli/src/sucafina-product/host-context.ts | 834b3c967d73411771e1f5aa82b683c6427e6769 | Monta portfolioHttp e Collaboration; command identity deriva de digestSfValue({ operation, key }). |
| modules/sucafina/Sucafinav1/product/decisions/mutations.ts | 3e7575cddfd52d9f5751c0ee6179c747bb318c98 | Autorização, replay persistido, confirmação, resolução e gravação do caso. |

Manter a identidade de comando ligada à Idempotency-Key e o digest de conteúdo. O randomUUID por admissão do fixture antigo não serve para provar replay do attachment.

## Bloqueio demonstrado por leitura

`apps/cli/src/sucafina-product/business-services.ts`, blob `b3595989d0c08159c96484d96bd40a149a9721e6`, compõe createCollaborationHost sem recipientAuthority.

`product/collaboration/recipient-authority.ts`, blob `bf1845e8673fd10425713085e20b04373885fabb` nessa composição, exige prova privada para recipientRef diferente do principal: ausência de authorize recusa a leitura/atribuição; ausência de checkAtCommit recusa o commit. Diretório, nome ou acesso do autor não substituem a prova do destinatário.

O W6 publica o contrato ampliado `3b7080be16213512835902c37e58e1c88ca8405f`, com ReviewThreadRecipientAuthority para C05. A composição ainda usa answer-reuse `134ce5cd8c4f0779380936de6a439c9ea124d932`; o W6 usa `012175e4acc2be40547089b43f248144beb6c712`.

Os testes existentes em `test/product/wp08/recipient-authority.test.ts`, blob `5e43d1314e2f2c0dd2e78169dd9b98079287fa8f`, cobrem essas recusas por contrato. Foram inspecionados, não executados nesta fatia; seus doubles não são uma autoridade instalada.

## Próxima ação executável

1. S0/owner lê seu head atual por GitHub MCP, compara os preimages do [manifesto publicado](patches/published-producer-intake.NOT_APPLIED.json) e prepara um candidato próprio com a closure de Colaboração. Reconciliar qualquer avanço do owner; não sobrescrever writers.
2. Para isolar apenas a amplificação genérica na base retida, há a alternativa [mínima de13 adições/10 remoções](patches/generic-answer-dedup.NOT_APPLIED.patch), com preimage e hash exatos. Ela já existe no W6: não aplicar as duas alternativas. Não substitui C05 nem o fence final de thread/baseline do W6.
3. Após o delta causal de produtor, consumir estes testes próprios e executar [request-owner-after-intake.json](request-owner-after-intake.json) pelo protocolo test-ci: W primeiro; S filho com somente .ci-run.json; checagem de duplicatas; ref ci-run-linux única diretamente em S. Essa seleção usa arquivos já existentes e valida novamente a mesma janela de5000ms. O teste continua sendo de componente com attachment não montado.
4. No candidato de composição, conectar a autoridade privada real de destinatário em business-services.ts a partir do host-context.ts, identificando o resolver e a lease de checkAtCommit. Vincular destinatário, ator, instalação/projeto, campos/período, dependências materiais, incarnation e ACL atual. O check de commit é síncrono, protegido e sem I/O aninhado. Para C05, incluir pin da revisão e base histórica.
5. Disponibilizar fixture do host composto usando esses exports e duas sessões autenticadas distintas. Sem resolver real, manter indisponível e registrar a dependência. Somente quando o arquivo existir no candidato, preparar sua seleção explícita de attachment com validateRequest/locateTestPackage e executar um novo run causal.

Os passos1–3 são concretos e revisáveis nesta entrega. Os passos4–5 exigem fontes sob autoridade de Composition; não foram implementados por work-reuse.

## Oracle completo de contraprova até attachment

| Etapa | Estímulo e verificação obrigatórios |
| --- | --- |
| Identidade/caso | Autor A diferente do destinatário B; homônimo C não herda acesso. Caso real e pergunta criada/vinculada pelos produtores existentes; registrar incarnation e versão. |
| Mensagem exata | B envia duas respostas de texto igual. Selecionar a segunda por questionId/messageId/incarnation/version e rejeitar o seletor anterior. |
| Confirmação perdida | Gravação real; somente a entrega do primeiro sucesso é corrompida. Estado incerto observável no waiter original de5000ms; registrar também início/fim de click e início do waiter, sem postergar o relógio até HTTP200. |
| Retry C03 | Mesmo corpo e chave; reautorizar; mesmo recibo, nenhuma nova confirmação/mensagem/versão causada pelo replay. |
| Reuso C06 | answer-read real e obrigatório; resposta, autor, referência e versão coincidem; fonte, mensagem, baseline e autoridade atuais revalidados. |
| Attachment real | decision-answer-question pelo portfolioHttp existente; HTTP200 real, mesmo caso/incarnation, uma versão incrementada, pergunta respondida com answerRef exato, recibo persistido. |
| Retry do attachment | Perder a primeira entrega, repetir chave/corpo, inclusive após reabertura suportada. Reabrir o mesmo resultado; contagem de recibos/attachments e versão não aumentam. |
| Conflito | Mesma chave com outro answerRef/conteúdo recusa sem segunda escrita. |
| Reload | Nenhuma confirmação ou attachment automático; estado reaberto conserva a relação exata. |
| Revogação | Revogar fonte/caso/destinatário antes do reuso e no limite de commit: sem disclosure nem nova escrita. |
| Fonte e incarnation | Mudança irrelevante preserva validade; mudança material/dependência exige reavaliação; objeto físico substituído não herda confirmação. |

Preservar answer-read, fences, ACL, caso real, distinção observedSourceVersion/expectedStorageVersion e limites5000/10000/60000ms aplicáveis. Não ampliar prazo nem remover asserções para fechar esse oracle.

## Intervalo entre reuso e commit

`portfolio-preparation.ts`, blob `a661aaa134e046b093b300c260870e38c967aa10`, confirma a intenção humana e belongsToQuestion. Isso não é a causa demonstrada do timeout. O owner precisa demonstrar qual fence protege a validade C06 entre answer-read e o commit do caso; apenas adicionar outra leitura antes do commit não prova proteção da corrida.

## Evidências e critérios

R01: W `c5a0ced6493410d321a61f8a2fbe4c3d7d9fd40b`, S `5d5ae7d98cf6db43f5ef409ddf87bd802ef97870`, run [43625766773](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625766773). Não repetir esse run sem delta.

C03 exige identidade/recibo/reautorização; C06 exige escopo material, acesso atual e incarnation. O overlay [criteria.json](criteria.json) preserva os153 critérios WP01/WP02 e os demais gates. Attachment instalado/nativo/global continua NOT_RUN até a prova real do owner.
