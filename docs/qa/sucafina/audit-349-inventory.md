# Inventário do #349 contra dev

Comparação em leitura entre a [base histórica 52d2c24f4f](https://github.com/gustavomhss/Orchestra-SF/commit/52d2c24f4f8cb776889b97894131df6ada43ce98), o [head d51c2d2f2a](https://github.com/gustavomhss/Orchestra-SF/commit/d51c2d2f2a1dfe28059904a07e37db253aea1547) do [#349](https://github.com/gustavomhss/Orchestra-SF/pull/349) e [dev abb7f0d110](https://github.com/gustavomhss/Orchestra-SF/commit/abb7f0d110f8afc69541f5331a396c2e1ddc9f4d). O delta histórico tem 160 caminhos, 4.720 adições e 725 remoções. O apêndice registra 1 blob idêntico ao #349, 61 ainda idênticos à base histórica, 55 divergentes e 43 caminhos ausentes em dev. Os números descrevem arquivos. A matriz abaixo separa jornadas, invariantes e fixtures por evidência de comportamento.

## Saldo por comportamento e destino

| Comportamento | Evidência no dev fixado | Destino proposto |
| --- | --- | --- |
| Seletor de instalação, shell Web e projeções nativas | #566, #570, #572 e #573 compõem descoberta, contexto e shell. `apps/web/src/entry.tsx` usa a instalação selecionada. #581 monta a entrada Web autenticada por Team. | **Absorvido no fluxo nativo.** Usar essa composição como base para qualquer fixture residual. |
| Files, retomada de importação, arquivo assinado e catálogo | #575 e #579 estão no dev. `packages/client/src/sucafina/transport.ts:375–500` preserva ownership, abort, recusa tipada e decodificação de bytes. O #579 exercitou os cenários instalados de Imports e Documents. | **Jornadas absorvidas.** Validar separadamente os limites de saída e contratos abaixo. |
| Reports C05, anexos Office e navegação | #563 está no dev. `src/screen-shell.ts:6,26` monta `shellPreviewScript`. O fluxo de entrega, replay e revogação está na composição C05 do #563. | **Jornada absorvida.** Excluir o console substituto e os probes de performance antigos dessa integração. |
| CurrentChoice C17, ancestry, SQLite e Team | #562, #582 e #585 estão no dev. `apps/cli/src/sucafina-product/team-current-choice.ts:35,94–95` registra as operações e verifica ações. A factory Microsoft usa a composição Team. | **Jornada absorvida.** Preservar os contratos de C17 atuais. A retomada de Apply legado é tratada abaixo. |
| Grant do destinatário e revisão C05 no commit | #563 adicionou `product/collaboration/authority.ts:281`; `threads.ts:53–63,131,226` confirma o guard de destinatário e identidade do provedor. | **Absorvido para C05.** Conferir o ramo distinto de follow-up não C05 antes de portar alterações de `dispatch.ts` ou `thread-reads.ts`. |
| Cobertura completa sem produtor de evidência | `product/decisions/mutations.ts:120,125` já recusa um resultado completo sem `coverageEvidence` e liga `verifySnapshot` ao commit. | **Recusa básica absorvida.** A prova privada para no-op e o ordenamento seguem no recorte Finance. |
| Projeção analítica compartilhada | `product/analytics/view.ts` tem o blob final do #349. | **Absorvido literalmente.** |
| Core V2, recurso vazio e precedência de deny | `packages/core/src/permission.ts:156–171` ainda usa `evaluate` por recurso e cai em `allow` quando a lista está vazia. A resolução de pendências em `permission.ts:304–323` não contém a guarda equivalente do #349. | **Resíduo de runtime.** Recorte `core-permission-deny`, a partir de `95ad84fc64` limitado a Permission e consumidores task. Reprovar recurso vazio e preservar o deny configurado. |
| Claude tool sem recurso tipado | `modules/engine-adapters/claude-code/src/v2/host.ts:243,799–802` ainda fornece wildcard para chamada mapeada sem texto. O ramo de ferramentas sem mapeamento tem contrato distinto. | **Resíduo de runtime.** Recorte `claude-resource-required` de `97407e0db8`, limitado ao adaptador e seu teste de admissão. |
| Reuso de Session ID e prompts agendados | `packages/core/src/session.ts:417–435` ainda devolve a sessão existente na corrida. `scheduled-task.ts` e `tool/task.ts` mantêm os blobs da base histórica, sem as proteções de adoção/reconciliação do #349. | **Resíduo de runtime.** Recorte `session-adoption` de `95ad84fc64`. Exercitar localização, agente, parent e posse do prompt em retomada. |
| Reunião e shell como dados no Context Epoch | Em dev, `context-epoch.ts`, `meeting-context.ts`, `meeting-briefing.ts`, `message-updater.ts`, `direct-commands.ts` e `to-llm-message.ts` são os blobs anteriores ao delta. O #349 separa dados de baseline/instrução e preserva eventos de replay. | **Resíduo de runtime.** Recorte `context-epoch-data` de `6be0951806` mais correções de dependência de `fbe62fb53a` e `86f6e9f99b`. Preservar semântica de baseline/admissão e uma chamada LLM por turno. |
| Publicação do resultado exclusivo após liberar a posse | `packages/core/src/session/run-coordinator.ts` e seu teste mantêm o blob da base. O resultado é publicado no onExit do trabalho antes do settle do dono. | **Resíduo de runtime.** Recorte `exclusive-settlement` de `7e42b794e6` com o teste `81b45523df`. |
| Electron, origem de IPC e redirecionamento | `live-ipc.ts` e `wsl/ipc.ts` mantêm os blobs da base. `windows.ts` diverge e já tem navegação própria, mas o #349 acrescenta validação de sender/origem e cancelamento de redirecionamento para janelas privilegiadas. | **Resíduo de runtime.** Recorte `desktop-ipc-origin` de `f6f2be6426`. Conferir os redirects já tratados em App Dock e manter as validações existentes de permissões e canais. |
| Redação de credenciais em logs ao gravar | `apps/desktop/src/main/logging.ts:195` redige no export. `logging.ts` e `live-transport-log.ts` continuam iguais à base, sem redação antes das escritas usuais do #349. | **Resíduo de runtime.** Recorte `desktop-log-redaction` de `f6f2be6426`, separado do IPC. Testar escrita e export. |
| Settings V2, round-trip de permissões e estados MCP/Agents | Os quatro arquivos de `settings-v2/view/` e `agents-view.tsx` mantêm os blobs da base histórica. `ea518dbbea` normaliza regras objeto/lista, preserva padrões, expõe status de provider e separa ação MCP de login/retry/toggle. | **Resíduo de UI.** Dividir em `settings-permission-roundtrip` e `settings-agent-mcp-state`. O MCP de compras #586 é do host Microsoft e não resolve o comportamento desta tela. |
| Empacotamento Web genérico sem sourcemaps | `apps/cli/script/distribution-payload.ts:34–46` ainda captura todos os assets Web. O arquivo tem o blob da base. O fluxo Entra tem empacotador próprio e a prova ELF histórica trabalha com sidecars separados. | **Resíduo do empacotador compartilhado.** Reconciliar com o [#254](https://github.com/gustavomhss/Orchestra-SF/pull/254), aberto na base histórica. O #254 toca o mesmo empacotador e os dois testes Web, além do wrapper Deno. Reconciliar os guards de `7217133495` e portar somente as diferenças que faltarem, com mapa externo/comprimido, mapa inline e verificação do payload. |
| Contrato Files de download vazio, negação e MIME | O transporte recusa MIME inválido e conserva 401/403, mas `transport.ts:395–410,475–482` pode completar com zero bytes e `files/structures.ts:245` aceita qualquer Uint8Array. | **Resíduo de contrato.** Recorte `files-nonempty-download` de `bb53193cba` sobre #572/#575/#579. Manter erro tipado e testar Web e IPC. |
| Contratos Domain/Planner de versão, quantia e rótulo de medida | `domain/fields.ts:17` ainda aceita string livre em `SfDomainVersionInput`. `planner.ts` divergiu com os contratos nativos. Os inputs de quantia editável precisam manter o formato observado no produtor. | **Resíduo de contrato.** Recorte `native-numeric-contracts`, apenas guards compatíveis de `bb53193cba` e `41493a3b27`. Validar consumidores antes de restringir wire. Os três contratos de produtor explicitamente excluídos na descrição do #349 continuam fora desse porte. |
| Preparação de Apply e replay com recibo anterior | #560 trouxe o Apply, porém `product/decisions/receipt-review-binding.ts` conserva a base e não contém `preparedResumeIntentState`. O CurrentChoice #585 cobre outro replay. | **Resíduo de runtime.** O [#392](https://github.com/gustavomhss/Orchestra-SF/pull/392) tem cobertura de navegador e UI, sem o produtor de Apply. Usar suas asserções e extrair de `d4ce0d4eb5` o recorte `apply-receipt-resume`, que retém a intenção/digest originais e valida versão/incarnação sem novo dispatch. |
| Agenda/Reports, selo histórico de seleção | `product/reviews/routine-selection.ts:83–86` usa registry, TTL e binding. `product/reviews/port.ts:46` ainda espera boolean; o pedido do #349 relê o resultado emitido e confere stamps individuais. | **Resíduo de autoridade.** Recorte `report-selection-proof` sobre #563. Portar prova e seam juntos, com revogação, alteração de digest e comparação de stamps. |
| UI Authority, tempo inválido e comando consumido | `product/integration/ui-authority.ts:19–34,45` revoga a admissão ao atingir TTL em vez do recheck do comando consumido de `420c1dae91`. Timeout/revogação de Reports e Files já têm gates próprios. | **Resíduo de autoridade.** Recorte `ui-command-clock`, isolando relógio finito e reautorização depois da expiração. Preservar TTL de download e caminhos de recusa atuais. |
| Observação de registro/projeção e correlação Hot Topic | `product/dashboard/sources.ts` contém boa parte da projeção de #349 em dev, com diferenças no vínculo Request/lease e egress. `collaboration/composition.ts` e `source-lifecycle.ts` não têm o mesmo wiring da identidade recém-criada. | **Parcial.** Recorte `record-observation-fence` com `3f3543206e`, `420c1dae91` e assert WP08. A correlação de Hot Topic de `9bc24e341d` entra em recorte próprio depois de comparar #563 e o shape de source identity atual. |
| Recall Atlas por owner vivo | Os blobs de `memory-case-read-scope.ts` e `host-binding/atlas-memory.ts` mudaram em dev, mas não contêm o par `withSfAtlasRecallObservation` do #349. A escrita Atlas do C17 por Team já existe. | **Resíduo de recall.** Recorte `atlas-live-recall` de `f4ed9e86d4`, somente observação/leitura e testes de revogação. Verificar a API atual de Atlas antes de portar. |
| Phase bridge, origem física, skill load e login local | #569 já integrou a proveniência de carregamento governado. #566/#570/#573 substituem o antigo console local. `routine-native-phase-origin.ts` e `routine-native-phase-fence.ts` ainda têm blobs da base. | **Parcial.** Recorte `phase-origin-proof` para origem absoluta e fixture com raiz física. Usar contrato atual de #569; reaproveitar apenas assertions de login/audit em `native-fixtures` sobre a factory real. |
| Planner/BI e Finance, prova exata e pares de caso | #562/#582/#585 fecham ancestry e CurrentChoice nos fluxos aceitos. `planner-evidence.ts`, `scenario-operation-access.ts`, `portfolio-coverage.ts`, `cost-coverage.ts` e `stored-scenarios.ts` não carregam o pacote de observação de `15fd6f34cc`–`887d25a227`. `result-store.ts` divergiu no caminho C17. | **Parcial.** Separar `planner-source-reads`, `coverage-proof-order` e `finance-case-observe`. O [#517](https://github.com/gustavomhss/Orchestra-SF/pull/517) toca apenas `portfolio-coverage-authority.ts`. Tratar sua seleção de pares como sobreposição de contrato. Portar observação inicial/final, digest e clones só após comparar com a API atual. A falta do fixture antigo não demonstra regressão de C17. |
| Análise indisponível e follow-up fora de C05 | `analysis-host-services.ts` preserva o blob da base e não preserva o motivo de indisponibilidade da fonte no recorte `2f272331bc`. `collaboration/dispatch.ts` e `thread-reads.ts` divergem após #563, que cobre uma trilha de Reports. | **Resíduo estreito de análise; equivalência pendente no follow-up.** Recortes `analysis-source-status` e `followup-observation`. Primeiro manter status `unavailable` vs recusa; no segundo requerer reproduzir o ramo real ainda sem prova antes de portar. |
| UI Sucafina, negativa, moeda, texto e confirmação | #573/#579/#583 mudaram o shell, Imports e Executive. `confirmations/index.tsx`, `talent/index.tsx`, `headcount/index.tsx` e os quatro arquivos de i18n ainda têm os blobs da base. | **Parcial.** Recortes `sf-confirmation-payload` (fingerprint, versão e dependências do que será enviado) e `sf-ui-status-copy` (denied vs empty, moeda real e catálogo). Revalidar os atalhos do fornecedor e a apresentação de importação contra #579 e Executive contra #583 antes de transferir qualquer hunk. |
| Console PAGE legado, fixtures, provas de relatório e handoff | O #349 adiciona console instalado auxiliar, preload e vários fixtures ausentes em dev. O #563 usa a instalação de produção no Reports, e #573/#579 montam o host que os cenários atuais abrem. Os probes no handoff registram candidatos históricos e gates específicos. | **Infraestrutura histórica substituída.** Recortes de teste por comportamento, junto a cada delta de runtime acima. Preservar provas antigas como evidência; não portar um console paralelo, o workflow histórico ou resultados de perf como code paths. |

## Ordem de trabalho

1. Tratar os resíduos de fallback de autorização em recortes próprios. `core-permission-deny`, `claude-resource-required`, `session-adoption` e `desktop-ipc-origin` têm fronteiras explícitas no dev.
2. Reconciliar o #254 antes de abrir outro recorte de empacotamento. Levar o #392 e o #517 como referência de sobreposição e manter cada contrato em um delta pequeno.
3. Em Sucafina, começar pelos testes focais de download vazio, selo histórico, TTL e Apply. As equivalências pendentes devem ser confrontadas no host atual antes de selecionar patches.
4. Manter #349 e suas refs como fonte histórica. Cada destino proposto descreve um recorte; nenhum PR, execução ou alteração de branch faz parte deste inventário.

A matriz reúne leitura estática e provas de PR já existentes. Os recortes de equivalência parcial indicam a fronteira a verificar com o fixture atual. Esta revisão não atribui resultado novo de CI a nenhum deles.

## Apêndice de blobs por caminho

| Caminho no delta | Relação de dev com os dois snapshots | Blob em dev |
| --- | --- | --- |
| `.github/workflows/sf-factory-package.yml` | Ausente em dev | — |
| `apps/cli/script/distribution-payload.ts` | Igual à base histórica | `ca9edcafc0e6` |
| `apps/cli/src/sucafina-product/analysis-host-services.ts` | Igual à base histórica | `6b5f44ef8eb4` |
| `apps/cli/src/sucafina-product/bi-services.ts` | Divergente | `24cb859d3508` |
| `apps/cli/src/sucafina-product/business-services.ts` | Divergente | `f75c71df4467` |
| `apps/cli/src/sucafina-product/memory-case-read-scope.ts` | Divergente | `5b3357fa5f88` |
| `apps/cli/src/sucafina-product/native-ui/live-context.ts` | Divergente | `b5b52582c139` |
| `apps/cli/src/sucafina-product/planner-evidence.ts` | Igual à base histórica | `13153182e357` |
| `apps/cli/src/sucafina-product/portfolio-coverage.ts` | Igual à base histórica | `fd5e40da9a98` |
| `apps/cli/src/sucafina-product/portfolio-services.ts` | Igual à base histórica | `881ce4672d9d` |
| `apps/cli/src/sucafina-product/routine-native-phase-bridge.ts` | Igual à base histórica | `19d13c68633f` |
| `apps/cli/src/sucafina-product/routine-native-phase-fence.ts` | Igual à base histórica | `d917d8c52ef4` |
| `apps/cli/src/sucafina-product/routine-native-phase-origin.ts` | Igual à base histórica | `a046bc883784` |
| `apps/cli/src/sucafina-product/scenario-operation-access.ts` | Igual à base histórica | `a59f695365a7` |
| `apps/cli/test/distribution-web-native.test.ts` | Igual à base histórica | `550a84c826ae` |
| `apps/cli/test/distribution-web.test.ts` | Igual à base histórica | `8ceef2a78929` |
| `apps/cli/test/factory-distribution-linux.test.ts` | Ausente em dev | — |
| `apps/desktop/src/main/app-dock-linux-live.test.ts` | Igual à base histórica | `51540e247a30` |
| `apps/desktop/src/main/app-dock.ts` | Igual à base histórica | `e67d046dd9ac` |
| `apps/desktop/src/main/live-capture.ts` | Igual à base histórica | `a9dc48d2be8e` |
| `apps/desktop/src/main/live-ipc.test.ts` | Igual à base histórica | `5d10d72fb66e` |
| `apps/desktop/src/main/live-ipc.ts` | Igual à base histórica | `fcb3903779ee` |
| `apps/desktop/src/main/live-overlay.ts` | Igual à base histórica | `06543fff96b5` |
| `apps/desktop/src/main/live-transport-log.ts` | Igual à base histórica | `60d0f76aaace` |
| `apps/desktop/src/main/log-redact.ts` | Igual à base histórica | `45686e1cd166` |
| `apps/desktop/src/main/logging.ts` | Igual à base histórica | `ff51c9993872` |
| `apps/desktop/src/main/windows.ts` | Divergente | `ed82706da292` |
| `apps/desktop/src/main/wsl/ipc.ts` | Igual à base histórica | `e52af811a507` |
| `docs/handoff/HANDOFF-audit-one.md` | Ausente em dev | — |
| `modules/engine-adapters/claude-code/src/v2/host.ts` | Divergente | `f5ee75db569d` |
| `modules/sucafina/Sucafinav1/local/entry.ts` | Divergente | `c047dbe807dd` |
| `modules/sucafina/Sucafinav1/product/analytics/view.ts` | Idêntico ao #349 | `4da4fa30855a` |
| `modules/sucafina/Sucafinav1/product/collaboration/composition.ts` | Divergente | `ac3440f4d7cc` |
| `modules/sucafina/Sucafinav1/product/collaboration/dispatch.ts` | Divergente | `bf8cf5289917` |
| `modules/sucafina/Sucafinav1/product/collaboration/hot-topic-host.ts` | Divergente | `a523b3359b71` |
| `modules/sucafina/Sucafinav1/product/collaboration/thread-reads.ts` | Divergente | `df3b285512f3` |
| `modules/sucafina/Sucafinav1/product/collaboration/threads.ts` | Divergente | `a02bcc1e0960` |
| `modules/sucafina/Sucafinav1/product/dashboard/hot-topics.ts` | Divergente | `4fab9abb226f` |
| `modules/sucafina/Sucafinav1/product/dashboard/sources.ts` | Divergente | `09625842cb19` |
| `modules/sucafina/Sucafinav1/product/decisions/apply.ts` | Divergente | `89a71f8324ba` |
| `modules/sucafina/Sucafinav1/product/decisions/case-port.ts` | Divergente | `e90713d5c7c4` |
| `modules/sucafina/Sucafinav1/product/decisions/cost-coverage.ts` | Igual à base histórica | `78cfacb69c0e` |
| `modules/sucafina/Sucafinav1/product/decisions/mutations.ts` | Igual à base histórica | `3f31dd52babc` |
| `modules/sucafina/Sucafinav1/product/decisions/receipt-review-binding.ts` | Igual à base histórica | `b8c6af0cd15d` |
| `modules/sucafina/Sucafinav1/product/decisions/result-store.ts` | Divergente | `bf1b2e6d62b2` |
| `modules/sucafina/Sucafinav1/product/host-binding/atlas-memory.ts` | Divergente | `175eb00d1c32` |
| `modules/sucafina/Sucafinav1/product/integration/dashboard-sources.ts` | Divergente | `e95faf6c5d98` |
| `modules/sucafina/Sucafinav1/product/integration/planner-sources.ts` | Divergente | `b8f7b22413a9` |
| `modules/sucafina/Sucafinav1/product/integration/product-authority.ts` | Divergente | `2c44f063c0a9` |
| `modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts` | Divergente | `ac2d7219d3db` |
| `modules/sucafina/Sucafinav1/product/integration/source-projections.ts` | Divergente | `eb2ac067e45f` |
| `modules/sucafina/Sucafinav1/product/integration/ui-authority.ts` | Igual à base histórica | `5ff182ab182f` |
| `modules/sucafina/Sucafinav1/product/planner/operation-verifier.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/product/planner/port.ts` | Divergente | `b4aa7ae69195` |
| `modules/sucafina/Sucafinav1/product/planner/product.ts` | Divergente | `6f5e6c9aaa56` |
| `modules/sucafina/Sucafinav1/product/planner/scenario-bi.ts` | Igual à base histórica | `630ebaa2c8f3` |
| `modules/sucafina/Sucafinav1/product/planner/stored-scenarios.ts` | Igual à base histórica | `529e29806b3f` |
| `modules/sucafina/Sucafinav1/product/portfolio/coverage-preview.ts` | Igual à base histórica | `9f7e12113b38` |
| `modules/sucafina/Sucafinav1/product/portfolio/planner-sensitivity.ts` | Igual à base histórica | `cf579731aefe` |
| `modules/sucafina/Sucafinav1/product/portfolio/verification.ts` | Igual à base histórica | `254e22ea35f5` |
| `modules/sucafina/Sucafinav1/product/procurement/decision-host.ts` | Divergente | `50c261bf5bb7` |
| `modules/sucafina/Sucafinav1/product/procurement/scenario-producer.ts` | Igual à base histórica | `83b9fc13c70f` |
| `modules/sucafina/Sucafinav1/product/reviews/port.ts` | Divergente | `68ebdaab88f5` |
| `modules/sucafina/Sucafinav1/product/reviews/render.ts` | Divergente | `846318874c88` |
| `modules/sucafina/Sucafinav1/product/reviews/routine-selection.ts` | Igual à base histórica | `4e6f46000cdf` |
| `modules/sucafina/Sucafinav1/runtime/application.ts` | Divergente | `649ccb941b1a` |
| `modules/sucafina/Sucafinav1/runtime/contract.ts` | Divergente | `10bba42977c3` |
| `modules/sucafina/Sucafinav1/runtime/dashboard-budget.ts` | Igual à base histórica | `21e1a63b3a88` |
| `modules/sucafina/Sucafinav1/runtime/installed-console.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/runtime/local-identity.ts` | Divergente | `0a722bf1f677` |
| `modules/sucafina/Sucafinav1/runtime/local-store.ts` | Divergente | `8cccd5bcc8c8` |
| `modules/sucafina/Sucafinav1/runtime/microsoft-installation.ts` | Divergente | `97424780a064` |
| `modules/sucafina/Sucafinav1/runtime/operator-identity.ts` | Divergente | `4845de24285d` |
| `modules/sucafina/Sucafinav1/runtime/planner.ts` | Divergente | `2d5d9d29889b` |
| `modules/sucafina/Sucafinav1/runtime/procurement.ts` | Divergente | `a36a7cb892b9` |
| `modules/sucafina/Sucafinav1/test/fixture/local-browser.ts` | Divergente | `82f9ad8ca215` |
| `modules/sucafina/Sucafinav1/test/form-layout.test.ts` | Divergente | `ef8e8efdbffa` |
| `modules/sucafina/Sucafinav1/test/local-controls-browser.test.ts` | Igual à base histórica | `47ec264082c1` |
| `modules/sucafina/Sucafinav1/test/local-entry.test.ts` | Divergente | `f574311b0be4` |
| `modules/sucafina/Sucafinav1/test/local-store.test.ts` | Divergente | `2875f552e351` |
| `modules/sucafina/Sucafinav1/test/microsoft-composition.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/microsoft-first-login.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/microsoft-login/integration-fixture.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/microsoft-node.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/microsoft-routes.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/operator-browser.test.ts` | Divergente | `b354bd253788` |
| `modules/sucafina/Sucafinav1/test/parity-pitr.test.ts` | Igual à base histórica | `e20dc20d98e2` |
| `modules/sucafina/Sucafinav1/test/product/dashboard-installed-closure/fixture.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/decision-compare-performance/current-case-observations.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/docx-continuation130/table-flow.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/finance-state-read-performance/result-materialization.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/mixed-source-contracts/capture-prerequisite.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/native-phase-bridge/fixture.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/native-phase-bridge/native-fixture.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/review-fixes/finance-resume-performance/historical-verification-fixture.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/review-fixes/finance-resume-performance/historical-verification-pairs.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/review-fixes/finance-resume-performance/observed-coverage.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/review-fixes/procurement-apply/choice.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/runtime-readonly-root/wrappers.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/ui-split/ui-source/source-identity.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/wp01/http.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/wp02/collaboration-consumer.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/wp03/operation-verifier.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/wp03/scenario-bi.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/wp03/source-issuer.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/wp07/projection-access.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/wp08/record-read-observation.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/wp09/followup-consumer.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/product-authority.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/ui-authority.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/wp10/memory-integrity/revocation-tail.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/wp12/native-execution-dependencies.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/wp12/native-execution-executive.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/wp13/coverage-preview.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/wp13/coverage-sensitivity-integration.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/wp13/handoff-c08-integration.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/product/wp14/domain-outcome.test.ts` | Ausente em dev | — |
| `modules/sucafina/Sucafinav1/test/runtime-http.test.ts` | Divergente | `15b567600088` |
| `modules/sucafina/Sucafinav1/test/visual-layout.test.ts` | Divergente | `4f3f35b5381c` |
| `packages/app-shell/e2e/sucafina/installed-console-preload.ts` | Ausente em dev | — |
| `packages/app-shell/e2e/sucafina/installed-console.ts` | Ausente em dev | — |
| `packages/app-shell/e2e/sucafina/operations-support/installation.ts` | Divergente | `48d080f69bc2` |
| `packages/app-shell/e2e/sucafina/reports-support/ooxml.ts` | Divergente | `14864c9bbd4d` |
| `packages/app-shell/e2e/sucafina/reports-support/production-installation.ts` | Divergente | `75a76a1ef7f8` |
| `packages/app-shell/e2e/sucafina/wp03/installation-fixture.ts` | Ausente em dev | — |
| `packages/app-shell/e2e/sucafina/wp04/host.ts` | Divergente | `f610924d4da5` |
| `packages/app-shell/src/components/settings-v2/view/capabilities-section.tsx` | Igual à base histórica | `2a8134e0dde0` |
| `packages/app-shell/src/components/settings-v2/view/settings-data.test.ts` | Igual à base histórica | `2e307ed289f0` |
| `packages/app-shell/src/components/settings-v2/view/settings-data.ts` | Igual à base histórica | `dcf0405b20cc` |
| `packages/app-shell/src/components/settings-v2/view/settings-view.tsx` | Igual à base histórica | `13a483e1b2c8` |
| `packages/app-shell/src/i18n/orchestra-chapters/sf-cross.ts` | Igual à base histórica | `13d31052d385` |
| `packages/app-shell/src/i18n/orchestra-chapters/sf-u08.ts` | Igual à base histórica | `a79d817eadca` |
| `packages/app-shell/src/i18n/orchestra-chapters/sf-u23.ts` | Igual à base histórica | `5099ce391a96` |
| `packages/app-shell/src/i18n/orchestra-chapters/sf-u44.ts` | Igual à base histórica | `a3c1399f29c2` |
| `packages/app-shell/src/orchestra/chapters/agents-view.tsx` | Igual à base histórica | `7c27c5aa810c` |
| `packages/app-shell/src/orchestra/chapters/sucafina/collaboration-pages/confirmations/index.tsx` | Igual à base histórica | `fd198d9ac14d` |
| `packages/app-shell/src/orchestra/chapters/sucafina/cross-links/view.tsx` | Divergente | `c482bde9ed8f` |
| `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/executive/index.tsx` | Divergente | `f83d1b9df785` |
| `packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx` | Divergente | `48f3bc53be45` |
| `packages/app-shell/src/orchestra/chapters/sucafina/people/talent/index.tsx` | Igual à base histórica | `fcdb83cfc20e` |
| `packages/app-shell/src/orchestra/chapters/sucafina/planner/headcount/index.tsx` | Igual à base histórica | `45badcf55818` |
| `packages/client/src/sucafina/bindings.ts` | Divergente | `dcf4229af574` |
| `packages/client/src/sucafina/transport.ts` | Divergente | `5ce42b03cf85` |
| `packages/core/src/permission.ts` | Divergente | `2e3d29d3f1ec` |
| `packages/core/src/scheduled-task.ts` | Igual à base histórica | `0a89bbdc5760` |
| `packages/core/src/session.ts` | Igual à base histórica | `33778d390e7d` |
| `packages/core/src/session/context-epoch.ts` | Igual à base histórica | `65b17a86a4fb` |
| `packages/core/src/session/meeting-briefing.ts` | Igual à base histórica | `279b07e4a8ad` |
| `packages/core/src/session/meeting-context.ts` | Igual à base histórica | `23e12c5a9b61` |
| `packages/core/src/session/message-updater.ts` | Igual à base histórica | `4333586a8fb1` |
| `packages/core/src/session/run-coordinator.ts` | Igual à base histórica | `62b78b092729` |
| `packages/core/src/session/runner/direct-commands.ts` | Igual à base histórica | `93e4de0452ed` |
| `packages/core/src/session/runner/llm.ts` | Igual à base histórica | `bd019e1a7176` |
| `packages/core/src/session/runner/to-llm-message.ts` | Igual à base histórica | `8728799459cc` |
| `packages/core/src/tool/task-permission.ts` | Igual à base histórica | `1a3c81a3a321` |
| `packages/core/src/tool/task.ts` | Igual à base histórica | `0e82455ca428` |
| `packages/core/test/session-run-coordinator.test.ts` | Igual à base histórica | `384fc9c72da6` |
| `packages/schema/src/sucafina/domain/fields.ts` | Divergente | `cdb09915b945` |
| `packages/schema/src/sucafina/files/structures.ts` | Igual à base histórica | `e5507f5b97a5` |
| `packages/schema/src/sucafina/planner.ts` | Divergente | `1fb53c214274` |
