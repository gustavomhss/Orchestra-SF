# Handoff — lastmile-wp4-20261119

SHA: 99e557e6cd6e805ee5978b95f2e47b19a80a2252 (código submetido ao gate; este handoff é um commit posterior)
Data: 2026-11-19
Estado: partial

Base: sf-join-four @ f590e80e7b4b5d6ae17ca753b40583019b50a998.
Template: docs/handoff/HANDOFF-TEMPLATE.md de sf-handoff-brief, blob 725697cdae3a42133df81a42637ff70214a78cb3; ausente na base.

## Feito

- packages/app-shell/e2e/sucafina/wp03/planner-mounted.spec.ts: entrada de Versions/OPEX/CAPEX em capítulos nativos relativos à baseURL :3000. A origem da instalação continua usada somente para requests de API. Criação inicial e edição CAP23 usam controles conferidos no código nativo, revisão sf-change-review, confirmação e ID retornado pelo produtor. Clipboard recebe permissão para a origem realmente aberta.
- packages/app-shell/e2e/sucafina/wp10/extended-flows.ts: rotas nativas BI/review com referência opaca r_ + base64url; edição do owner OPEX exato retornado por CAP04, draft/revisão/Save nativos, payload e resposta reais, valor persistido após reload. sectionId sem contrato nativo causa erro UNBOUND explícito; não vira uma navegação silenciosa para a revisão inteira.
- packages/app-shell/e2e/sucafina/review-agenda-support/first-agenda.ts: entrada por Budget nativo, link Reports and backup e rota de agenda nativa. Mantido o contrato de criação multi-domain como unbound.
- Revisão independente do agente WP5 identificou perda de sectionId e ausência da asserção Sign out na primeira versão. Ambas foram corrigidas antes do gate em 99e557e6: erro explícito para sectionId e asserção Sign out preservada com comentário UNBOUND.
- Gate único [44550163383](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44550163383): failure, 2 executados / 2 failed / 0 passed. Snapshot 40ced78d45ebca77e01835f370429263071832d9 tem o código 99e557e6 como parent.

## Pendente

Todos os caminhos abreviados abaixo partem de packages/app-shell/e2e/sucafina/.

- wp03/planner-mounted.spec.ts:27 — primeiro bloqueio observado: [data-sf-surface="CAP23"] ausente após a rota nativa. O gate falhou antes da criação/edição alterada. Os logs não isolam a causa. A fixture externa wp03/installation-fixture.ts:14,53,108 inicia CLI localhost:4110 e fornece cookie, mas seu binding autorizado ao shell :3000 permanece unbound.
- wp03/planner-mounted.spec.ts:29 — Sign out foi mantido; controle de conta nativo equivalente ainda não vinculado. Não remover para destravar o teste.
- wp03/planner-mounted.spec.ts:48,84,110,175,195 — editor mensal bulk preview/apply, saved-grid/disclosure e referências do grid continuam contratos legados. Asserções de zeros explícitos, herança, valores inválidos, duas linhas e reload estão preservadas.
- wp03/planner-mounted.spec.ts:98,99,103,119,127,137,141,142 — gerenciamento CAPEX/Versions por Manage dialog, filtro/grid e controles de versão oficial ainda precisam do binding nativo; não foram recriados.
- wp10/composition.spec.ts:368 — consumidor fora do escopo falhou com "Local enrollment did not issue the expected scoped operator cookie". Não chegou a qualifyWp10ExtendedUi, portanto não há prova runtime da mudança em extended-flows.
- wp10/extended-flows.ts:17,19,24,64,65,68 — seletores BI legados, link para Planner e navegação/review-workspace não foram vinculados; o capítulo não aceita os antigos parâmetros page/start/end.
- wp10/extended-flows.ts:73,74,78,81,131,133,135,136,143,146,147 — Open meeting, referência via query, review-read e revisão sucessora/picker ainda dependem do contrato legado. Há disponibilidade nativa de sucessor, mas não foi demonstrado fluxo nativo que preserve uma nova revisão.
- wp10/extended-flows.ts:10,11,153,155 — deep link de seção não foi encontrado no contrato nativo; erro UNBOUND antes de descartar sectionId. Asserção de tópico selecionado e uso posterior de revogação permanecem.
- review-agenda-support/first-agenda.ts:22,29,37,47,68,92,144,147,155,194 — UI47 tem picker de seções de dashboard; o form.report-form, descoberta multi-domain/período, seleção de tópicos e detalhes de fonte da jornada antiga não estão vinculados. Não foi identificado consumidor nominal executado para esse helper no gate escolhido; não declarar cobertura desse arquivo.
- Nenhuma das mutações nativas editadas foi alcançada no gate. Sem resultado de guards/typecheck final neste WP.

