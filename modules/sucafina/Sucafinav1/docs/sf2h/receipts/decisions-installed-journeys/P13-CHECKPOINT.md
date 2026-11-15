# P13 + diagnóstico16 — checkpoint documental ACTIVE

Este pacote continua a missão52/PR40 sobre o checkpoint publicado `4a6e73d88565ee8e6d51f00707f9eee63437629a`,tree `a52b769cd9da5d2670dad82f44e6bf21f14e5abf`. Não encerra a missão, não emite release ou handoff terminal e não presume integrador sucessor.

**Nominal17: 3 PASS / 2 FAIL.** A qualificação funcional permanece aberta; nenhum handoff terminal ou release é emitido.

## Material completo e limites

P13 usa base C53/terminal105 `eeff9b78219b5efe1ad78e68d4490af0d7c5ed07`,tree `072950bafdc50b9eddc549f7a327742bc5086bf6`. W congelado `2624fe74b31cb5613f9c8546961e7a393f06ab9e`,tree `73ef254b9b9e75f8a9a3db900684b0b756f080b3`, contém34 paths:10 próprios já publicados,20 propostas compartilhadas e4 propostas unitárias. O patch completo SHA256 `c2ff073b0e1a1f12b2ee3e58f18428eac695f0c443d2c68b6672da76fa0bee75` conserva todos os paths. As propostas compartilhadas permanecem inertes na fonte52; não houve escrita no alvo.

O índice `delivery/current-image-index.json` fecha todas as pre/postimages:50 referências imutáveis ao commit4a6 e10 imagens novas. Os dois rebases de host-context/BCS preservam as alterações C49/C50 e são documentados por prova textual própria. O LocalStore cumulativo parte do blob alvo d9ea; a pequena proposta de acesso parte do postimage P11 5d7 já publicado. Ambas as relações estão explícitas, sem confundir seus patches.

A capacidade opcional currentAccessSnapshots limita a projeção de dados a roleMap/access e conserva metadados externos e verificações canônicas. currentSnapshots completo continua disponível para fontes/negócio. As revisões estáticas não concedem ganho de desempenho, compilação ou aceite instalado. Não há cache de ACL/credencial/autorização, omissão de revalidação, mudança de política, timeout ou orçamento. P12 está excluída. Nenhum marcador ou helper diagnóstico D7/D8/D14/D16 está em W.

## Evidência e campos ainda não vinculados

Unit05 [run 43686211157](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43686211157): **74 PASS / 0 FAIL**, 477 assertions, 3 arquivos, 8840 ms. Job de testes `132727117045`; cleanup `132727553319` com resultado `success`. O recibo é do mesmo W; o resultado é suplementar e não substitui as cinco jornadas UI.

Nominal17 [run 43686512586](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43686512586), job `132728008356`, cleanup `132729059840` `success`. S `5ae402f2c3347619d882af10cc043952048a74c8`. Os resultados individuais pertencem ao W declarado:

| Jornada | Resultado | Duração do caso | Limite do recibo |
| --- | --- | ---: | --- |
| J1 | FAIL | 83611 ms | FAIL: three comparisons200/ok and numeric rule200/ok; choice POST aborted before original response. Choice commit and P9 capture UNKNOWN_UNQUALIFIED; retry/history/source change NOT_REACHED. |
| J2 | FAIL | 15917 ms | FAIL: RequestsGET503/procurement-queue-unavailable/form0 before any financial mutation; later formal-approval contract NOT_REACHED. |
| J3 | PASS | 13894 ms | PASS |
| J4 | PASS | 9021 ms | PASS |
| J5 | PASS | 9764 ms | PASS |

As durações são dos casos, não latências HTTP. O audit da fonte real de W confirma o timer genérico de10.000 ms compartilhado por compare e choose, sem medir a duração dessas requisições. Somente observações efetivamente alcançadas alimentam fragmentos limitados; não há aceite global automático.

A matriz vinculada conserva83 registros originais e83 integrated_proofs vazios; registra226 fragmentos limitados, sem novo PASS de critério inteiro. A projeção literal SHA2569d22ddded549270e6a5510808f02f7f43a5adb42f15ba2fa146f458fe8d63652 permanece intacta. O documento financeiro sucessor foi vinculado por seu hash real e preserva a separação entre a falha Requests503/form0, a política de aprovação formal e as observações estáticas C53/terminal105.

D16 acompanha este pacote como adendo histórico separado:3 PASS/2 FAIL diagnósticos, três compareHTTP200 e regraHTTP200, seguidos de aborto do POST de escolha antes da resposta original. Commit/captura permanecem UNKNOWN_UNQUALIFIED; retry/histórico/mudança da fonte NOT_REACHED. Zero fragmentos de aceitação. Seu erratum preserva o S inicial com zero runs e a correção same-tree. O estado de leitura da autoridade em seu README é o corte anterior da preparação; a leitura integral terminal105 anexada agora resolve essa observação sem reescrever D16.

## Autoridade observada

O documento terminal105,blob `b59f98f415dd114a9b797fa3d1ef667c6293c05c`, declara ENDED_BY_INTEGRATOR105 e novo appointee null. A fonte52 continua ACTIVE segundo seu mandato existente; nenhum takeover de105/101 ou autorização de integração é inferido. O destinatário47 solicitado pelo usuário é preservado para o futuro handoff. CI101 permanece com sua fila distinta e preservação expressa da série52 existente; novas execuções exigem a reconciliação/deduplicação apropriada.

Este builder trata apenas arquivos,JSON,hashes e diferenças textuais. Não executa produto,tests,compiler,dispatch nem mutações remotas. A publicação permanece responsabilidade do root com leitura fresca de source/PR e CAS não-forçado.
