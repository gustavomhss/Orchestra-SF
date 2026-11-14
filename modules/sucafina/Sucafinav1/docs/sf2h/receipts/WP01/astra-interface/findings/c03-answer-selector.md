# WP01 C03: seletor inicial de resposta e fronteira do consumidor W7

## Estado e escopo

Finding **WP01-C03-01**. Inspeção estática de fontes publicadas e implementação do consumidor; nenhuma execução local de produto, dispatch ou resultado de CI foi produzido por esta revisão. O incremento W7 implementa recuperação do componente de conversa, sem declarar a jornada completa de confirmação entregue.

Critérios relacionados: **WP01 T03.CMP01, T03.DOD01, T03.SUC01 e T05.CMP01**. Os testes propostos abaixo contribuem evidência de componente/consumo; nenhum desses critérios é elevado a DONE integral. A composição WP10, os dois atores reais distintos e as provas nativas/globais continuam com seus owners.

## Fontes reconciliadas

As fontes abaixo foram lidas pelo GitHub MCP no pin [compose4306](https://github.com/gustavomhss/Orchestra-SF/tree/4306b310e4d6dac77f9beab461adad4e8e924849). Os paths começam em `modules/sucafina/Sucafinav1/`, exceto os explicitamente iniciados por `apps/`.

| Path | Blob |
| --- | --- |
| product/collaboration/http.ts | `91091bf444bc23221d1f427138ebb9e5ca4c51bb` |
| product/collaboration/http-routes.ts | `283a7a5b80fafa38a3cfc378014bac1056c29602` |
| product/collaboration/answer-reuse.ts | `134ce5cd8c4f0779380936de6a439c9ea124d932` |
| product/collaboration/evidence.ts | `53f3497f4e9e5c4cc9432522f13bd1efec25379a` |
| product/collaboration/host.ts | `b02d38ad37877f00ee3033a3931c0e1ea620d6d8` |
| product/collaboration/thread-reads.ts | `0f17addaaadb25bad3b7985526d7803e54e8f207` |
| product/collaboration/recipient-actions.ts | `4c93bd36cdfeb53146db2e81f7763bee38ed9630` |
| product/decisions/http.ts | `b1fca9569190eb42880387bd12c49dd769304522` |
| product/decisions/mutations.ts | `57161fdd95f3d26f4dfe6d64f007127d9b67fd18` |
| apps/cli/src/sucafina-product/portfolio-services.ts | `83c525e733b2cb21637734e3b1e07950e72f4f97` |
| apps/cli/src/sucafina-product/portfolio-preparation.ts | `a661aaa134e046b093b300c260870e38c967aa10` |
| apps/cli/src/sucafina-product/host-context.ts | `0d3abcf642deb3d2f6c6346cdddc8bfb40141532` |

O intake mínimo autorizado pelo root para a fixture é `product/integration/human-authority.ts`, blob `78529a89586ce9f22d2b2cdd2cd0b1c61d20668a`, também publicado no head `7c7e5b086a9de405cd3f8e18e8d631af55cf0979`, tree `3deb1ed790fc247a6633c9cc25a11523ae3f61b1`. Ele acrescenta a lista fechada de leituras humanas; não adiciona grants à instalação. A fixture declara suas próprias permissões para seu operador autenticado.

Os produtores preservados usados pela fixture real são `product/collaboration/threads.ts`, blob `71028485ed9adadd209706369cca65d99c6cbdc8`, e `product/host-binding/state-provider.ts`, blob `c4032971e6c15b281bb55bd68474029a4e6fb8c4`. Não houve edição desses produtores.

## Contrato consumível e lacuna de primeira emissão

O HTTP publicado oferece `collaboration-thread-read`, `collaboration-thread-reply`, `collaboration-answer-prepare`, `collaboration-answer-confirm` e `collaboration-answer-read`. Não oferece `collaboration-answer-evidence` nem `collaboration-answer-reuse`. W7 retira essas duas chamadas legadas do bloco de conversas.

`answer-prepare` exige `{questionId, answerRef}`. O produtor escolhe a resposta atual do destinatário, confere a referência exata, sua ligação com a pergunta e a autoridade, e emite `observationRef`, `observedSourceVersion` e `expectedScopeFingerprint` reais. A confirmação guarda esses valores, a mesma referência e sua chave original. O CAS dessa confirmação pertence ao namespace **threads**, não `confirmations`.

`answer-read` retorna a resposta confirmada e sua referência quando há confirmação válida. Antes disso, retorna `needs-input / answer-unconfirmed`, sem emitir o seletor inicial. `thread-read` entrega mensagens com identidade, mas não entrega `answerRef`. O resultado residente `sf_answer_read` também não tem esse campo. O emissor privado `answerEvidence.issue(threadId, messageId, context)` existe no host; não há rota HTTP atual que faça essa primeira emissão para o navegador.

O contrato de `DecisionCase.questions[]` admite `answerRef` opcional. Contudo, `addQuestion` produz uma pergunta aberta sem esse campo e `answerQuestion` o grava quando muda seu estado para `answered`. Portanto, uma referência já presente em uma pergunta respondida não constitui um caminho de primeira confirmação para uma pergunta nova. A UI W7:

- não deriva referências de IDs, encodings ou texto;
- mostra confirmação desabilitada com motivo explícito quando falta a referência autorizada;
- mantém o envio de respostas utilizável;
- identifica uma pergunta já respondida como já registrada;
- condiciona o consumidor de preparação/confirmação a um seletor efetivamente fornecido pela projeção autorizada, sem afirmar que o host atual já produz esse estado para perguntas abertas.

Os testes de transporte que exercitam essa última condição usam uma entrada de apresentação tipada e explicitamente declarada. Não são prova de emissão de seletor pelo host.

## Inclusão da resposta na decisão

Existe contrato publicado para `decision-answer-question` com os campos fechados `{caseRef, questionId, answerRef}`. O HTTP permite retry histórico. `portfolio-services.ts` monta `createDecisionMutations` com `business.collaboration.resolveAnswer` e `preparation.confirmAnswer`.

`portfolio-preparation.ts` confere caseRef, questionId e answerRef contra o payload humano admitido, chama a autoridade humana de `decisions.answer-question` e verifica `answerEvidence.belongsToQuestion`. A mutação exige pergunta aberta, resolve a referência real e registra a resposta/evidência no caso. Essa é a semântica observada; não se atribui ao callback um recibo adicional de confirmação que ele não verifica.

W7 chama `answer-read` depois de confirmar e exige a mesma referência, autor, conteúdo e versão observada que vieram da preparação. Só então congela a solicitação de inclusão, com chave independente. A confirmação e a inclusão conservam seus respectivos corpos/chaves após resultado desconhecido. A UI valida o recibo do caso antes de limpar a tentativa. A prova desta sequência em W7 é de contrato/transporte; a composição completa ainda depende do intake pelo owner e do seletor inicial.

## Recuperação própria implementada

O primeiro bloco de `product/ui/work-collaboration.ts` passa a limitar a dez segundos cada leitura ou escrita, inclusive a leitura do corpo da resposta. Revogação aborta requests ativos, limpa dados/seletores/rascunhos do DOM e impede uma resposta atrasada de reconstruir a conversa. Falha de leitura preserva texto e estados originais dos controles.

Reply desconhecido conserva corpo, chave, identidades previamente vistas e texto bloqueado. Uma resposta HTTP200 vazia não encerra a tentativa: o consumidor exige a mesma thread e uma mensagem nova identificável, com ID/incarnation distintos dos já conhecidos, autor atual e texto congelado. Mensagens simultâneas não obrigam que essa mensagem seja a última do retorno.

A primeira rejeição `409` com razão **product-state-changed** tem tratamento separado: C08 devolve essa razão antes de chamar o trabalho e antes do commit, depois de verificar recibos idempotentes existentes. A UI oferece **Review changed conversation**, relê as mensagens e conserva o texto; só um novo envio explícito obtém nova versão e chave. Um retry que já estava inconclusivo conserva sua intenção mesmo que receba essa rejeição posteriormente.

Para confirmação, o produtor converte esse conflito C08 em `stale / product-state-changed`, ainda antes do commit. Apenas essa razão permite uma nova preparação por clique explícito na primeira tentativa. `answer-scope-changed` também pode surgir depois do commit, então continua inconclusivo. Não se classifica todo409 como rejeição definitiva.

## Contraprovas para Actions

`test/product/wp01/thread-recovery.test.ts` contém 14 observações propostas, sem resultado atribuído nesta revisão. Seu helper `thread-domain-fixture.ts` compõe login criptografado, fonte Dashboard real, autoridade de fonte, C03 threads e persistência C08 reais, com três envelopes HTTP finos e declarados. A projeção de caso é entrada de apresentação, e não um caso do host WP10.

Cinco casos usam esses produtores reais: commit com corpo suspenso e retry sem segundo efeito; commit com entrega de ack vazio; logout durável durante tentativa inconclusiva; escrita concorrente causando primeiro409 seguida de revisão explícita; falha de transporte inicial seguida de conflito C08 real conservando o corpo/chave original. As demais observações verificam deadline, ausência/mismatch de seletor, proof de preparação, recuperação de inclusão, limite de commit da confirmação e supressão de respostas atrasadas.

As assertions existentes em `edit-recovery.test.ts` foram preservadas. Seu ack vazio de sucesso foi atualizado para o shape real de thread, e a fixture da falha de preflight recebeu seletor explícito. Esse arquivo continua sendo teste de contrato/transporte.

## Próxima ação de integração

O owner de composição deve publicar uma leitura autorizada aditiva que emita o candidato atual com `answerRef` real e identidade da mensagem, ou incluir esse candidato no DTO de leitura já existente. Deve chamar o emissor privado e revalidar autoridade/fonte; não precisa reintroduzir os nomes legados. O consumidor precisa distinguir ausência, mudança e revogação sem reconstruir referências. A contraprova integrada deve começar com pergunta aberta e resposta real de outro destinatário, obter o primeiro seletor, confirmar o snapshot observado e adicionar a resposta ao caso, incluindo perdas de resposta e mudança de fonte entre as etapas.

Há um limite adjacente do recibo de reply: `recipient-actions.reply` grava e depois retorna uma leitura atual. Duas mensagens novas do mesmo autor com o mesmo texto podem tornar a correlação ambígua. A UI conserva a tentativa nesses casos. Um recibo do produtor ligado à mutação e à identidade da mensagem permitiria resolver essa ambiguidade; W7 não inventa esse recibo e não declara prova de recuperação completa desse cenário.

O helper real usa um operador com escrita habilitada. Read-only scope, recipient-actions com dois atores distintos, montagem HTTP completa, Atlas e execução nativa não são comprovados por ele. Nenhum desses limites autoriza remover gates ou assertions já existentes.