## Decisões e justificativas

- Asserções de negócio removidas: nenhuma. Não há skips, retries de mutação ou aumento de timeout.
- Substituições de contrato DOM: navegação /sucafina/planner virou rota /orchestra/sf-planner; região/linha/edição inicial de Versions virou superfície CAP23, tr[data-sf-row], botão select e #sf-u46-name/year. O POST continua obrigado a retornar sucesso e ID real.
- O seletor legado de owner OPEX em section[id]-pr/form[data-command] foi substituído pela projeção CAP04, ID exato de owner, tr[data-sf-row], sf-budget-editor e sf-change-review. O orçamento anterior precisa ser número finito; novo orçamento, payload e valor pós-reload são exigidos.
- A retirada de query mode do Planner não retira a seleção de forecast: o controle Measure continua explicitamente acionado. URLs nativas não recebem parâmetros não admitidos.
- Nenhum campo de projeção, operação, baseline, coverage, digest ou export foi fabricado. Nenhum runtime/application.ts ou workflow foi alterado.
- Encerrada a edição dentro do limite aproximado de vinte minutos. O restante é unbound com linhas acima, sem refactor adjacente.

## Como retomar

1. Usar o código 99e557e6cd6e805ee5978b95f2e47b19a80a2252 e este handoff; integrar somente os três arquivos de escopo e documentação.
2. Resolver primeiro o binding real entre instalação, descoberta/contexto autorizado e shell nativo; para WP10 resolver a falha de enrollment antes de atribuir falha ao helper.
3. Vincular os contratos mensais, gerenciamento, BI/review e agenda somente aos fatos e controles realmente renderizados. Conservar expectativas de persistência, identidade, fontes, períodos e sucessor.
4. Identificar consumidor real de first-agenda antes de alegar cobertura; não usar reports.spec.ts como prova se ele não importa o helper.
5. Na próxima retomada, executar o spec mais estreito que alcance a correção, usando snapshot atômico com configuração já presente. Nenhum sf-ci intermediário foi executado neste WP.

## Comandos e resultados

- Sem shell e sem testes locais. Toda execução abaixo foi GitHub Actions.
- test-ci: run 44550163383, head 40ced78d45ebca77e01835f370429263071832d9, parent 99e557e6cd6e805ee5978b95f2e47b19a80a2252; failure.
- Request atômico em ci-run-linux-wp4-20261119:
```json
{"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/wp03/planner-mounted.spec.ts","e2e/sucafina/wp10/composition.spec.ts"]}
```
- Job 135651412396: build/seleção concluídos; 2 testes com 1 worker; falhas em planner-mounted.spec.ts:27 e composition.spec.ts:368. O timeout de locator de 10000ms e os timeouts de teste existentes foram preservados.
- Cleanup job 135655538804: success; snapshot removido.
- Artifact playwright-ubuntu-24.04-1, ID 14541744769, 940009 bytes; upload success. [Artefato](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44550163383/artifacts/14541744769). ZIP não aberto pelo conector; diagnóstico vem dos logs reais de Actions.
- bun typecheck e check:guards: não executados separadamente; aguardam o gate final da integração. Sem sf-ci, pacote ou GO declarado por este WP.
