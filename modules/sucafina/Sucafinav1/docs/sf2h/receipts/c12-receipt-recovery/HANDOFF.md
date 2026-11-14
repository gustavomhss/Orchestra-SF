# C12 — handoff terminal da sessão 19

## Resultado e limite de aceite

**I-OPS-02/C12 implementado e demonstrado funcionalmente.** A UI recupera o recibo original após commit real, perda de resposta, edição concorrente e reconstrução da composição, com nova admissão e sem duplicar efeito. OPS-REV-02 permanece preservado.

**CLI typecheck e guards aprovados. Sucafina typecheck permanece bloqueado pelo único TS2741 herdado de WP14.** O workflow geral continua `failure`; não se declara que todos os gates estão verdes.

A entrega permanece na branch `procurement-apply`, PR60, base `astra-operations`. A composição em `sf2-stack` pertence à sessão14. Não houve merge, reset, nova PR, mudança de base, edição em Finance/CLI/Memory, nova operação MCP ou mudança de Protocol/Server público.

## Autoridade e proveniência

Head inicial conferido: `8e23e592602fb9f2fae9ce8f824322a073073e23`. O handoff terminal anterior foi reconciliado com a nova missão explícita, o head e a PR; não se inferiu autoridade apenas de silêncio. Cada avanço usou GitHub MCP, CAS/expected-head e `force: false`.

Fontes lidas: missão `c12-receipt-recovery.json` em `a32285b2683b5000dafe93df99289547c7f410fb`; COMMON paralelo em `c708ec0609dbfc95b259707d8c38481617f74f11`; AGENTS; execution/COMMON, pack S4-A completo e anexos obrigatórios no planejamento `dbf9547211d9b0fade619790de7c19c0869b7c7d`; protocolo CI em `a3d29d011ba3607a57914701300f09117a3e2de9`. O pack e os anexos estavam em `docs/sf2h-plan/`.

Consumidos o handoff Operations e os dois patches NOT_APPLIED em `d48065d391e1557d43b63525bdc7f55b168d5206`, com comparação de preimages. O run histórico `43624678702` continua sendo reprodução do impasse 409→409→409, não fechamento positivo. A prova positiva pertence aos runs identificados abaixo.

## Implementação efetiva

| Caminho de produto | Responsabilidade adicionada |
| --- | --- |
| `product/decisions/apply.ts` | Modo privado recover, saída sem recibo antes de review/dispatch, reconciliação com CAS da versão atual, confirmação autoritativa final do recibo, metadados/proof e unicidade. |
| `product/procurement/decision-host.ts` | Intenção original durável no C08, recuperação canônica sob admissão atual, preservação da identidade original e bloqueio de tentativas indeterminadas. |
| `product/procurement/decision-http.ts` | POST privado `/procurement?sf=decision-recover`, parser fechado para pedido original ou seletor canônico, autoridade humana existente. |
| `product/ui/decision-apply.ts` | Ação explícita de recuperação Procurement; pedido original na página incerta ou seleção canônica em nova sessão, sem dependência de sessionStorage/localStorage. |

Não foi necessário alterar `interface/http.ts` nem `contracts/host-context.ts`. Os testes novos e recibos ficaram exclusivamente nos dois namespaces C12 autorizados. Fixtures e testes de outras sessões não foram editados.

A primeira aplicação valida review/digest e CAS, reserva a identidade original em uma transação `cases` e só então pode alcançar o domínio. O domínio continua responsável pelo commit atômico de efeito/recibo. O registro `sf-c12-application-intent-v1` conserva instalação/projeto, principal, pedido e proof originais, commandId, digest normalizado da mudança, digest da escolha e encarnação física. Ele é o valor de uma transação C08; não é autorização permanente.

Uma recuperação recebe autorização atual e resolve essa intenção canônica. Principal, caso, alvo, encarnações, digest, payload e identidade devem continuar compatíveis. Sem recibo original, o host e o executor encerram antes de review, confirmação e dispatch. Uma intenção já reservada sem recibo também bloqueia o Apply comum, com estado indeterminado, sem criar efeito novo.

O Apply normal mantém sua proteção de versão. No cenário histórico, seu retry continua 409. A rota de recuperação pode localizar o recibo de uma versão anterior e reconciliá-lo sobre o caso atual; uma edição posterior à captura invalida o CAS, em vez de ser sobrescrita. A última leitura reautoriza e retém os bytes do recibo antes de qualquer resposta de sucesso.

## Prova positiva observada

No run `43636531401`, o navegador executou renderer e script de produção, POSTs pela aplicação HTTP real, C08 e SQLite. O request de Apply realmente alterou 100→150, persistiu um único recibo e uma única entrada `Saved` por Alice. A edição concorrente mudou o objetivo do caso sem alterar sua escolha; a resposta concluída desse request foi descartada no transporte.

