# Revisão de desempenho C05 após W5

Análise somente de leitura sobre W5 `0d9820924b33a8fc7b145f54a675aeef76c98489`, tree `39cec0a91dc5ebc2dde012d4d1d8b63166074373`; snapshot `49e83715497e221350a8c221f45968debb566bea`. Fonte runtime: [run 43619790251](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43619790251), job `132522634877`, log SHA-256 `dd5b4a6b646775c0a32337f27d8df304498c277b2ee33a6cfca23dd603432a83`. Nenhum teste foi executado nesta revisão; nenhum produto foi alterado.

## Diagnóstico observado

Os checkpoints do primeiro caso mostram progresso contínuo. A jornada chega à confirmação, reabre SQLite, edita e reconfirma a resposta e cria a conversa de domínio corrente. O teste termina FAIL por seu limite de 120 segundos, com duração reportada de 253.128,15 ms. Não há evidência de uma única espera travada nesses checkpoints. O segundo caso completo passou em 99.895,10 ms; seu resultado não concede PASS ao arquivo inteiro.

| Trecho entre checkpoints | Tempo observado |
| --- | ---: |
| Meu trabalho não confirmado + leitura não confirmada | 24.463 ms |
| Preparação HTTP | 17.578 ms |
| Confirmação e retry idempotente | 22.343 ms |
| Leitura confirmada, Meu trabalho e recusa C16 sem pin | 26.038 ms |
| Reabertura SQLite e reuso | 23.178 ms |
| Edição e duas projeções de trabalho stale | 34.193 ms |
| Reconfirmação, histórico e resolução | 81.438 ms |

O último trecho agrupa várias operações; os checkpoints não permitem atribuir seus 81.438 ms a uma única chamada. Tampouco estabelecem uma relação linear entre número de leituras e latência.

## Duplicações delimitadas

### 1. Relação entre resposta e pergunta

No host W5, `answer()` já lê a thread autenticada, deriva a referência canônica da mensagem do destinatário e compara uma releitura C08 integral antes de devolver a resposta. `scopeForAnswer()` também encontra essa mesma referência integral na mensagem canônica. Mesmo assim, `answer-reuse.ts` chama `belongsToQuestion` duas vezes em `prepare` e `read`, e uma vez em `confirm`.

Esse callback percorre `belongsToQuestion → resolve → issue → threads.read` duas vezes. No caminho C05 de destinatário, cada leitura de thread autoriza a revisão antes/depois, somando quatro `ReviewPort.read`. Portanto cada `belongsToQuestion` acrescenta oito leituras completas C05 para uma relação que os leitores adjacentes já verificaram.

| Operação positiva C05 | Leituras completas W5 | Após deduplicação de membership proposta |
| --- | ---: | ---: |
| `prepare` | 32 | 16 |
| `read`, confirmado ou não confirmado | 32 | 16 |
| `confirm` | 20 | 12 |

São contagens estáticas do caminho positivo, específicas à composição examinada. O caminho de fallback histórico ou um retorno antecipado pode executar quantidades diferentes.

A proposta WP08 de membership C08 canônico é delimitada se continuar privada à composição de answer reuse: conferir autoridade completa, participação, última resposta do destinatário, referência integral e base C05; revalidar a request após a leitura. A autorização real continua nos leitores de `answer`, na fonte C05 e nos fences finais. Preservar a segunda leitura de `answer`, a comparação integral do estado, a identidade do corpo/mensagem/base, a autorização humana dentro do commit e os fences C08/egress. A evidência pública `answerEvidence` mantém seu comportamento completo para outros consumidores. Não usar cache global ou compartilhado por contexto/pergunta.

### 2. Resolução de escopo repetida em Meu trabalho

O consumidor C05 `answer-work.ts` chama `source.resolve(reviewed)` e compara seu escopo com a baseline. Em seguida, `source.observe(scope, reviewed)` repete as duas leituras C05, deriva `answerMaterial` e exige igualdade de digest do escopo inteiro antes de preparar acesso.

