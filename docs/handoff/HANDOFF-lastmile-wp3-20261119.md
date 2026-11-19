# Handoff — lastmile-wp3-20261119

SHA: e8bfc38f806e743196deca33aea552ee024b3b9f (código verificado; o commit deste handoff é posterior)
Data: 2026-11-19T15:03:55.845Z
Estado: partial

Base: sf-join-four @ f590e80e7b4b5d6ae17ca753b40583019b50a998.
Template: docs/handoff/HANDOFF-TEMPLATE.md em sf-handoff-brief, blob 725697cdae3a42133df81a42637ff70214a78cb3; ausente na base.

## Feito

- WP3 — packages/app-shell/e2e/sucafina/bi-installed/installed-fixture.ts — entrada de Planner em capítulos nativos relativos à baseURL do Playwright (:3000), criação/cópia/edição de versões CAP23, identificação exata por ID emitido pelo produtor, linhas e gerenciamento de OPEX CAP18. O ano de 2027 fica explícito na seleção das versões e do OPEX.
- WP3 — packages/app-shell/e2e/sucafina/bi-installed/installed-planner-ingress.spec.ts — criação inicial abre a revisão nativa, confirma uma única vez e exige o POST real, seu resultado JSON, CAS do produtor e o mesmo ID no detalhe e na linha nativa.
- plannerCommand lê CAP23/CAP18 por GET autenticado antes do comando, conserva a comparação exata de page/action/id/version, exige confirmed=true e uma única requisição, observa resposta/falha/incerteza sem repetir mutação e aguarda a revisão fechar.
- A leitura diagnóstica do Planner usa GET /sucafina/api/ui/pages/CAP23. Não lê HTML do console descomissionado.
- Guard explícito em preparePair impede que o helper de Decisions navegue para :4110 enquanto não for migrado.
- Cold review independente do diff e8bfc38 pelo agente WP5: nenhum defeito concreto novo de seletor/CAS/URL ou enfraquecimento de asserção de negócio identificado. Isso é revisão de código, não resultado de execução.
- Gate único change-scoped: test-ci run [44550439407](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44550439407), snapshot 9bd090206b82e2fec4c5df613f5705308e0cfda2. Resultado: failure — 2 testes executados, 2 falharam.

## Pendente

- Binding da instalação local ao shell nativo — packages/app-shell/e2e/sucafina/bi-installed/installed-planner-ingress.spec.ts:15,79 e packages/app-shell/e2e/sucafina/bi-installed/installed-fixture.ts:216 — a fixture externa wp03/installation-fixture.ts:14,53,108 inicia CLI em localhost:4110 e retorna cookie/origem, mas não estabelece seleção/descoberta/contexto autorizado no shell :3000. Não foram inventados cookies, grants, CORS, transportes ou descritores.
- Forecast mensal de doze meses — packages/app-shell/e2e/sucafina/bi-installed/installed-fixture.ts:279 — explicitForecast ainda exige a interação legada de edição em massa. O binding para SfMonthlyGrid nativo não foi concluído; mantidas todas as expectativas de zeros, novembro, medidas, preview/apply e persistência após reload. Falhar nesse contrato continua sendo falha.
- Preparação de casos/alternativas de Decisions — packages/app-shell/e2e/sucafina/bi-installed/installed-fixture.ts:49,51,53 — enterWorkbench ainda recebe origem da instalação e não está vinculado ao capítulo nativo. A porta 4110 produz erro UNBOUND antes da navegação. Permanecem as asserções posteriores de fontes, cobertura, cenários, comparações e portfólio; não há bypass que permita sucesso.
- Primeiro limite observado no gate — installed-fixture.ts:337 (chamado por :217): Create first version ausente; installed-planner-ingress.spec.ts:81: heading Versions ausente. Os dois testes falharam antes do comando Planner. Esses logs não validam os payloads/revisões posteriores e não isolam a causa da ausência da superfície; o binding descrito acima continua pendente.

## Decisões e justificativas

