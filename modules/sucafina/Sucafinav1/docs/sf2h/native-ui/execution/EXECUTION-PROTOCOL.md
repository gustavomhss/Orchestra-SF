# Protocolo de execução nativa — decisões e despacho

**Estado: planejamento; nenhuma execução está autorizada por este documento.** Este protocolo operacional substitui o fatiamento N0–N10 do rascunho, mantendo o plano canônico, os 15 WPs, 74 tasks, 1.610 critérios e a custódia vigente de S0/integração.

## 1. Unidade de trabalho

Há 78 ordens; esse número não pressupõe 78 sessões simultâneas: I00 integração; F01–F04 fundamentos; D01 broker desktop; S01–S05 componentes comuns; A01–A15 bindings finos; U01–U47 interfaces por fluxo; Q01–Q02 provas transversais; R01–R03 revisões finais independentes. Cada ficha fixa entradas, arquivos exclusivos, outputs, aceites, consumidores e condições de parada.

Uma lane de autoria recebe um subtree/allowlist fechado por vez, em branch isolada `sf-native-<lane>` ou a branch já autorizada. Reutilizar lane após handoff evita branch/PR/ambiente novo para cada microtask. Cada output continua tendo commit, pre/postimages e receipt próprios. Nunca resetar branch nem sobrescrever avanço posterior.

**Decisão de design não é fato de lançamento.** Layouts, nomes, props, eventos, fluxos, campos, ações, auth e recuperação devem estar congelados nos contratos/superfícies. SHA corrente, identidade do ator, branch, lease e runners disponíveis são fatos verificados no lançamento, não decisões deixadas ao worker.

## 2. Preflight único e fonte de verdade

I00 reconcilia a autoridade vigente antes da primeira escrita, conservando uma única custódia de stack e o dispatcher já existente. Lê o HEAD de planejamento, o candidato material e as releases/consumer ACKs; nunca infere encerramento por silêncio.

I00 publica um `launch-record` imutável com: commit/tree material; commit de planejamento; ator/branch/lease exatos por ordem; allowlist efetiva; SHA/blob de cada família de fonte consumida; digests de contratos, componentes, superfície e microcopy; atores/runners realmente disponíveis; dispatcher e fila em curso; bloqueios externos já conhecidos. Um launch-record identifica fatos e leases, não modifica critérios.

Os documentos obrigatórios da execução são este protocolo, a ficha da ordem, os locks nela citados, as entradas de superfície atribuídas e os critérios canônicos correspondentes. Não reler treze documentos nem os quinze WPs completos em cada worker. Os axiomas de campanha/WP e os checks da task continuam obrigatórios pelos pointers imutáveis do índice.

## 3. Estados e portas

| Estado do output | Condição | Consequência |
| --- | --- | --- |
| PLANNED_NOT_AUTHORIZED | Contrato documentado, execução ainda não autorizada | Nenhuma escrita de produto |
| READY_FOR_AUTHORING | Autorização, lease, inputs/assinaturas/copy congelados | Autor pode escrever contra esses contratos |
| AUTHORING | Escrita somente na allowlist | Sem alteração de produtores/registries alheios |
| ARTIFACT_READY | Código/spec/documentação completos para o output; receipt e hashes emitidos | Libera slot após handoff explícito; typecheck/prova integrada podem aguardar dependências reais |
| INTEGRATED | I00 consumiu exatamente o output e os produtores requeridos no candidato | Admite typecheck e seleção incremental pelo dispatcher |
| QUALIFIED | Provas exigidas do output válidas no candidato/ambiente identificado | Não equivale ao aceite global ou FINAL |
| CLOSED | Consumer ACK e aceite da autoridade previstos concluídos | Fecha a lease e conserva writer de correções explicitamente designado |

`BLOCKED_CONTRACT`, `BLOCKED_DRIFT`, `BLOCKED_OWNER`, `BLOCKED_SERVICE` e `BLOCKED_VALIDATION` são classificações de um output, não autorização para encerrar toda a missão. O autor conclui outputs independentes restantes. Uma implementação não recebe stubs para “desbloquear build”; entrega-se ARTIFACT_READY com a dependência exata.

**ARTIFACT_READY não afirma typecheck verde.** Código escrito contra assinatura congelada pode esperar implementação compartilhada. Só o candidato com dependências reais pode ser INTEGRATED/QUALIFIED. Não manter autor esperando por produtor; entregue e libere a lane por handoff.

## 4. Três dependências distintas

- `depends_authoring`: contratos de dados, props/events, superfícies e copy que precisam estar FROZEN. Permitem autoria simultânea antes das implementações produtoras.
- `depends_integration`: outputs efetivos que precisam coexistir para compor o consumidor.
- `depends_qualification`: serviços/identidades/releases/fixtures e provas reais necessários ao aceite.

O piloto não bloqueia a autoria das outras áreas. Ele bloqueia o primeiro rollout como apresentação padrão e confirma composição real. P03, M31/MI07, Reports e admissão/Relay/Schedule continuam precondições das provas que deles dependem; não impedem escrever uma tela independente contra contrato congelado.

