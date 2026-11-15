# Consumidores52 e51 — leitura sem edição

## Pins e separação de evidências

- Consumer51: `326f4eaf6aa4e2a65b53df69e0afee5e7775e970`, handoff terminal.
- Consumer51 relido: `51de99e5c663dc31ce1bcf4b1f694399a0cf33c9`, follow-up somente de recibos; o spec continua igual e o HANDOFF `5db58f57cb095d5694819b509d288c4878e6dd4e` mantém ENDED.
- Consumer52 inicial: `19a69145e2b4e938c1abf50985488fdb714a4e56`.
- Consumer52 relido durante53: `1b6a68647000422f7922d396a3f40bda471eff8a`. Esse pin acrescenta diagnóstico/transporte; não representa aceite funcional.
- Stack inicial C19: `5b11f1460fa44426626ea7674ccb8baf0a083e0a`.
- Stack intermediário: terminal47 `12b459f6997298f79e3360c4aaeb8ffc0a106a50`, candidato material C20 `7f3f4f0066269f7642c82b5694f21c9c9741e9d5`.
- Stack reconciliado na entrega: C21 `3f35d8ee987cdeaafd3341c2fde13c4125a1f69e`, tree `644e41cfc5e8b291b4bf61bd16c8dcae41b14d1b`; preserva as pré-imagens dos patches53.
-47 encerrou explicitamente a lease. A missão55 assumiu por ACK `a6caa04d8c525339697d3e40f7d61ae5830d6e6d`, epoch `S0-C-e10-browser55`, no commit `aab587293e20b15884bbd34b21f351d8dfc829bd`. O controle `c1df70b2fedd2183d243a523fbfef9c7c6ddff35` preserva o pacote53 e autoriza55 como sucessor. Os patches são encaminhados a47 com intake pelo sucessor55 sob reconciliação atual;53 não escreve no stack.

Nenhum arquivo de52/51 foi editado. Nenhuma jornada bloqueada foi repetida pela53.

Atualização final: o target avançou de C21 para C23 `25ed395829f9ec5f06a80c70467c23b25376f853`; o compare completo não altera nenhum dos caminhos propostos53. A autoridade55 permanece e o pacote53 não mudou. Consulte `FINAL-RECONCILIATION.json`. Os manifests mantêm C21 como base de materialização e registram C23 como target novamente conferido.

## Decisions52

Arquivos reais:

| Arquivo | Blob observado |
| --- | --- |
| `packages/app-shell/e2e/sucafina/decisions.spec.ts` inicial | `2d9c867af87fa0a26b182365b1780232b49bcaf9` |
| Mesmo spec no pin52 relido | `b6f63bfa1b8eacb5bf37a5c5b0d508fd658d70cf` |
| `packages/app-shell/e2e/sucafina/decisions-support/procurement-closure.ts` | `5784a995ba25d042101fe2eed63ce96957b711b1` |
| `.../decisions-support/procurement-source.ts` | `7a7553b89af8f90592603f7d454ba164cbb81afd` |
| `.../decisions-support/apply-recovery.ts` | `cb70480c28e9382629d289c1c954e88379e173d3` |

A mudança observada no spec52 agrupa o clique Create decision e a espera da interrupção de transporte no mesmo Promise.all. O quinto nominal financeiro, seus oráculos e seus helpers permanecem iguais.52 também mantém propostas de transporte/installation próprias;53 não as aplica nem as substitui.

### Compatibilidade independente entregue como patch

O helper financeiro usa o formulário Planner `form[data-decision-alternatives]` com os campos “Procurement request” e “Proposed estimated amount”. Envia base Planner, operação replace da PR e assumptions vazias. Espera subtotal Planner2400, diferença1200, totalnull e condição external-operation.

A composição anterior37 oferecia um formulário standalone de Procurement e subtotal140. Mudar o seletor do teste para esse formulário substituiria a prova original. O patch `shared/composite/` mantém a forma mista e o subtotal do Planner, acrescenta o alvo Procurement como condição externa pendente e liga os guards/provenance/controles existentes. Preview não emite scopes, não grava PR nem publica resultado; promoção humana continua responsável pelo C08.

