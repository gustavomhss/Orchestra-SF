# WP01-F05 — recuperação do Apply compartilhado após resultado incerto e reautorização

## Estado e limite da evidência

Finding estreito de disponibilidade/recuperação, identificado por **inferência estática** em 2026-11-14. Não é recibo de teste executado, reprodução do fluxo completo, prova nativa ou gate global. Nenhum produto foi alterado para este finding; nenhum teste de produto foi executado localmente.

O incremento W6 continua publicável: o consumidor passa a enviar o `reviewDigest` real devolvido pelo produtor e conserva o mesmo corpo/chave nos retries incertos. Esta observação não bloqueia a disponibilização desse componente com sua dependência compose explícita. Ela impede declarar comprovada a jornada adicional `commit → resposta perdida → revogação → reautorização → recuperação` sem a contraprova abaixo.

## Fontes reconciliadas

Todas as referências publicadas abaixo foram lidas pelo GitHub MCP; os hashes de trabalho são identificados separadamente.

| Fonte | Pin / blob | Fato observado |
| --- | --- | --- |
| [`product/decisions/http.ts`](https://github.com/gustavomhss/Orchestra-SF/blob/4306b310e4d6dac77f9beab461adad4e8e924849/modules/sucafina/Sucafinav1/product/decisions/http.ts) | compose `4306b310e4d6dac77f9beab461adad4e8e924849`; blob `b1fca9569190eb42880387bd12c49dd769304522` | Apply admite quatro campos, incluindo proof real; faz `bindAdmittedApply` antes da execução e permite retry histórico pelo `withCase`. |
| [`apps/cli/src/sucafina-product/business-services.ts`](https://github.com/gustavomhss/Orchestra-SF/blob/4306b310e4d6dac77f9beab461adad4e8e924849/apps/cli/src/sucafina-product/business-services.ts) | mesmo compose; blob `611831c32ddbf58296b33e1930806185564189b9` | `withCase` verifica seleção e autoridade antes do callback; seu `finally` libera o scope. Não há a revalidação HTTP externa pós-dispatch presente no Dashboard. |
| [`product/procurement/decision-http.ts`](https://github.com/gustavomhss/Orchestra-SF/blob/5fd358fe91ff2153ba9e498eab0dd9ab8472d782/modules/sucafina/Sucafinav1/product/procurement/decision-http.ts) | Operações `5fd358fe91ff2153ba9e498eab0dd9ab8472d782`; blob `e169d335f091c446bb380ee73f450083f917946f` | Rota real `decision-apply` exige `caseRef`, `choiceId`, `changeId`, `reviewDigest`; mapeia `denied` a 403 e `unavailable` a 503. |
| [`product/procurement/decision-host.ts`](https://github.com/gustavomhss/Orchestra-SF/blob/5fd358fe91ff2153ba9e498eab0dd9ab8472d782/modules/sucafina/Sucafinav1/product/procurement/decision-host.ts) | mesmo Operações; blob `4209315764673f8c52fdd94fd76b0f120767b39f` | Revalida autoridade e fonte; consulta recibo durável antes de exigir review ainda vivo no cache. Quando o recibo existe, o replay conserva a necessidade do proof originalmente admitido. |
| `product/ui/decision-apply.ts` | trabalho W6, blob calculado `2e6c081ad2a5282654707f7fc7278183e7dfb20d`; base do checkout `86b2ba372d187d229820015d8311a0dd54a2c5d5` | 401/403 chama `revoke()`, limpa diff/contexto/controls e também `intention.body`/`intention`. Este hash de trabalho não é alegado como publicado naquele commit-base. |
| `product/decisions/apply.ts` | core preservado no checkout; blob `535c689f075db0d306cd2e8152930e875f6be13a` | Consulta recibo e exige `receiptReviewBinding(change, reviewDigest)` igual ao vínculo persistido; o recibo de domínio pode existir antes da reconciliação do caso. |
| `product/decisions/prepared-apply.ts` | core preservado no checkout; blob `a45436a6fef8598b7ef9eae33d061ddebf0aa43d` | Transação registra efeito e recibo; replay compara proof persistido; falha de autoridade depois do novo commit retorna `unavailable`, não uma rejeição definitiva da intenção. |

Os paths `product/...` da tabela pertencem a `modules/sucafina/Sucafinav1/`. Os cores locais preservam melhorias de reconciliação e verificação de proof; não foram substituídos por versões mais antigas de Operações. A publicação W6 deve anexar seu próprio head/tree e manifest de inputs; este documento não antecipa esse SHA.

## O que o consumidor já faz corretamente

O Apply compartilhado mantém uma única intenção durante resultado desconhecido. Para timeout, perda de resposta, 503 e 409, conserva o corpo original e a mesma Idempotency-Key, desabilita uma nova revisão e oferece retry explícito. W6 acrescenta ao corpo o proof real do produtor; não calcula digest no browser nem aceita confirmação com proof ausente ou malformado.

Ao receber 401/403, ou evento de revogação, limpa imediatamente os dados privados, desabilita ações e impede respostas atrasadas de repovoar o DOM. Essa limpeza deve ser preservada. Este finding não recomenda manter diff, labels, valores, comandos ou contextos privados no cliente depois da revogação.

## Diferença em relação ao Dashboard

O Dashboard tem uma causa concreta para tratar o primeiro 403 de mutação como resultado ainda incerto: seu HTTP revalida autoridade depois do dispatch, portanto o commit pode preceder a resposta 403. O consumidor faz discovery somente leitura antes de decidir se pode manter a tentativa; ausência de identidade autorizada fecha e limpa o conteúdo.

Não há base estática para aplicar essa mesma interpretação indiscriminadamente ao primeiro 403 do shared Apply. Nos produtores genérico e Procurement examinados, não há aquele mesmo wrapper externo pós-dispatch; o core devolve `unavailable`/503 quando a autoridade muda depois do novo commit. Um 403 também pode indicar falta de concessão humana, review indisponível ou fonte atualmente inacessível. O comportamento compartilhado não foi alterado para imitar o Dashboard.

## Cadeia causal ainda sem contraprova

1. A intenção A, com proof P, faz commit real no domínio e grava o recibo durável. A resposta se perde ou retorna 503 antes de o caso refletir o recibo.
2. O shared Apply conserva corretamente A/P e oferece o mesmo retry.
3. O retry encontra autorização temporariamente retirada e recebe 403 real. `revoke()` limpa os dados privados e destrói também a única correlação disponível naquele consumidor.
4. O mesmo usuário recupera acesso e reabre o caso, cuja reconciliação ainda está pendente.
5. Um novo review pode estar stale porque o domínio já mudou, ou pode devolver outro proof. O vínculo C12 durável exige P; uma nova intenção/proof não substitui a recuperação da anterior.

A inferência é que essa combinação **pode impedir a recuperação pela UI**. Não se afirma duplicação do efeito: a idempotência canônica do `PreparedChange` e o vínculo do recibo continuam protegendo o domínio. Também não se afirma que toda revogação deva poder recuperar um recibo: acesso revogado permanentemente deve continuar negado.

Se o caso já estiver reconciliado e uma leitura atualmente autorizada apresentar seu recibo, a correlação antiga do browser não é necessária. O caso relevante deste finding é o recibo durável ainda não refletido no caso.

## Fronteira UI / host e próxima ação

**UI WP01:** manter a limpeza atual na revogação; não criar persistência client de dados privados nesta fatia. Quando existir uma porta publicada de recuperação, consumir seu resultado autorizado, apresentar pendência/recibo e permitir somente a ação explicitamente admitida. Seletores e tokens de recuperação nunca constituem autorização, e a retomada nunca deve fazer POST de mutação automaticamente.

**Integração/Operações:** disponibilizar, se a contraprova confirmar a lacuna, uma recuperação autenticada de intenção/recibo que não dependa de refazer uma revisão de fonte já alterada. Pode ser lookup somente leitura da correlação mantida no servidor, ou token opaco emitido pelo host. A forma exata pertence aos owners; não é contrato já publicado nem autorização para copiá-lo à UI.

A recuperação precisa exigir principal original, participação atual, mesma incarnation do caso e do alvo, identidade da intenção e acesso corrente ao recibo. Deve recusar substituição de caso/fonte, revalidar antes do egress e devolver apenas estado/selector/projeção permitidos. `not-observed` não pode ser interpretado como cancelamento nem liberar uma intenção substituta. A fórmula de operação e a vinculação do proof permanecem privadas no host/C12.

O primeiro passo é contraprovar a cadeia sobre a composição real que integrar o produtor Operações e os contratos compose; não é necessário aguardar prova de execução LLM/nativa para publicar o componente W6. Testes de componente e eventual teste HTTP/host não substituem GNATIVE, os gates globais ou o epic final de S0.

## Contraprova real necessária no GitHub Actions

Usar o host publicado, C08/SQLite e produtor C12 reais; falha controlada somente no transporte/egress depois de observar o commit. Não fabricar recibo, não substituir consumidor por mock e não remapear a rota shared para um adapter Dashboard.

- Preparar e revisar a mudança real; capturar o proof devolvido pelo produtor e enviar a intenção A uma vez.
- Fazer commit durável e perder a resposta antes da reconciliação do caso. Comprovar um único efeito e um único recibo persistido, com caso ainda pendente.
- Retirar acesso pela autoridade real e repetir A. Exigir 403 e DOM privado vazio; resposta atrasada não pode repovoá-lo.
- Restaurar o mesmo principal/caso. A recuperação autorizada deve identificar o mesmo recibo, conservar P quando replay for necessário, reconciliar o caso e não executar novo efeito.
- Negativos: outro principal, case reincarnado, alvo removido/recriado, key/proof alterados e acesso ainda revogado não recuperam os dados da intenção anterior.
- Controle: se o caso já está reconciliado, a leitura autorizada atual mostra o recibo sem exigir que o browser conserve dados da revisão anterior.

Sem esse resultado, classificar como **componente W6 implementado; jornada de reautorização pendente de integração/contraprova**. Não marcar DONE integral nem tratar inferência como falha executada de um head publicado.
