# Handoff — finish-operations-20261119

SHA: a96e53b63e8c5301cbb55657c9ad730e3821b033 (código; gate em snapshot descrito abaixo)
Data: 2026-11-19
Estado: partial

## Feito

- Preservado o checkpoint 51ad7590eb5f1e5626a19a3681189e4ab11fb43f; integrado à branch própria o ancestral sf-join-four@0a3c05fbc4175f9514a12036d43ff1e5cca51d56 por commit com os dois parents, sem force.
- Correção de redeclaração em operations-support/imports.ts: o Locator Planner usa versionDetail; a projeção de importação Detail e todas as asserções permanecem. Essa correção já está na base integrada.
- Os seletores de revisão em procurement-snapshot.ts e procurement-refusal.ts selecionam explicitamente o parágrafo Stage; continuam comparando status e versão completos.
- operations-support/installation.ts agora usa createSfHostRuntime e os montadores nativos originais, com os mesmos authenticate, environment, persistence e Request. Contexto, ações, projeções, C02 e descoberta vêm dos produtores e do runtime real.
- wp04/host.ts compõe createEmbeddedRoutes com runtime.contributions e discovery original. O grafo completo deve responder ao health real e carregar sua identidade antes do readiness do fixture.
- O banco core, config, credenciais e diretórios XDG/TMPDIR pertencem ao diretório privado do processo Actions; os imports que capturam configuração ocorrem depois dessa preparação.
- Um mount real /sucafina serve o shell em http://127.0.0.1:3000 pelo proxy preservando Host/Origin. As três identidades usam createOperatorIdentity e credenciais emitidas pelo próprio fixture. Sessões simultâneas ambíguas são recusadas; a política viewer apenas reduz os papéis da sessão original.
- Login consulta discovery tipado, verifica o contexto nativo e o principal real, e seleciona o diretório pelo controle Choose project. WP04 reutiliza esse ingresso.
- O observador da importação usa BrowserContext separado; a aba reader do operador mantém a sessão original para provar revogação.
- wp04/native-ingress.spec.ts chama procurementComparison inteiro para selecionar OP-PROC-01 pelo runner que aceita somente nomes de arquivo. Nenhuma asserção foi duplicada no helper nem retirada do teste original.

## Pendente

- packages/app-shell/e2e/sucafina/wp04/host.ts:113: aguardar o gate da inicialização e ingresso reais; ainda não há resultado runtime desta composição.
- packages/app-shell/e2e/sucafina/operations-support/runtime.ts:48: qualificar discovery, sessão e escolha de projeto no shell; o novo gate cobre essa cadeia.
- packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts:132: concluir as interações legadas de validação, CAS, alterações tardias, aprovação, ciclo PO, fornecedores e settings pelos controles nativos. As asserções existentes estão preservadas.
- packages/app-shell/e2e/sucafina/wp04/sourcing-controller.spec.ts:11: ainda sintetiza o console retirado para dois testes isolados de controlador. Não qualifica o capítulo. Migrar para o controlador nativo verificável sem forjar autoridade ou execução.
- packages/app-shell/e2e/sucafina/operations.spec.ts:13: depois do ingresso, executar os demais slices Procurement e os fluxos de importação/documentos. O full Operations ativa o ClamD real preparado pela infraestrutura integrada.
- packages/app-shell/e2e/sucafina/operations-support/imports.ts:251: isolamento viewer implementado, ainda não exercitado pelo gate estreito de Procurement.
- apps/web/vite.config.ts:40 e packages/app-shell/e2e/playwright.production.config.ts:11: o proxy/config pertencem ao WP de ingresso. O gate abaixo incorpora exatamente o snapshot 88c06fcee93719f8d4758db35a46328112c38bda; a branch de Operations não os altera.

## Decisões e justificativas

- Nenhuma asserção foi removida, pulada ou afrouxada; nenhum timeout foi aumentado.
- modules/sucafina/Sucafinav1/runtime/application.ts permanece sem edição.
- O dispatcher CAP25 já monta a fila C02 e Requests no entry. A prova de source-ref/digest/version permanece no login WP04.
- A composição manual anterior de importação/documentos foi substituída pela fábrica host original. O wrapper de diagnóstico anterior não era uma asserção nem uma fonte de autoridade; o runtime original agora possui esses serviços.
- Não foram fabricados descriptor, contexto, Session, readiness, receipt, digest ou execução de provedor. Os grants de produto preservam a política explícita anterior da instalação para cada operador.
- O novo spec estreito é necessário porque script/test-ci-request.ts:114–128 não aceita --grep em args de Playwright.
- O snapshot do gate inclui os dois arquivos de infraestrutura compartilhada ainda em qualificação. Seu resultado deve ser atribuído ao SHA completo do snapshot, não apenas ao SHA do código Operations.
- Não há declaração de GO.

## Como retomar

1. Continuar em finish-operations-20261119, código a96e53b63e8c5301cbb55657c9ad730e3821b033.
2. Acompanhar run 44564777712 e corrigir somente causas observadas, usando GitHub Actions para verificar.
3. Após OP-PROC-01 alcançável, concluir os demais fluxos de Operations e WP04 com os produtores e controles nativos reais.
4. Coordenar a integração do proxy com finish-ingress-20261119 e a base com sf-join-four.
5. Atualizar este documento com resultados terminais, SHA final e pendências file:line antes de entregar para integração.

## Comandos e resultados

- Verificação local: não executada; trabalho exclusivamente via GitHub.
- typecheck:sf-e2e da base 0a3c05f: SUCCESS no run 44561871689; o gate também executou os dois testes legados sourcing-controller, que passaram. Isso não prova o ingresso nativo novo.
- test-ci estreito: https://github.com/gustavomhss/Orchestra-SF/actions/runs/44564777712 — in_progress neste checkpoint.
  - Branch efêmera: ci-run-linux-ops-native-20261119-1.
  - SHA executado: 7441184861a7573b993c6b4a065a968c583120ad.
  - Composição: código a96e53b63e8c5301cbb55657c9ad730e3821b033 + Vite/config originais do ingresso 88c06fcee93719f8d4758db35a46328112c38bda + .ci-run.json.
  - Request: {"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/wp04/native-ingress.spec.ts"]}.
- guards: não executados nesta branch.
- sf-ci: nenhum novo dispatch, rerun ou cancelamento feito por este WP.
