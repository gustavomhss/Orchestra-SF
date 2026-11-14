# C12 — orientação de composição para a sessão14

Status: orientação estática de integração; não é prova de execução do bundle composto.

## Fontes e preimages

A implementação efetiva está em `procurement-apply`, PR60, W `3f333173780756a42b90b5e1c6dd99de2c5fe40f`, pai `8e23e592602fb9f2fae9ce8f824322a073073e23`. Não houve merge, reset ou alteração da branch Finance.

| Arquivo | Preimage da PR60 | Blob implementado em W |
| --- | --- | --- |
| `product/decisions/apply.ts` | `4bdd12ac162d61465557363953e25dfd99fad5e8` | `2776a112cd24c1cb3bd4fe2791f7b232fb68286d` |
| `product/procurement/decision-host.ts` | `23d9291b3dcedda36edc4aa4f38856024e3c58f4` | `14e41977752f48fc0f204dc5e5893521a5bd1d30` |
| `product/procurement/decision-http.ts` | `e169d335f091c446bb380ee73f450083f917946f` | `fa83ce380647f02d8942f01ffbc1981cf1b2494d` |
| `product/ui/decision-apply.ts` | `2e6c081ad2a5282654707f7fc7278183e7dfb20d` | `a182c632c1714e3c48e6be07142adc7ed87d8f13` |

O executor Finance observado em `9a2ab893be9f2af2078f67ca867c13892452752e` tem blob `f8404c18abc040c49cf111eb4561ce4c2873a4c6`. Ele já contém `application-attempt.ts`, reservas e reconciliação mais recentes. Esse helper não existe no preimage da PR60; não foi transplantado nem criado fora dos write_paths.

Os dois patches Operations foram consumidos em `d48065d391e1557d43b63525bdc7f55b168d5206`: patch geral blob `3aba750c7dd1f48e91ebc507eab75c5d8c61a411` e variante de executor atual blob `d6f9d45a2e05996e78b8c636594c34caffe7727c`. A aplicação na PR60 foi feita sobre seus preimages reais. A sessão14 deve conferir novamente o head que possuir antes de compor.

## Delta a transportar sobre o executor Finance

Preservar o executor Finance atual e transportar estes pontos da implementação C12:

1. O parâmetro privado `mode: "apply" | "recover" = "apply"` na função retornada.
2. Logo após o lookup de recibo retornar `ok`, encerrar `recover` sem recibo `found` com `unavailable / original-receipt-unavailable`. A saída precede review, reservas do executor e dispatch.
3. A unicidade no `retainReceipt`: exatamente uma mudança selecionada carrega o ID, exatamente uma entrada de `case.receipts` possui esse ID, e seus bytes são iguais ao recibo autoritativo.
4. A validação dos metadados do proof transaction em `receiptSnapshotMatches`: namespace, scopeDigest, principal, alvo, encarnação do alvo e do estado, binding de review e bytes do recibo.

Preservar o import/helper `application-attempt`, a reserva `createdHere`, a leitura `latest`, os clones, as releituras autoritativas, todas as chamadas de retenção final e a reconciliação Finance baseada em `fresh`. Não substituir esse arquivo pelo executor inteiro da PR60. A condição inicial de versão e o bloco antigo de reconciliação de W não devem sobrescrever os equivalentes Finance.

O host Procurement continua recusando retry normal de uma versão histórica ainda sem recibo ligado ao caso. Só a rota privada `decision-recover` usa o modo de recuperação. A igualdade de versão no caminho que pode produzir efeito continua obrigatória.

## Duas reservas com funções distintas

O host C12 grava `sf:c12:application:*` durante `confirmApplication`: correlação canônica completa da primeira intenção, incluindo pedido original, digest de review, commandId original, digest da mudança e da escolha, principal, instalação/projeto e encarnação física. Esse registro é o resultado durável de uma transação `cases`, não uma nova preferência, operação MCP ou contrato público.

O executor Finance conserva sua reserva `decision-application-attempt:*`, que impede redispatch indeterminado em todos os seus consumidores. As chaves são distintas. A gravação C12 ocorre antes da releitura `latest`; a reserva Finance deve usar esse CAS atualizado. Nenhuma das reservas incrementa `case.version`. Não unificar as chaves, remover registros antigos ou reconstruir a prova de review a partir de um hash unidirecional.

Sem recibo, uma intenção já reservada permanece indeterminada e não autoriza nova aplicação. A recuperação devolve indisponibilidade. Uma nova admissão autoriza a consulta atual; não reautoriza nem substitui a aplicação original.

## UI, contratos e limites de compatibilidade

A UI usa o renderer/script de produção e um botão explícito de recuperação apenas para Procurement. Na página com intenção incerta pode enviar o pedido original; após reload ou em nova sessão envia a seleção canônica e recebe nova admissão. Não depende de sessionStorage/localStorage. O destino privado permanece o mount `/procurement?sf=decision-recover`.

O parser aceita exclusivamente a forma original com reviewDigest ou a forma canônica com purpose=recover. Campos misturados ou adicionais são recusados. Nenhuma operação MCP, Protocol/Server público, CLI, Memory ou fonte Finance foi alterada por esta missão. Os 17 contratos da campanha permanecem preservados.

Recibos anteriores à implantação do registro canônico não podem ser recuperados sem cache quando também se perdeu a prova original. A recuperação exata ainda pode consultar o recibo com aquela prova; a forma canônica sem registro retorna `original-intent-unavailable`. Não fabricar correlação nem recibo.

## Validação exigida após composição

O CI de W atribui resultados ao executor de W. Não qualifica o executor Finance combinado. Após portar os deltas, a sessão14 deve revalidar os cenários C12 afetados e a proteção de tentativas indeterminadas/recibos de Finance em seu próprio SHA e árvore, mantendo os resultados anteriores como evidência histórica. OPS-REV-02 e seus testes de intenção, no-op e applied permanecem preservados.

A integração em `sf2-stack`, a resolução de conflitos com UI de outras sessões e os gates integrados continuam pertencendo à sessão14. Não há alegação de AM01–AM06, sessão nativa, GLOBAL_RELEASE ou aceite global neste documento.

