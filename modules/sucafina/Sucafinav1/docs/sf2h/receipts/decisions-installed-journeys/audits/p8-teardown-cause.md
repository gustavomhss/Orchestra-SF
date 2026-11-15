# Missão52 — isolamento e teardown após nominal10

## Evidência observada e fronteira da conclusão

Run [43670807969](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43670807969), W `812d6bd9de70890775708533a7b05687c2d4d93d`, S `e5e0d9ea5d1cf017c02fcce38b40e1812dfe1f55`. O material de produto é C28 + P7 e a unidade59 exata; esta análise não altera esse produto.

| Identidade por linha do spec | Resultado observado | Duração |
| --- | --- | --- |
|12 — evidências, alternativas, comparação e escolha/histórico | Timeout do teste original180000ms; último step de registrar escolha ainda aberto (duration=-1) |183430ms |
|21 — Procurement, aprovação, Apply e recibo | Falha de setup: `listen EADDRINUSE: address already in use ::1:4110` |212ms |
|35 — criação, edição e reabertura | Mesmo erro de setup |219ms |
|87 — catálogo real | Mesmo erro de setup |235ms |
|135 — recuperação de criação incerta | Mesmo erro de setup |232ms |

Resultado do run:0PASS/5FAIL. As últimas quatro identidades não alcançaram sua jornada de produto. Em particular, nominal10 não repetiu o GET503 financeiro: o caso financeiro parou antes da instalação própria estar disponível. O último Requests503 real permanece nominal09. Não se transfere nenhum PASS anterior para nominal10.

O artefato10 não contém `decisions-observations.json` nem `wp03-real-cli.log`. Tem screenshot, vídeo e error-context. O DOM da primeira identidade mostra Version4, comparação conditioned e escolha incerta com retry disponível; não mostra uma escolha persistida confirmada. Não há HTTP/payload, instante de requestfailed, duração do produtor ou PID nesse artefato. Portanto, não se afirma que houve resposta HTTP específica, deadlock CDP, lentidão de produto ou confirmação/commit da escolha.

## Defeito demonstrável no controle da espera

Fontes exatas em W acima:

- `packages/app-shell/e2e/sucafina/decisions-support/closure-response.ts`, blob `fa509e9d7a7da9d0024c9487975f7b26b3b29146`: `completed` só resolve/rejeita no callback de `Fetch.requestPaused` de Response. Não há caminho terminal para requestfailed anterior à resposta ou fechamento da página.
- `choice-history.ts`, blob `de8671b4482339791b8f03bd5616c13d50dc4a87`: o corpo aguarda `Promise.all([interruption.completed, failed])`. `failed` é um `waitForEvent("requestfailed")`, portanto resolve quando a falha acontece; esse evento não rejeita o outro promise.
- `journey.ts`, blob `3f548f0afdbb2d0c17c3cf9f0c3d4dd63b25f2b2`: observações e `installation.stop()` existem somente no finally do corpo assíncrono.
- `wp03/installation-fixture.ts`, blob `8c015003e850561c5ee7fb430203fed4b06feaaf`: reserva localhost4110, recusa serviço pré-existente, inicia o CLI próprio e só o stop encerra esse child, verifica liberação da porta e anexa log. Permanece somente leitura.

Se a requisição falhar antes de uma Response interceptável, `failed` resolve e `completed` fica pendente. A promessa agregada não termina; nem o finally do interceptor nem o finally que encerra a instalação são alcançados por esse caminho. Timeout do runner não cancela automaticamente uma Promise JavaScript arbitrária. A falta de anexos e o conflito posterior da porta são consistentes com esse caminho demonstrado no código. O artefato incompleto não identifica o evento de rede exato nem comprova isoladamente o PID que reteve4110.

O helper owned `lost-response.ts` já possui `requestfailed` com guard `responsePaused` para a criação. `command-response.ts` também rejeita sua espera em requestfailed e possui sequência de continuação/encerramento. Nenhuma evidência exige modificar esses helpers ou atribuir o problema a conflitos entre sessões CDP.

## Proposta1: tornar a espera de closure terminal

Arquivo completo em `m52-work/teardown10/closure-response-material.json`; patch em `closure-response-complete.patch`.