São nove caminhos propostos, incluindo um arquivo novo com quatro testes complementares. Estão inertes, com pre/postimages completos. O preimage de `decision-controls.ts` foi reconciliado com C20 e preserva a continuidade Planner do CurrentChoice46. Os testes complementares estão NOT_RUN até aplicação autorizada; os20PASS da53 não são prova desse patch.

### Conflito financeiro que continua aberto

O fluxo retém PR100/v1 durante a escolha140, exige uma preparação e depois encontra pending140 sem save/submit humanos entre essas ações. Em seguida aprova140 e espera um Apply financeiro adicional com a identidade/CAS preparado, receipt e recuperação após perda de resposta.

A preparação53 retorna um plano readonly de edição. Para usá-lo, o fluxo deve expor salvar140, submeter140 e aprovar140 como ações distintas, com novas reviews e fontes. Isso é uma jornada adicional suportada, não substituição da prova original52. O efeito pós-aprovação permanece sem contrato canônico.

### Resultado realmente observado em52

O recibo52 `nominal-01.json`, blob `08c28b0819b2cee9698cce06fe80d099369ebebe`, registra run43654219902 em C18:5executados,0PASS/5FAIL/0SKIP. O financeiro falhou antes do produtor, em `procurement-source.ts:7`: era esperado um formulário Requests/create e havia zero, com `procurement-queue-unavailable` (14,623s). Portanto as incompatibilidades de composição e ordenação descritas acima são diagnóstico do código real; não são falsamente atribuídas à causa observada desse run.

Run52 `43656679164`, snapshot `70dfa38e6ae258e1b9a3001db5f6d24b1a7cdaf5`, estava em progresso no corte da leitura. Não se atribui resultado posterior não observado. A consulta e o registro não constituem dispatch pela53.

## Memory51 / MI07

Arquivo: `modules/sucafina/Sucafinav1/test/product/wp10/analysis-composition/historical-memory.test.ts`, blob `ee5c725ae78e0eba5c12600da80eb51b7173c2ed`.

O consumidor cria PR100 draft e escolha financeira150USD, persiste o C08 e chama o `activeBusiness.procurementDecisions.prepareDomainCommands` real sob admissão humana. Exige `status:ok` e um comando antes da captura histórica original. Mais tarde aplica um Requests/save150 explícito.

A captura privada de `decision-host` só ocorre depois da preparação C12 bem-sucedida. Com a recusa `financial-approval-command-unavailable`, o teste não alcança a captura original nem os cenários de memória/histórico/revogações da cauda. O run43654082252 terminou0PASS/1FAIL nessa fronteira em cerca de825ms; esse resultado não é um timeout de Atlas.

A53 entrega um bridge para extrair o150 da choice como plano de edição de draft e preservar a choice original. Não altera o consumer para aceitar menos comandos, não chama API privada de captura e não inventa uma fonte histórica. Tornar a captura independente publicamente ou fornecer um novo efeito aprovado exige contrato do owner; não é uma correção silenciosa de Memory.

## Encaminhamento preciso

| Owner | Entrada entregue | Saída esperada |
| --- | --- | --- |
| Integrador47 → sucessor55 | Owned source53 + dois patches inertes e manifests reconciliados C21 | Aplicação seletiva, contexto UI real; encaminhar candidato composto ao owner45 para checks e aos qualificadores autorizados para os testes |
|52 | Contrato do ciclo separado e patch da composição mista | Consumir somente sob autoridade própria; preservar os cinco positivos originais |
|51 | Causa antes da captura, bridge explícito e limite C12 | Reexecutar MI07 somente depois de contrato/produtor compatível, preservando toda a cauda |
|S0/WP00 | `S0-PROPOSAL.md` | Decisão explícita sobre aprovação da substituição futura e critérios correspondentes |
|45 | W/S/run/jobs/artifact exatos | Qualificação do candidato integrado, sem transferir verdes de origem |

M31, MI07 e os gates globais continuam OPEN. O ciclo53 provado não é receipt C12 e não é uma prova de outro efeito pós-aprovação.
