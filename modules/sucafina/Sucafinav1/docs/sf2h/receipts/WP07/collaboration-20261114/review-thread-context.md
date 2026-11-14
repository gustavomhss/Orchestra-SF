# C05 em perguntas e discussões preservadas

Este incremento fecha o consumidor próprio que faltava entre a revisão preservada e o contexto de uma pergunta C06. É distinto do vínculo já implementado entre o fechamento da revisão e a ação canônica de Meu trabalho.

Critério principal, sem redução de escopo: **WP08.T02.CMP.02 — “Perguntas sobre revisão preservada mantêm a referência C05 e não são deslocadas silenciosamente para os dados atuais.”** A prova de UI/host e destinatários continua sujeita aos respectivos produtores e não é inferida de um teste do consumidor.

## API publicada pelo produto de revisão

`createReviewServices(...).threadContext` compõe o próprio `reviews.read` com a autoridade atual do host. O mesmo factory pode ser usado diretamente como `createReviewThreadContext({ reviews, host })`.

```ts
type ReviewThreadContext = {
  reviewRef: string
  reviewVersion: number
  reviewDigest: string
  sectionId: string
}

threadContext.prepare({ reviewRef, sectionId }, originalBasis, context)
threadContext.authorize(pin, originalBasis, context)
```

O pin tem exatamente quatro propriedades. Não é uma `BusinessEvidenceRef`, não é uma autorização e não concede acesso ao destinatário. `prepare` emite o pin apenas depois de duas leituras C05 autorizadas e estáveis. `authorize` reabre a mesma referência, versão, digest integral e seção, sob o contexto autenticado atual. A origem C17 da pergunta precisa constar exatamente na seção capturada; período, encarnação, versão e todas as evidências escolhidas permanecem os originais. Nenhuma referência de revisão é fabricada para passar por um resolver de registros.

O reader captura a identidade dos objetos e métodos `reviews.read` e `host.revalidate`; substituição durante um await recusa a saída. Os argumentos são copiados antes do I/O. Falta de revisão, versão alterada, digest incorreto, seção/período trocado, fonte externa ou campo privado inesperado no pin são recusados sem devolver conteúdo C05.

`createReviewApplication` monta `POST ?sf=review-thread-context` no HTTP existente. O corpo fechado é `{ reviewRef, sectionId, basis }`; `basis` contém exatamente `sourceRef`, `sourceIncarnation`, `observedVersion`, `period` e `evidenceRefs`. A UI envia a base real selecionada e recebe os quatro campos do pin emitidos no servidor. A rota usa a admissão existente `sf_review_prepare`, verifica origem, método, tamanho, request e autoridade atual, chama `prepare` e repete `authorize` antes de devolver JSON `no-store`. Não cria um novo contrato global nem exige que o browser monte um digest C05. Mudança do objeto ou dos métodos do producer, ou resultado para outra revisão/seção, recusa a saída.

## Integração pareada WP08

O host de colaboração recebe `authorizeReviewThreadContext(pin, basis, context)` ligado a `services.threadContext.authorize`. WP08 conserva o pin em `messages[0].sourceContext.reviewContext`, junto da base C17 original, e o propaga sem alterações para as respostas. Isso permite que C08 proteja o contexto histórico da mensagem, evitando metadados mutáveis no topo da thread.

WP08 revalida o callback na criação, leitura, histórico, resposta e saída, além dos gates C17 e do fence C08. A primeira criação sem o callback é recusada. Uma atribuição a outro destinatário não presume permissão para C05 a partir do diretório, do ID ou do acesso aos registros. Sem uma lease própria de autorização desse destinatário para a revisão, a atribuição é recusada. O caso positivo local usa destinatário autenticado igual ao autor e não é apresentado como prova de autorização empresarial entre atores.

Uma resposta sobre a revisão antiga não autoriza reutilização factual sobre a versão atual do projeto. O produtor de escopo de reuso C05 precisa existir antes desse caminho ser liberado; indisponibilidade explícita é preservada.

## Prova preparada para Actions

Arquivo: `modules/sucafina/Sucafinav1/test/product/wp07/review-thread-context.test.ts`.

A seleção usa C05, C06, C08, SQLite, seletores Dashboard e comando Portfolio reais. A identidade dos atores, leases de destinatário e arquivo C17 histórico são fronteiras configuradas da fixture e permanecem explícitas. O teste:

- preserva uma revisão, emite seu pin pelo factory real e cria uma pergunta C06 com a base original;
- obtém o mesmo pin pelo HTTP montável, antes e depois da mudança de dados, recusando campo extra, origem diferente e ACL C05 revogada;
- altera o estado do projeto pelo comando oficial e responde no contexto da revisão antiga, sem mover período, fonte ou pin;
- verifica que o digest C05 não muda, que responder não altera dados do projeto e não cria Hot Topic;
- lê o histórico autorizado com a base original e mantém uma única linha de Meu trabalho para a mesma thread, com seu pin C05;
- confirma a indisponibilidade explícita do reuso factual C05 sem um produtor de escopo próprio;
- rejeita versão/digest/seção/período/fonte incompatíveis e chave privada desconhecida;
- nega destinatário sem autorização C05 própria, apesar da seleção explícita de seu ID;
- submete adulteração de digest e seção da primeira mensagem à transação C08 real, que deve recusar a alteração do histórico;
- revoga acesso C05 imediatamente antes do callback de commit real, tanto na criação como na resposta, e exige que mensagens e versão de armazenamento permaneçam iguais;
- nega troca de provider com os mesmos dados e revogação C05 entre verificações, sem expor pergunta, resposta, histórico ou Meu trabalho.

Nenhum produto, teste, typecheck, guard, browser ou export foi executado localmente. O incremento só recebe prova de execução depois da publicação conjunta com WP08 e da seleção cirúrgica em GitHub Actions. Não é prova de Relay, Session, SkillLoadReceipt, UI instalada ou aceite global. Os mapas e recibos anteriores permanecem aplicáveis.

## Consumo pelo owner do host

O host deve montar o callback do mesmo `createReviewServices` autenticado, sem criar uma segunda instância que devolva apenas metadados ou um booleano em cache. O consumidor geral de UI deve abrir a referência C05 original e mostrar revisão, versão e seção, além da base C17. A emissão da identidade de um destinatário arbitrário e sua lease privada de C05 continuam do produtor de identidade/host, sem alterações de ownership neste incremento.

A UI solicita o pin pela rota `review-thread-context` e envia o resultado como `draft.reviewContext` à criação C06 já existente. O par WP08 reabre e autoriza o C05 no servidor; o sucesso HTTP anterior não serve como permissão durável nem elimina a verificação no commit.