No adapter WP07 publicado, `answerMaterial` valida a fonte única, incarnation, versão, período e fields; inclui todas as dependências e recusa dependências nonrecord que C06 não representa. `observe` ainda prepara a concessão completa, verifica o fence em snapshots protegidos e recheca providers após o último await. Assim, a chamada anterior a `resolve` não acrescenta um oráculo de escopo/dependências ao consumidor.

É seguro retirar apenas essa chamada redundante de `answer-work`, sem mudar o adapter WP07. Permanecem: igualdade da base com `baseline.reviewBasis`; autorização antes/depois; `observe`; todos os fingerprints; releitura da thread e baseline; revalidação; identidade dos providers usados; e fence dentro de `transactionAll`. São duas leituras C05 a menos por `project`; `listPresentation` faz duas projeções, economizando quatro leituras completas por item confirmado. Não remover a segunda projeção de Meu trabalho, que verifica mudanças entre as fases.

## Divisão das jornadas sem perder continuidade

O primeiro caso W5 contém 43 chamadas `expect` no código; o segundo contém 15. O inventário independente W5 confirma 58 sites, contra 54 na versão anterior, sem remoções. O loop final de ACL contém três sites executados para cada uma das três superfícies. Preservar esse multiset e a expansão do loop; números de sites não substituem assertions runtime.

Cada caso novo deve criar e confirmar sua revisão/thread por operações canônicas reais, dentro de seu próprio relógio. Não compartilhar fixture mutável entre testes, semear baseline diretamente, mover preparação para `beforeAll` fora do limite ou aumentar o timeout.

| Jornada independente | Cadeia e oráculos que devem permanecer juntos |
| --- | --- |
| A — confirmação HTTP, retry e reabertura | Preservar revisão; criar pergunta; alterar origem corrente; responder; conferir base original. Recusar referência incorreta sem vazamento. Mostrar trabalho não confirmado com pin e estado `answer-unconfirmed`. Preparar por HTTP e confirmar exatamente o token exibido, preservando pin, versão e ausência de dados privados do lease. Conferir retry sem nova versão, leitura confirmada, retirada do item, digest da revisão e ausência de mutação empresarial. Recusar C16 sem pin. Reabrir SQLite real, provar store anterior disposed, mesma baseline e item suprimido; token antigo deve ser negado e a versão não deve avançar. |
| B — edição após reabertura, reconfirmação e histórico | Criar e confirmar baseline por portas reais; reabrir SQLite antes da edição. Editar a mesma mensagem/incarnation/version. Mostrar exatamente um item stale com motivo e pin; segunda lista deve ser idêntica. Negar a confirmação antiga, emitir referência nova e diferente, preparar/reconfirmar, retirar o item, ler o corpo original pelo histórico com pin, resolver a mesma thread e reusar o texto editado com pin. O reopen anterior à edição fazia parte da cadeia original e deve continuar. |
| C — isolamento do domínio corrente e revogação | Criar e confirmar uma resposta C05 real. Criar conversa de domínio corrente com o mesmo texto e uma referência corrente distinta; ela deve continuar não confirmada, com C16 corrente permitido, sem herdar a baseline C05. Revogar a ACL da revisão e verificar `read`, `prepare` e Meu trabalho: todos non-ok, sem texto de resposta ou reviewId. |

O segundo caso W5, que já passou, mantém sua cadeia inteira: revogação no último await humano da resposta, concessão renovada, revogação dentro do commit da confirmação, confirmação nova após revisão humana e rejeição da recriação física do mesmo ID. Qualquer mudança transitiva de consumidores deve ser qualificada no run do candidato correspondente.

## Fronteira de aceitação

Os três casos WP07 passaram em W5 e qualificam a fonte/fences no seu escopo de fixture; não precisam ser tratados como runtime pendente. O agregado W5 continua 8 PASS / 2 FAIL. O segundo FAIL WP08 é a seleção incondicional de `readHistorical` para uma preparação corrente; corrigir a escolha do leitor mantendo comparação integral da thread/mensagens e o fallback histórico somente quando a base corrente não é canônica. Nenhuma dessas propostas muda o adapter WP07 ou concede aceite de UI/browser, host instalado, nonrecord histórico completo ou execução nativa.