- Asserções de negócio removidas: nenhuma. Os totais 240000/210000/250000, custo de treinamento 40000, diferença condicionada/completa, referências emitidas pelo produtor, CAS, contagem de comandos e matriz de doze meses permanecem exigidos.
- Contratos DOM substituídos: form/data-record e Manage dialog de Versions foram substituídos pelo ID retornado no comando, rota de detalhe codificada e tr[data-sf-row]; data-version foi substituído pelo token numérico real da projeção e sua igualdade no POST. O form legado data-bound=true foi substituído por superfície CAP23, leitura autorizada da projeção vazia, controle habilitado e revisão nativa pronta. A mudança não é apresentada como prova de binding do shell.
- Diagnósticos removidos: #notice, data-personal-views e data-result-uncertain do console. Diagnósticos atuais usam .sf-u46-alert, data-state de sf-change-review e IDs nativos. O POST de listagem read-only de workbench-views existente foi mantido.
- Controles não vinculados: o editor mensal em installed-fixture.ts:280 e a jornada de Decisions em :53. Não foram recriados controles de console.
- O produtor mantém sua origem real para APIs autenticadas; navegação nova do navegador usa somente capítulos nativos. Uma origem de API não foi reescrita para simular autorização.
- Escopo respeitado: dois arquivos WP3; sem alteração de aplicação/produtor, fixture externa, workflow, autenticação ou timeout; sem mocks, retries, skips, baseline/coverage/digest/GO fabricados.
- A edição foi encerrada antes de vinte minutos. Pendências ficam identificadas como unbound, sem refactor adjacente.

## Como retomar

1. Partir de lastmile-wp3-20261119 / código e8bfc38f806e743196deca33aea552ee024b3b9f; este handoff acrescenta apenas documentação.
2. Ler o run 44550439407 e o primeiro ponto de falha descrito abaixo. Resolver primeiro a fixture local e o binding nativo usando discovery e contexto reais; uma URL :3000, isoladamente, não associa a instalação.
3. Vincular explicitForecast à interação realmente publicada no grid nativo e migrar a preparação de Decisions, conservando os doze meses, refs e cálculos do produtor. Não destravar removendo asserções ou usando browser em :4110.
4. Após essas correções, usar o mesmo escopo de dois specs em um novo snapshot atômico, conforme a política de verificação do próximo WP/retomada. Não rodar sf-ci intermediário.

## Comandos e resultados

- `bun typecheck` (app-shell): não rodado; acesso GitHub somente, sem shell.
- `bun run check:guards --base origin/dev`: não rodado neste WP; gate final é responsabilidade da integração.
- `test-ci` por push: **failure — 2 testes executados, 2 falharam**, run 44550439407, head 9bd090206b82e2fec4c5df613f5705308e0cfda2, parent código e8bfc38f806e743196deca33aea552ee024b3b9f.
- Snapshot ci-run-linux-wp3-20261119 criado já com .ci-run.json: create_tree, create_commit, create_branch. Nenhum bootstrap sem configuração; cleanup da branch terminou com success.
- Request:
```json
{
  "package": "app",
  "runner": "playwright",
  "config": "e2e/playwright.production.config.ts",
  "args": [
    "e2e/sucafina/bi-installed/installed-planner-ingress.spec.ts",
    "e2e/sucafina/bi-installed/installed-bi.spec.ts"
  ]
}
```
- installed-bi.spec.ts foi incluído porque consome a fixture modificada. Ingress sozinho não cobre essa alteração.
- Job test (ubuntu-24.04), ID 135652394225: seleção dos dois specs e build concluídos; Run tests falhou. installed-bi.spec.ts falhou em installed-fixture.ts:337 por botão Create first version não encontrado; ingress falhou em :81 por heading Versions não encontrado. Os timeouts existentes de 10000ms foram preservados. Log do CLI registra servidor em ::1:4110. Cleanup job 135654214116: success.
- Artefatos: playwright-ubuntu-24.04-1, ID 14541754350, 618902 bytes, disponível no run até 2026-11-26T15:05:54Z. Os logs apontam screenshot/error-context de cada teste; o ZIP binário não foi aberto pelo conector GitHub. Evidência de conclusão e falhas vem dos logs de Actions, sem execução local.
- Nenhum pacote, merge em sf-join-four, sf-ci ou GO declarado por este WP.
