# Missão30 — implementação C07 nativa / PR30

## Autoridade e escopo

Continuação de `astra-wp09`, PR30, pelo lease `routine-native-browser30`, após ler o handback em `1998acb0dcb59e68d41ee924eca4737bccbd5148`. Esse head foi reconciliado novamente antes da publicação; a atualização usa compare-and-swap sem force. O handback anterior continua histórico: seus 175 testes, 78 diagnósticos e timeout WP06 não são evidência desta implementação.

Missão pinada em `5b00bd553781f437586177247b8a726aafd8ee59`; planejamento `dbf9547211d9b0fade619790de7c19c0869b7c7d`; composição inspecionada `9cc27888581a13b55992cdb5dfbd27e43479ac29`; requisitos nativos `8a776484bb17ac0c83ae2eb56ddcfb2fad73aa35`. Foram lidos AGENTS aplicáveis, COMMON, pack S3 integral por partição de leitura entre os agentes e anexos product-acceptance, resident-runtime e execution-reconciliation. A autorização específica da missão prevalece sobre a atribuição genérica do pack: somente adapter, routine-services, testes e recibos próprios.

O delta não altera Maestro, Relay, Schedule, contratos públicos ou o host compartilhado. O patch completo de montagem é um artefato de handoff para a sessão23, com preimage/postimage exatas. Sua aplicação não foi simulada como integração real.

## Implementação

| Método | Fonte/ação real | Recusa preservada |
|---|---|---|
| resolvePlan | PlanRevision.RecordedV3 lido por GovernanceRecordsV2; revisão mais recente considera v1/v2/v3 | Sem plano atual, finalidade/publicação diferente, fonte/caso/owner/generation divergente |
| resolveRecipe | Mesmo leitor, por documentID publicado, escopo/parameters exatos | Sem revisão correspondente não inventa receita/plano |
| prepare | TaskGovernance real, sob SessionExecution.exclusive; mantém validation, review, apresentação e aprovação humana, autorização, arm e WorkflowBound nativos | Sem chamada Task já persistida e owner autenticado, sem approval, troca de plano/caso/escopo/fontes; parent busy |
| readAdmission | Authorization.Granted, Validation/Context, Review, Approval.Presented/Decided, Dispatch.ReservedV2 e WorkflowBound | Referências inexistentes, hashes/schema/aggregate divergentes, humano/Task/arm não ligados |
| readRun | WorkflowBound e reservation nativos, child Session quando existente | Reserva sozinha não vira execução/resultado |
| start | Exclusão de execução nativa, scope charge, Agent/Session permissions, CapabilityInvocation, materialization do Task realmente registrado, eventos nativos de sucesso/falha | Modelo/permissão/ancestralidade/placement continuam checados pelo Task; busy, old generation, revogação, cancelamento, replay terminal |
| listRunRefs | Projeção das autorizações e reservas reais da Session autorizada | Sem varredura por IDs fornecidos pelo modelo nem índice próprio de runs |
| readExecution | Estado Task + Session filha + Relay currentStep, checkpoint settled e audit | Não traduz texto do modelo/erro em sucesso/cancelled; retorno parcial permanece pendente |
| readArtifact | Projeção imutável do recibo nativo de execução, derivada novamente de terminal+checkpoint+audit | Sem arquivo/corpo arbitrário/model prose usado como atestado |

### Preparação e execução são etapas distintas

`prepare` utiliza o hook real de admissão para reservar e ligar o workflow. Não cria Session filha, prompt, chamada de modelo ou ID de run. A identidade que retorna é a reserva nativa. Isso não comprova que as verificações de modelo e permissões da execução passaram: `start` repete o caminho inteiro do Task registrado, com os gates nativos. Publicar receita ou preparar reserva não executa trabalho.

O owner privado aponta uma Request real e uma Session nativa do Maestro, além da chamada Task já gravada. `sf_maestro` é um perfil de negócio distinto de `AgentV2.defaultID`; a implementação não os renomeia nem usa a Session SF como identidade implícita de Maestro. O contexto UI não ganha uma Session por conversão de string.

`SessionExecution.exclusive` impede disputar o parent com o drain existente. O dispatcher usa o materialization do registro Task atual, as permissões efetivas do Agent e da Session, o orçamento de SessionScope e o frame host-only de CapabilityInvocation igual ao runner. Publica `SessionEvent.Tool.Success/Failed` somente depois do resultado real e relê a chamada na transação nativa. Não cria mensagem assistant, call ID, child ID ou ledger de admissão/run.

Uma reserva existente e a mesma chamada nativa são reutilizadas. Task conserva sua própria identidade de prompt/child e regras de retry. A operação já terminal não é redisparada. Um parent ocupado retorna conflito sem interromper o dono existente. A corrida de cancelamento fica DENTRO da operação exclusiva; abortar apenas o waiter não encerraria a operação nativa. O código não interrompe uma execução sucessora por Session ID.