O retry de Apply reutilizou o corpo e a chave originais e retornou 409. Após reload, fechamento da composição, reconstrução dos serviços/autoridade, reabertura do mesmo SQLite e novo browser context com storages vazios, a nova admissão canônica recuperou **200**, com o mesmo recibo `0ec7cd8a-4e04-4ddf-bcbd-fae89bdbc17a`. Uma segunda recuperação também retornou 200 e não modificou o estado.

O caso passou **3→4** pela edição legítima e **4→5** pela vinculação do recibo. Valor, versão do domínio, autoria, auditoria, escolha e objetivo concorrentes foram preservados. O domínio teve exatamente um efeito. O marcador `SF_C12_RECOVERY_POSITIVE` foi emitido depois dessas asserções e o teste/run passaram.

A resposta perdida do primeiro cenário era internamente 409 porque a edição impediu sua reconciliação depois do commit. Um segundo teste independente descartou uma resposta **200 real**, já com o caso reconciliado, e recuperou o mesmo recibo `644f048d-bae2-4cf4-a473-b30e0de962e7` com 200, sem qualquer mutação durável adicional.

## Negativos e concorrência

| Cenário | Resultado comprovado |
| --- | --- |
| Sem intenção/recibo, mesmo após review válido | Recuperações canônica e exata 503; snapshot durável inalterado. Apply normal posterior consegue aplicar uma vez. |
| Intenção real commitada, revogação antes do efeito | Um registro de intenção, zero efeitos/recibos. Após restaurar acesso, recuperação 503 e Apply comum 503 indeterminado, sem redispatch. |
| Digest, payload, principal, caso, escolha/mudança, alvo, encarnação e chave alterados | Recusas 400/403/409 conforme a fronteira; nenhum recibo divulgado ou efeito novo. Restaurar os bytes originais permite recuperar o recibo verdadeiro. |
| Revogação após lookup e dentro da última leitura C08 | Recusas; última leitura 503 `receipt-authority-changed`, sem ID exposto nem alteração durável. Acesso explicitamente restaurado permite 200. |
| Alvo físico excluído e recriado | 403; a encarnação nova não herda o recibo antigo. |
| Caso parcialmente aplicado, Planner pendente real | Recuperação estrangeira 409; Procurement 200 com seu recibo original; estado parcial, valores e Planner pendente preservados. |
| Segunda edição durante recuperação | Primeiro recovery 409 sem apagar a edição; próximo recovery 200 com o mesmo recibo. Controle em `normal-retry.test.ts`, aprovado individualmente no run inicial. |
| OPS-REV-02 | Sete testes de intenção/no-op/applied e três regressões WP04 aprovados individualmente no run inicial; todas as suas entradas ficaram inalteradas. |

## Identidades e execuções

| Papel | Commit | Tree |
| --- | --- | --- |
| W1 — implementação e primeira seleção | `3f333173780756a42b90b5e1c6dd99de2c5fe40f` | `13838599e3ef6c54f1d4831b0c6f27c888cacf9e` |
| S1 — teste inicial | `d1f40b84d99a69507022e3d1d3422bb28a92d880` | `cb94ba6285dee54cf881025855e8bc2ed1ad7d98` |
| W2 — suporte de testes corrigido, produto igual a W1 | `0b483fbf2040e0551f817ea6211d54c7cb2e2d14` | `536b11690bd71a90023a78825d114730352a024c` |
| S2 — revalidação afetada | `f4a1e6e2743188276f42dd68e14b7c06a23ad55c` | `519288ec0078ff66151d3304c47ea069f0bfc04f` |
| S_check1 — checks sobre W2 | `03c4ef81bb844468149c5b7a74e3a8bc3944369a` | `c116936611f6a2549c9f65e73159cf093f39a8c4` |
| W3 — somente recibos e remoção do log bruto | `0391ef0dfba2186c0c4fedcf8f36c4a5006080ca` | `fbae28c3d865b402fe239250e958086d02c979e3` |
| S_check2 — recheck documental sobre W3 | `0f209755f9d70149b48501f676a8ec5315c6188c` | `571ef729401e368d0c4bdd3b868cf191c32662af` |

Cada snapshot S é filho direto de seu W; só acrescenta o request canônico correspondente. Comparações GitHub verificaram a igualdade dos demais blobs. Checks fazem checkout explícito de W. Os recibos JSON registram seleção, serialização, request hash, workflow blob, jobs, resultados, Omni, artefatos e limites.