Integração é por output coerente, não por fim de pacote. Uma ordem pode entregar incrementos explicitamente listados; cada incremento conserva paths, contrato e critério de pronto próprios. Não aceitar “metade desconhecida” de uma ação transacional.

## 5. Despacho e paralelismo agressivo

I00 calcula todos os outputs READY e escolhe até a capacidade de autoria realmente observada. Prioridade: transporte/contexto/harness e outputs do piloto; depois maior número de consumidores desbloqueáveis; empate pelo ID. Contratos congelados permitem dezenas de frentes elegíveis, sem promessa de dezenas de slots.

Uma lane usa um writer por arquivo. O validador compara paths normalizados, exatos e prefixos pais/filhos, incluindo testes, CSS e locales. Papéis lógicos não concedem escrita: a lease efetiva lista ator, ordem, allowlist e fronteira temporal/terminal. Um timeout de coordenação não expira uma lease automaticamente.

O pool de CI é separado do pool de autoria. Ter dez autores não significa dez runners. Há um único dispatcher canônico; workers entregam requests propostos e observações, não disparam suites.

I00 só escreve os registries/entrypoints enumerados e aplica patches compartilhados liberados pelo dono vigente. Os workers entregam fragmentos de registro e patches exatos com pre/postimage. O integrador não redesenha UI, inventa contratos ou reescreve a implementação para fazê-la encaixar.

## 6. Contratos e componentes congelados

`CONTRACTS.md` e `contract-catalog.json` fixam ctx, transport, domain-read, planner, procurement, decisions, portfolio, files, reviews, bi e intelligence. `host-signatures.ts` fixa as assinaturas públicas/privadas de host, contexto, transporte e broker. `COMPONENT-CONTRACTS.md` e `component-signatures.ts` fixam as assinaturas de ui-frame, ui-table, ui-grid, ui-change-review, ui-evidence, ui-collaboration e ui-bi. `component-locks.json` indexa seus produtores/exports. `SURFACE-SPECS.md` e `surface-manifest.json` fixam as 70 superfícies, campos/ações com fontes, rotas, estados, copy e layouts de 320/768/1024/1280/1440px, resize de texto 200% e reflow de 400% (1280px para 320 CSS px).

Um nome de componente acompanhado só por invariantes não é assinatura congelada. Todos os props, callbacks, estados discriminados e propriedade de efeitos devem estar explícitos. Um campo reaproveitado aponta a um tipo/validador real com pin; não copiar uma definição financeira ou de acesso para o frontend.

Não há nova engine, segundo scheduler ou segundo pipeline de geração. Reutilizam-se HTTP JSON existentes, Request original e geração padrão quando o único endpoint metadata global exigir atualização. Essa geração acontece uma vez pelo responsável autorizado após integração do contrato, não por cada leaf.

Desktop é parte do alvo: D01 usa o broker fechado pelo contrato, Session isolada, sender/owner validation e login na mesma partition. `Platform.fetch` ou web-only não substituem autoridade desktop. O renderer nunca escolhe URL/header/cookie arbitrário.

## 7. Piloto pequeno e completo

O piloto usa a fila autorizada e uma PR persistida/submetida pelo produtor real, revisão de etapa/holder/versão/valor e aprovação pela UI no papel admitido. Inclui um segundo ator negado, troca de contexto e perda de resposta com consulta do recibo original. Web e desktop têm provas próprias.

O setup pode criar a PR por portas reais no corpus isolado; não pode fabricar snapshot aprovado ou recibo. A jornada completa de criação, sourcing, PO, imports e anexos continua nas ordens e critérios canônicos e não é fechada pelo piloto.

U10 entrega `queue` antes do overview BI; U13 entrega aprovação PR antes dos demais resumos. Esses incrementos não exigem U21/BI ou importações para provar uma aprovação persistida. O piloto consome F01/F02/D01/F03/F04/S01/S03/A03 e os incrementos U10.queue/U13.pr-approval, com Q01/Q02 pertinentes. Não usar o piloto para declarar M31/MI07 resolvido.

## 8. Qualificação sem repetição

Reutilizar diretamente, no canônico `campaign.json@dbf9547211d9b0fade619790de7c19c0869b7c7d`:

- `/ci_plan/dispatch_policy/supervision`
- `/ci_plan/dispatch_policy/deduplication`
- `/ci_plan/dispatch_policy/incremental_validation`
- `/ci_plan/dispatch_policy/invalidation_matrix`
- `/execution/candidate_delivery`

A chave de deduplicação inclui C/tree, hash do request normalizado, workflow/validator, runtime/config e fixture/seleção. Run em voo ou completo só é adotado com chave idêntica, seleção observada correta, controle omni válido e artefatos íntegros. Cancelled, empty selection, artefato ausente, configuração diferente ou outro C não vira PASS.

Incremental executa o que mudou e consumidores transitivos afetados. Mudança de contrato/auth/estado amplia a seleção pela matriz; impacto desconhecido fica bloqueado ou amplia conservadoramente. Não repetir teste falho com input e precondição inalterados. Falha transitória de infraestrutura precisa evidência antes do retry.

