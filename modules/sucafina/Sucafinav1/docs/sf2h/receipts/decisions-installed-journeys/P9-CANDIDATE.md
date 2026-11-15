# P9 — captura histórica protegida e nominal12

Checkpoint intermediário da missão52. **Fonte52 ACTIVE; nenhuma entrega terminal ou liberação global.**

A proposta captura a projeção real do Planner dentro da mesma transação C08 que registra a escolha humana, o ledger e o outbox. O reader verifica o caso, a escolha, o evento completo, a captura e a autoridade atual; o recordHistory existente continua responsável por provar acesso atual e continuidade da fonte física. Replay não recaptura nem preenche registros legados. O outbox continua pending; a escolha não cria aprovação financeira ou publicação Atlas.

A unidade adicional executada em Actions passou50/0,306assertions,2.70s, um arquivo, run43676716309. Os três adversariais de concorrência usam um writer SQLite real fora do contexto de leitura. Isso não substitui as cinco jornadas UI.

## Cinco resultados na mesma composição C41

W `c4883ae51636a4ebbcf9274994e96e2725214e48`; S `de56ec928b22ffbaf3b4110262bce3dec0f1441c`; run43676977918. Resultado: **3PASS/2FAIL**, sem skips/retries.

| Jornada | Resultado | Fronteira |
|---|---|---|
| J1 — fontes, alternativas, comparação, regra, escolha e histórico | FAIL63624ms | Fontes reais1200/2400, anexação e duas alternativas com recuperação do mesmo intento concluídas. Primeiro decision-compare abortou sem resposta HTTP. Regra numérica executável, escolha e históricoP9 não alcançados. |
| J2 — financeira obrigatória | FAIL15955ms | RequestsGET503, formulário0, nenhuma mutação financeira. Aprovação/Apply/recibo não alcançados. M31/MI07 continuam abertos separadamente. |
| J3 — criar, editar e reabrir | PASS13991ms | Mesmo caso durável pela UI. |
| J4 — catálogo real | PASS9533ms | Catálogo JSON do caso correto, sem aceitar HTML200. |
| J5 — criação incerta | PASS9858ms | Leitura recupera a criação após perda da resposta, uma única submissão. |

Os tempos são durações de testes/etapas, não latências de HTTP. Os artifacts não permitem atribuir causa interna ao abortamento do primeiro compare. Os50tests suplementares não concedem aceite ao históricoP9 na UI. Nenhum passe de11 foi usado para completar12.

## Patch, critérios e checks

O pacote C41 tem31paths:10 próprios,19propostas compartilhadas e2unidades de teste. Patch completo, imagens anteriores/posteriores e revisão independente estão incluídos. Propostas compartilhadas são arquivos.txt inertes na fonte52; foram executadas apenas no W isolado. As43entradas raiz de W são preservadas em S, com a única adição do sentinel.

Os83critérios originais permanecem NOT_RUN, com83integrated_proofs vazios. A matriz preserva146fragmentos limitados, sem promoção automática. Os checks da fonte seguem FAIL:130diagnósticos de TypeScript e43GATE/18WARN, todos idênticos aos dois baselines, zero novos.

O envelope12 inicialmente declarava15000ms para o timer de requisição. A auditoria de fonte confirmou10000ms no mesmo blob de UI dos dois W; somente o metadado foi corrigido. Código, budgets e resultados nunca mudaram. O erratum preserva pre/posthashes.

## Próxima composição observada

C44 já integra coverage80, canonical-read76 e HTTP74. A nominal13 foi despachada com os28posts52 restantes, herdando o transporte e mapa/fixture74 e retirando três overlays52 substituídos. Nenhum resultado13 é presumido aqui. Material ativo89 não foi consumido. A47 segue destinatária solicitada; ACK71 é a custódia real observada, sem autorização52 de escrever o target.
