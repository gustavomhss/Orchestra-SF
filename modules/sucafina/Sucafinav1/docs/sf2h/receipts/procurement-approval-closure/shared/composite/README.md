# Missão53 — patch compartilhado de composição

Estado: **inerte, não aplicado e não testado**. O patch foi preparado para o sucessor explícito55 de integração47. O ACK55 publicado reconhece `Root55` como único writer de `sf2-stack`, epoch `S0-C-e10-browser55`; a admissão de Procurement53 exige release explícita. A autoridade47 permanece terminal e sua lease não é reaberta.

## Base e integridade

O histórico de construção permanece C19 `5b11f1460fa44426626ea7674ccb8baf0a083e0a` → C20/terminal47 `12b459f6997298f79e3360c4aaeb8ffc0a106a50`. Nessa primeira reconciliação mudou somente a pré-imagem de `decision-controls.ts`; o postimage preserva integralmente a continuidade do Planner histórico e a deduplicação adicionadas por47.

O alvo atual é **C21 `3f35d8ee987cdeaafd3341c2fde13c4125a1f69e`**, tree `644e41cfc5e8b291b4bf61bd16c8dcae41b14d1b`. O compare MCP C20→C21 contém o ACK55 e a integração Agenda39. Os nove caminhos foram relidos no novo commit: os sete pré-blobs existentes são idênticos e os dois creates continuam ausentes. Nenhum postimage nem byte do patch mudou; não se infere equivalência ou PASS de runtime entre candidatos. A prova está em `reconciliation/c21-target.json`, e o ACK55 integral em `reconciliation/ACK55.json`.

`MANIFEST.json` contém paths, pré e pós-blobs Git, SHA-256, arquivos completos e condições de aplicação. `shared-composite.patch` é o diff unificado. `pre/` e `post/` contêm os arquivos completos; `reconciliation/` conserva a mudança observada do alvo. `contracts.json` contém entrada, saída, matriz dos efeitos, provas exigidas e fronteira semântica aberta.

## Implementação

O adaptador instala o `createCompositeDecisionPlanner` já existente e resolve a requisição por `createProcurementReadonlySourceResolver`. Ele mantém o cálculo do Planner e acrescenta a operação externa explicitamente não resolvida. Exige o caso selecionado e atual, seus participantes, fonte anexada exata, valor digitado, moeda, horizonte, versão da fonte, autoridade e fences antes e depois. Não prepara nem executa comando financeiro. A capability mista é transitória; somente `decision-promote` humano já existente publica uma alternativa C08.

A UI mantém o formulário Planner e adiciona, quando existe fonte Procurement anexada, `Procurement request` e `Proposed estimated amount`. O payload conserva exatamente a forma exigida pelo helper52: base Planner, `replace` com target Procurement, valor explícito, moeda/horizonte do caso e `assumptions: []`. A inspeção usa fontes já emitidas, sem acionar a emissão de scopes da descoberta de novas fontes. Retries reutilizam a intenção congelada existente.

O guard atual e o guard histórico reautorizam os seletores externos por C17 antes de conferir os componentes do Planner. O registro de regra numérica admite a evidência mista somente quando ela corresponde à operação exata de uma alternativa salva, condicionada e ainda atual. Os fences de política, contexto, intenção e snapshot existentes permanecem obrigatórios.

## Verificação entregue

O teste complementar novo contém quatro casos: cálculo real Planner1200/2400 e diferença1200 com operação externa; preview sem persistência e guard de leitura; negativas de holder/moeda/duplicação/fonte stale; controles explícitos e parse do inicializador. Usa SQLite e os produtores reais com uma fronteira sintética de fontes/caso documentada. **Nenhum desses testes foi executado.** Não houve testes locais, typecheck local, execução de produto, browser, CI ou writes remotos por este agente.

Os arquivos dos consumidores52 e51 permanecem intocados. O nominal52 continua sendo a referência original; o teste novo não o substitui, não altera seus helpers, timeouts ou assertions e não prova a jornada financeira completa. O integrador deverá deduplicar uma seleção cirúrgica de Actions no commit composto final; não usar epic ou relaxar assertions.

## Requisito restante

O original52 exige preparar a substituição140 ainda não gravada, chegar a pending140 sem uma ação explícita adicional, aprovar e depois aplicar outro `Requests/save` preservando o expectedVersion anterior. O ciclo atual permite salvar no draft, submeter exatamente esse valor e aprovar seu snapshot congelado. Ele não concede o efeito pós-aprovação exigido. O patch deixa esse requisito **OPEN_S0**.

O original51 também prepara replace150 antes da captura do original usada pela jornada Memory. Este patch não cria um comando financeiro nem transforma o preview em captura/prova histórica. A cauda Memory permanece aberta enquanto sua pré-condição original falhar. As provas positivas de editar/submeter/aprovar continuam representando somente esses efeitos.

## Aplicação pelo proprietário

Conferir HEAD e autoridade atuais; exigir os sete pré-blobs exatos e ausência dos dois arquivos novos. Se algum tiver mudado, rebase a partir dos bytes MCP atuais, preservando alterações do integrador. Aplicar somente depois dessa reconciliação e usar os mecanismos de CAS acordados. Este pacote não deve substituir o composite pelo standalone37 nem alterar políticas, estágios, alçadas, papéis ou comandos financeiros.

## Correção da revisão — identidade histórica C17

A revisão `policy_ci_audit` identificou e a entrega corrigiu uma restrição excessiva: a encarnação do **scope** atual não precisa ser igual à encarnação do scope original na resolução histórica Procurement. O produtor C17 real usa `issueForActor`, que pode renovar esse scope, e prova a continuidade do registro físico com `archived.physicalIncarnation`. A comparação foi removida apenas do bloco comum; a resolução fresh continua exigindo igualdade do digest integral, e historical mantém o resolver C17 real, as diferenças, a projeção/versão original e as duas observações de egress.

A prova positiva complementar dessa renovação permanece **NOT_RUN / HOLD**. Foi lida a fixture real `wp10/memory-integrity/fixture.ts` (`352efd3fa2aefefa7fbdf88e6ef2d0886a669737`), usada por `memory-original-reauthorization/installed-original.test.ts`; ela exige sucesso de `prepareDomainCommands` antes da captura privada C12. Reutilizá-la atravessaria o mesmo bloqueio financeiro do original51. Não foi criado mock de autorização histórica, concessão artificial de archive ou relaxamento de assertion para ocultar essa precondição.