Uma captura pode provar múltiplos critérios apenas com expected/observed específico por ID. Captura compartilhada de componente reduz duplicação visual; cada tela ainda prova binding, campos, ações e estados próprios. A matriz visual evita o produto cartesiano desnecessário, preservando todos os temas e viewports exigidos.

Full suites e revisões finais executam na cadência canônica, no mesmo C final. Evidência documental nova não repete produto; mudança normativa de contrato/fixture/runtime/build é material e recebe candidato novo. Nenhum verde antigo é renomeado para um SHA novo.

## 9. Drift sem recomeçar o projeto

Antes de admitir um output, comparar os blobs das famílias que ele consome e seus contracts digests com o launch-record. Mudança fora de sua closure não exige reler/retestar tudo. Mudança dentro dela produz um delta explícito: paths, contratos/consumidores afetados e ação requerida.

Drift documental puramente evidencial conserva a execução original. Drift de contrato/código/teste exige revisão do dono e invalidação correspondente. I00 publica uma nova revisão de lock e enumera apenas os consumidores atingidos; autor não “acomoda” mudança de semântica por conta própria.

Cada consumer ACK liga source output SHA, pre/postimage, contratos consumidos, material C, estado aplicado/retido e motivo. A fila reaproveita o trabalho terminado compatível; nenhuma branch inteira é importada apenas por ser mais nova.

## 10. Handoff compacto

O receipt de cada output inclui: order/output ID; ator/branch/lease; base/head/tree; arquivos/blobs pre/post; contratos e fonte pinados; exports e registro; superfícies/tasks/aceites atendidos; specs escritas, execução real e NOT_RUN distintos; bloqueio causal e dono; dependências de integração/prova; consumer ACK e transferência explícita de correções.

O autor encerra após entregar o trabalho independente e transferir a lease conforme protocolo. I00 mantém a fila de integração/validação; não ocupa um writer aguardando serviço. Se o mesmo autor voltar para correção, recebe lease nova com HEAD atual.

## 11. Três FINAL e encerramento

R01/R02/R03 são atores novos sem autoria no código examinado; revisam o mesmo C corrigido. Encontrou defeito: publica imediatamente, writer corrige a sua fronteira, reviewer confirma fechamento. Tornar-se autor invalida sua independência naquela revisão.

Uma revisão deste planejamento não substitui FINAL de produto. S0/autoridade final conserva os gates de C/G7 e D/G8. D recebe apenas evidência append-only permitida; sem conteúdo normativo ou alteração de produto para conservar C antigo.

## 12. Checagem desta documentação

`python validate_plan.py` analisa JSON, IDs, propriedades, referências, grafos e cobertura das superfícies. Com `--canonical <campaign.json>`, confere os 1.610 pointers canônicos. Com `--strict`, exige os locks/superfícies completos e nomes resolvidos.

Isso é verificação da integridade do plano, não execução de testes de produto, geração de client, typecheck, guard, CI ou aprovação de implementação.


## 13. Fronteiras finais de composição

F01/F02/S03 formam a unidade atômica `foundation-context-transport`: os três podem ser escritos contra assinaturas congeladas, mas I00 compõe a injeção e os tipos antes do typecheck/qualificação. F03 é o pré-requisito visual. S03 consome tipos F01/F02, mas não seus factories/hooks runtime; I00 injeta createSfDraft no provider. Não criar ciclo runtime ou stub permanente para contornar a composição.

O piloto consome apenas os quatro outputs parciais listados no manifesto e sua closure real. As matrizes completas Q01/Q02 não são dependências do primeiro piloto; seus testes restantes continuam obrigatórios para o C final. Q01/Q02 têm specs exclusivas de piloto, sem repetir a lógica compartilhada de componente.

UI51–UI53 pertencem às páginas U44; S05 publica somente componentes puros. Nenhum componente compartilhado ganha fetch para servir como página. As novas fatias U38–U47 herdam critérios por pointer e escrevem apenas seus leaves, sem multiplicar a campanha nem reimplementar contratos de outro autor.

Rotinas/Schedule/residents possuem seams tipados e estado de disponibilidade congelados. Ausência de binding nativo real preserva o HOLD operacional do produtor. A UI de indisponibilidade pode estar implementada sem constituir aceitação da capacidade.

## 14. Registro incremental de operações

I00 publica metadata completa em `operation-registry.ts` (não no leaf `operations.ts` de A11) e somente os codecs de famílias realmente admitidas no candidato em `index.ts`/`SfNativeOperationBindings`. O mapa é injetado em F02/D01. No piloto, ctx+A03 e seus bindings auth/SDK dedicados bastam; não importar os outros 14 adapters para compilar o transporte. Operação conhecida sem binding devolve `contract-unavailable` antes de rede/dispatch; nunca schema permissivo, stub de sucesso ou simulação. O C final exige todas as operações catalogadas, nos modos corretos, além da disponibilidade real dos produtores. A quantidade e os IDs exatos ficam no manifesto e são confrontados com o catálogo pelo validador documental.