| Execução | Resultado verdadeiro |
| --- | --- |
| [Testes 43635717762](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43635717762), job `132571953924` | **FAIL agregado: 16 pass / 3 fail, 373 expectativas, 19 testes em 7 arquivos, 183,36 s.** Falharam admissão da fixture Planner e duas leituras tardias de corpo após reload. |
| [Testes 43636531401](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43636531401), job `132574441676` | **PASS: 7/7, 225 expectativas, 2 arquivos, 125,46 s.** Revalida HTTP e UI corrigidos, incluindo todos os três casos anteriormente falhos. |
| [Checks 43636913954](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43636913954), job `132575624294` | **FAIL:** Sucafina TS2741 herdado; CLI PASS; guards 1 gate próprio `agent-scratch` por raw log, 11 avisos herdados, 0 erros. |
| [Checks 43637454132](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43637454132), job `132577282295` | **FAIL agregado somente pelo TS2741 herdado. CLI PASS; guards PASS: 78 regras, 859 paths acumulados, 0 gates, 11 avisos herdados, 0 erros.** |

Há **19 cenários distintos aprovados por evidência combinada**, não um run único de 19 testes verde. Doze passes individuais do primeiro run são reutilizados por identidade: dois controles C12 e dez regressões OPS/WP04. W1→W2 só alterou o helper parcial e a captura de resposta dos testes UI, além de documentos. Nenhuma entrada desses doze testes mudou. W2→W3 é apenas documentação.

Foram dois runs de testes e dois de checks, sequenciais nesta missão, após dedupe. O segundo check foi necessário para resolver o gate documental usando o workflow existente sem alteração; seu modo restrito não admite o prefixo C12. Não houve teste local, epic/full suite, restart do Orchestra ou execução de modelo. Os dois runs de testes têm zero artefatos e logs hospedados; Omni passou nos dois, mas isso não reclassifica o primeiro run falho.

## Gate documental resolvido e bloqueio externo

O log bruto próprio foi removido da árvore conforme `agent-scratch`, sem rename, ignore ou bypass. O checkpoint histórico e seus hashes permanecem no Git; os recibos estruturados conservam os resultados e eventos, e os jobs permanecem vinculados. O primeiro check continua registrado como FAIL.

A última execução confirmou somente o diagnóstico herdado de WP14; nenhum diagnóstico C12 novo foi emitido. O artefato final tem 5 arquivos, 1.579 bytes e SHA256 `b5686d21bc50a6a0557a7b07d0d45dcddb62f089ea588c397b03d23b393ce8b0`; os detalhes e o link estão em [attempt-03/CHECKS.json](attempt-03/CHECKS.json).

O caller herdado é `test/product/wp14/source-access-atlas.test.ts(167,41)`, blob `fbe627ffde443ff7e2d3b1204bbcf67523404f41`: falta `procurementEvidenceWrites`. Owner: **astra-compose / owner WP14**. A proposta já existente [OPS-CONSUMER-02.patch](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP06/operations-20261114/OPS-CONSUMER-02.patch), blob `2ab9a6b6f18709d5bad95f58247c70ba286a00aa`, propõe postimage `d7d2a69837560f42438d470b83724c1a61939a73`. Esse owner deve reconciliar seu head e validar o consumidor. A sessão19 não aplicou nem duplicou a correção externa.

## Integração, limitações e próxima ação

A orientação completa, com os quatro preimages e o delta compatível com Finance, está em [attempt-01/INTEGRATION.md](attempt-01/INTEGRATION.md). Finance foi observado em `9a2ab893be9f2af2078f67ca867c13892452752e`, executor blob `f8404c18abc040c49cf111eb4561ce4c2873a4c6`. A sessão14 deve preservar seu `application-attempt`, reservas, clones, retenção final e reconciliação atual, e portar somente os deltas C12 necessários; não substituir o arquivo inteiro pelo executor antigo da PR60. A composição requer prova própria em seu SHA.

A prova de UI usa shell GET mínimo com projeção autorizada, renderer/script reais e POSTs reais. Não qualifica toda a navegação Workbench. A reabertura de serviços/C08/SQLite ocorre no mesmo processo Bun, com novo browser context e nova admissão; não é restart do processo Orchestra. O negativo parcial usa Planner realmente preparado e pendente, com review explicitamente não confirmado; não fecha o AM04 integral “Planner aplicado, Procurement recusado”.

Recibos anteriores ao registro canônico continuam precisando da prova original para recuperação exata. Sem o registro e sem aquela prova, a recuperação canônica retorna indisponibilidade; nenhum dado histórico é inventado.

Este handoff e o recibo final de checks são um descendente somente documental de W3. O SHA de entrega é identificado na descrição da PR60; não se atribui a ele execução de teste/guard que ocorreu em W1/W2/W3. A sessão19 entrega o escopo para revisão. Próximas ações pertencem à sessão14 para composição e ao owner WP14 para o caller herdado.

O escopo da campanha permanece 15 WPs / 74 tarefas / 17 contratos / 1.610 critérios. Não há qualificação global C/D, AM01–AM06, sessão nativa ou GLOBAL_RELEASE nesta entrega.