### Autoridade e proveniência

O adapter revalida a mesma Request e os mesmos objetos de registry, contexto, recursos, owner e geração. Compara installation, host, projeto, Location, principal, policy/access revision, caso ID/incarnation/version, fontes e suas versões, publicação ativa, parâmetros e write paths. O lease de autoridade é efêmero; não contém identidades novas de execução nem substitui os registros Task/Relay.

As revisões nativas retêm `SF_ROUTINE_INPUT` como parâmetro do workflow. A receita publicada deve declarar esse parâmetro, que passa pelas verificações de publicação/versionamento existentes. O schema fechado retém owner, propósito, caso, referências/parâmetros e fontes. O ID da revisão e o digest final NÃO ficam dentro do próprio hash nativo: são derivados após ler a revisão, evitando um hash autorreferente impossível. A metadata não é autorização; o host privado e os eventos nativos continuam obrigatórios.

Dispatch exige a geração/policy/access revision exata do plano. Uma leitura histórica pode ser reautenticada por um host novo, com Request/owner reais, mesmo principal/projeto/Location/Session de autoridade e caso/fontes/publicação atuais. Isso permite retorno factual após reload sem aceitar o antigo contexto ou lease.

As extensões de segurança preservam as implementações nativas: TaskGovernance antes/depois da admissão, antes de cada turno e no settlement; ToolSafety antes/depois da ferramenta, preservando Arsenal/WriteRoots; callback de revalidação Relay sob o lock nativo. Nenhum engine é editado. O retorno SF também é revalidado depois das leituras e do artefato. Uma revogação não desfaz um efeito que já terminou; novos limites e liberação de conteúdo exigem autoridade atual.

### Resultado e limites reais

O artefato `sf-routine-artifact-v1` entregue contém `native-task-relay-receipt-v1`: IDs reais, revisão, autorização, reserva, arm, Session filha, assistant terminal e sequência do ledger auditado. O digest é derivado desse recibo imutável, independentemente na leitura da execução e na leitura do artefato. Texto e structured arbitrário do modelo são excluídos. Isso não transforma um relatório de negócio escrito pelo modelo em fato verificado.

O schema nativo observado não registra um discriminante terminal próprio de cancelamento. Interrupção preserva a falha nativa e recusa saída; o adapter não infere `cancelled` de texto ou ausência. Checkpoint/audit/resultado Task ausentes ou truncados continuam indisponíveis. Modalidades background são recusadas porque não existe neste binding um owner de autoridade que sobreviva à Request; não é criado supervisor paralelo.

## Recursos necessários à composição/AM06

1. **Sessão23:** aplicar/reconciliar a montagem no head compartilhado, após conferir preimage; passar um `SfRoutineNativeOwnerPort` real, cujo registry liga a Request autenticada à Session Maestro e à chamada Task já persistida. O host inspecionado não exporta esse vínculo. O parâmetro privado opcional não fabrica a implementação desse registry.
2. **Plano e publicação reais:** revisão nativa v3 mais recente, receita publicada com `SF_ROUTINE_INPUT`, fontes/caso/parameters/write scope pinados, validation, review, apresentação/aprovação humana, autorização e arm governados. Esses registros são produzidos pelas ferramentas nativas existentes.
3. **Provider/host autorizados:** modelo disponível, permissões e orçamento reais, Task/Relay instalados e execução/consumo após reload. Nenhum teste unitário/integrado substitui AM06.
4. **Conhecimento upstream:** receitas que exigem knowledge permanecem bloqueadas enquanto `routine-installed-publication` não tiver o resolver autenticado Archie/upstream. A implementação inspecionada retorna `SF_ROUTINE_KNOWLEDGE_PORT_UNAVAILABLE`.
5. **Watch:** `memory.prepareWatch` termina em `native-watch-admission-port-unavailable`; a função existente não é binding Schedule. Só cinco descritores de Task podem ser anunciados nesta montagem. O sexto, `sf_watch_prepare`, fica ausente até um port suportado e `watchAvailable` reais. Schedule não foi alterado.
6. **Artefato de negócio adicional/background/cancelamento tipado:** não são inventados. Precisam dos recursos nativos/contratos efetivamente disponíveis quando solicitados; o recibo terminal factual entregue é explicitamente identificado.

## Evidência

Testes somente GitHub Actions pela interface existente, com arquivos próprios nomeados. O recibo terminal registra W/S, seleção, hash de request, runs/jobs e resultados observados. Nenhum teste/typecheck local, suite epic, servidor, instalação local, restart, merge/deploy ou comunicação externa foi executado. Fixtures são explicitamente sintéticas, inclusive quando usam Database/EventV2/SessionStore/TaskGovernance/SessionRunCoordinator reais.

**Implementação não equivale a AM06 comprovado.** O pacote de evidência desta missão não altera automaticamente os 112 estados do handback anterior e não declara GLOBAL_RELEASE.