- Rejeitar `completed` quando a requisição exata falha antes de `responsePaused`, em vez de aceitar uma resposta que nunca foi observada.
- Marcar `responsePaused` antes de ler o corpo: o `Fetch.failRequest(ConnectionReset)` deliberado depois da resposta real não pode ser confundido com falha anterior.
- Rejeitar espera pendente no fechamento da página.
- Remover listeners e encerrar a sessão uma única vez, com detach no finally mesmo quando Fetch.disable rejeita; limpar também se Fetch.enable falhar.
- Preservar o mesmo URL/método, Fetch em Response, leitura do corpo original, payload, erro ConnectionReset e todas as assertions existentes. Não dispara requisição adicional, não altera produto e não define timeout.

As duas chamadas `expect` originais de closure-response continuam byte-idênticas; as assertions dos callers e do spec não são editadas. O spec mantém blob `b6f63bfa1b8eacb5bf37a5c5b0d508fd658d70cf`. O caso de sucesso ainda exige resposta real e comprova o payload e efeito via fluxo original. Uma escolha que não responde continuará FAIL e deverá produzir evidência da falha em vez de consumir todo o teste aguardando uma promessa órfã.

## Proposta2: propriedade de teardown independente do corpo

Arquivo completo separado em `m52-work/teardown10/journey-teardown-material.json`; patch em `journey-teardown-complete.patch`.

O helper owned registra o stop da instalação retornada em `WeakMap<TestInfo, () => Promise<void>>` e acrescenta `test.afterEach`. O finally normal e o hook chamam exatamente a mesma promessa memoizada de `installation.stop()`. A entrada é removida quando esse único stop termina. Assim, mesmo se outra promessa do corpo permanecer pendente ao estourar o budget, o runner pode executar o teardown da instalação antes da próxima identidade.

Não há novo timer, mudança em test.setTimeout/expect.timeout ou timeout configurado de hook. SIGTERM/SIGKILL, comprovação de saída, confirmação de porta e redact/attach continuam sendo o stop existente do fixtureWP03. O patch não seleciona PID arbitrário, não mata serviço desconhecido, não reutiliza porta ocupada nem escolhe outra porta para esconder a falha. A inicialização que ainda não retornou continua responsabilidade do tratamento de erro já existente dentro de startPlannerInstallation.

O hook não fabrica observações ausentes do corpo. Sua função é garantir a chamada independente do stop; no caso observado, a proposta1 permite que o corpo termine pela falha real e conserve o mecanismo original de anexos. Não se promete conteúdo que o run10 não gravou.

## Entrega e limites

As duas propostas são independentes para revisão e têm preimage/postimage completos. Não é necessário editar fixture compartilhadaWP03 para esses defeitos. Os cinco títulos, identidades, ações humanas, payloads/assertions e budgets permanecem intactos. Nenhum seed, chamada direta de mutação ou substituição de jornada foi introduzido.

A próxima execução original das cinco jornadas pode qualificar o cleanup e expor a falha de escolha real com logs/rede. Essas propostas não antecipam seu resultado e não justificam otimização de produto com base no tempo total180000ms.

Análise e preparação exclusivamente estáticas em scratch. Nenhum teste, compilação, execução de produto, dispatch ou alteração remota foi realizado pelo auditor.

### Hashes

| Artefato | SHA256 / blobs |
| --- | --- |
| `closure-response-material.json` | `30904f9cf80eaa8097bdb42db87c19193d336546567d36e6a60b31ab5d020305` |
| `closure-response-complete.patch` | `ebbb55358858669d787d25c1531e74722f21fdab70fc26dd91781b4c9d9486b7` |
| `journey-teardown-material.json` | `2fda11837974fea357e14c79d4eeae8c0c370175d06c77b0d0df291875e59c09` |
| `journey-teardown-complete.patch` | `6dba4f9145fa01820da747c9a4daeddbed42fdee9b440626788bbafd222c76e7` |
| `packages/app-shell/e2e/sucafina/decisions-support/closure-response.ts` | `fa509e9d7a7da9d0024c9487975f7b26b3b29146` → `e1c78c9311d9af5df81191acc490b9574421ad3d` |
| `packages/app-shell/e2e/sucafina/decisions-support/journey.ts` | `3f548f0afdbb2d0c17c3cf9f0c3d4dd63b25f2b2` → `e5a510068cc16a41b29446524b4c7870c98568c5` |
| `runtime-extracted.json` | `37fb7ebe889ec7c4b80e9b2726dfd5e24b1ab13f5f4ab9dd0603dc5f33dfed33` |
