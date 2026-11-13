# R3-R2 — Revisão formal de execução, recursos e CI

**Veredicto: APPROVED_FOR_EXECUTION.** Os três achados originais pertinentes estão **CLOSED**. Não encontrei P0/P1 aberto nas áreas examinadas. Há **um novo P2**, com disposição explícita de correção no congelamento G0.

- **Candidato exato:** `38986380cd7b5697c0be30c1f55d43eddee63045`, branch `sf-product-plan`, repositório `gustavomhss/Orchestra-SF`.
- **Baseline de código declarada:** `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`.
- **Escopo:** execução integral dos quinze WPs/74 tasks, dependências, recursos, escritores, handoffs, revisão independente, prazo condicionado, seleções e proveniência de CI.
- **Testes da implementação:** **NOT_RUN**. Nenhum teste local de produto, run de CI, implementação, edição do candidato ou mutação remota foi feito.
- **Independência:** sem autoria; sem acesso aos pareceres dos demais revisores ou decisões de fechamento da rodada 2. As objeções E-F01/E-F02/E-F03 da rodada 1 foram reexaminadas em fontes primárias. O guard separado não foi tomado como substituto desta análise.

A aprovação é do **plano**, no SHA acima. Não aceita o produto, não prova que o host/modelo/scanner estarão disponíveis e não demonstra duração de duas horas. O plano condiciona essa meta a observações e exige continuação integral quando ela não couber.

## 1. Rechecagem dos achados originais

### E-F01 — CLOSED: o adendo tem decomposição operacional

O defeito original era a falta de tasks, capacidade, fronteiras e provas para o escopo residente/MCP/Atlas. O candidato agora possui três unidades próprias: **WP10.T06**, escrita por S0-B em T+10–45; **WP10.T07**, escrita por S0-A em T+10–55; e **WP14.T05**, tradução pura escrita por S4 em T+10–20. Elas estão na campanha, WPs, contratos, ownership, cronograma, DAG e mapas de provas. Os contratos C15–C17 e as matrizes 5 perfis/18 skills/8 packs/39 operações não ficam limitados ao adendo narrativo. [Campanha](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/campaign.json) · [WP10](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json) · [WP14](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP14.json)

A divisão distingue funções que antes estavam agregadas: S0/T01 fornece o estado C08 protegido e os composition roots; S0-A/T07 faz packaging, BusinessContextService e persistência Atlas; WP14 traduz, classifica, ordena e invalida de forma pura; S2/T05 entrega documentos em paralelo à fila de imports de S2-C. A lista de exceções Atlas é exata e há writers explícitos para os arquivos de runtime/Atlas. Os dezoito arquivos de skills possuem leases por fonte e o manifest final tem writer único S4-B. [Ownership](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/ownership.json)

Os dezenove handoffs identificam entregas antecipadas, consumidores e recibos. AM01–AM06 cobrem a carga/uso de todas as skills, os oito packs, identidade, aplicação, persistência Atlas e Relay. A existência de catálogo, documento, fixture ou assinatura tipada não fecha essas provas. A aprovação de E-F01 não decorre das contagens; decorre do caminho concreto produtor → output → consumidor → prova e dos atores que o executam. [Handoffs](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/output-handoffs.json) · [Provas integradas](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/resident-proof-plan.json)

A divergência localizada entre `decisions/port.ts` e `decisions/case-port.ts` é registrada em E2-F01. Ela não reabre a ausência ampla de decomposição, mas deve ser eliminada no congelamento da interface nativa.

### E-F02 — CLOSED: início por T02, branches e prazo de WP14 reconciliados

WP03 e WP06 dizem explicitamente que a construção determinística começa por **WP00.T02 em T+10**, inclusive quando GNATIVE/T04 está BLOCKED. `depends_on`, `task-dag` e as janelas coincidem. O handoff de Planner está em `sf2-planner`; o de imports, em `sf2-imports`. Não localizei nos artefatos operacionais examinados uma instrução residual que faça essas duas frentes esperar T04. [WP03](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP03.md) · [WP06](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP06.md) · [DAG](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/task-dag.json)

WP14.DOD.01 e WP14.T04.DOD.01 agora exigem funções prontas em **T+68** e consumo real/provas em **T+75**, com transferência exclusiva em T+43. Referências a T04 nos caminhos de WP09/WP12 continuam tratando qualificação/consumo nativo; não constituem o antigo bloqueio de início de Planner/imports. [WP14](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP14.md)

### E-F03 — CLOSED: as duas seleções Bun do app são explícitas

CI-APP foi separada em **CI-APP-SRC**, `args=[]`, e **CI-APP-BROWSER**, `args=["test-browser"]`. As duas são obrigatórias no mesmo candidato e têm recibos separados. O workflow consultado diretamente no SHA exato confirma a distinção: argumentos vazios seguem `test.root="./src"` e condição `solid`; `test-browser` seleciona a árvore browser e a condição/preloads pertinentes. Os specs Playwright SF não substituem nenhuma delas. [Recipes](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/ci-recipes.json)

As fontes primárias são [test-ci.yml](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/.github/workflows/test-ci.yml), [bunfig do app](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/packages/app-shell/bunfig.toml) e [scripts do app](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/packages/app-shell/package.json). Nenhuma request foi executada para chegar a esta conclusão.

## 2. Novo achado

### E2-F01 — P2: o handoff nativo do caso usa dois paths para o mesmo export

**OPEN · não bloqueante para iniciar · confiança alta.**

**Requisito atingido:** G0 deve congelar produtor/export/path/consumidor, e NATIVE-CASE deve chegar em T+14 para a composição nativa.

| Localização no candidato | Contrato declarado |
| --- | --- |
| `campaign.json#/resident_handoff_interfaces/1`, linha 28098 | `product/decisions/port.ts` exporta `createDecisionCasePort`, pronto em 14, consumido por WP10.T06/WP00.T04. |
| `output-handoffs.json#/outputs/1`, linha 32 | NATIVE-CASE publica `product/decisions/case-port.ts::createDecisionCasePort`. |
| `work-packages/WP11.json#/tasks/0/outputs`, linha 165 | WP11.T01 deve publicar `case-port.ts` em T+14. |

**Contraexemplo:** S4-A segue sua task e publica somente `case-port.ts`. S0-B segue `resident_handoff_interfaces` e importa `decisions/port.ts`. Os dois obedecem a fontes canônicas do mesmo commit, mas o módulo esperado pelo consumidor não existe até reconciliar o nome. O candidato não especifica uma fachada ou reexport entre os dois paths. [Campanha](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/campaign.json) · [NATIVE-CASE](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/output-handoffs.json) · [Task produtora](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP11.json)

**Consequência:** a ambiguidade pode consumir a reserva curta do handoff T+14→T+16 e da qualificação GNATIVE. A capacidade, o dono, o export e a entrega antecipada estão definidos; a inconsistência é localizada no nome de arquivo.

**Correção verificável:** escolher um único path. `case-port.ts` já coincide com a task e o output; atualizar `resident_handoff_interfaces` e seus espelhos para esse caminho é a correção mínima. Se a intenção é uma fachada `port.ts`, declarar seu reexport, produtor e entrega em T+14. Conferir igualdade do conjunto produtor/export/path/checkpoint em G0.

**Dono sugerido:** S0/WP00.T02, com S4-A/WP11.T01 e S0-B/WP10.T06. **Disposição:** corrigir no congelamento G0, antes do handoff nativo. É P2 porque não exige novo ator, nova decomposição ou redução de escopo e não impede começar as frentes planejadas; não deve ser propagado para os contratos congelados.

## 3. Cobertura da análise de execução

### Dependências, espelhos e construção versus consumo

A inspeção própria dos dados encontrou **74 tasks e 114 arestas de construção**, com visita topológica dos 74 nós e sem predecessor cujo término planejado seja posterior ao início do consumidor. O DAG coincide com `depends_on`. Os quinze WPs JSON coincidem integralmente com os objetos da campanha; ownership, contracts, ci-recipes, resident-ui-consumption e output-handoffs também coincidem com suas fontes canônicas. Isso é inspeção estática do plano, não execução dos testes do repositório.

As **289 arestas de consumidor** têm outra semântica: exigem integração real para concluir, sem obrigar todos os produtores a terminar antes de começar a construção. Isso permite WP14/T02 construir ranking por contrato e depois consumir Atlas; permite WP12 construir a interpretação contra a interface tipada em T+25 e exercer o bundle final depois de T+42. As proof windows e os marcos de consumo estendem-se até T+75. Não considerei uma fixture ou o fim da build window como DONE. [DAG](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/task-dag.json) · [Handoffs](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/output-handoffs.json)

### Atores e vinte slots

O plano distingue **vinte slots físicos** de **23 identidades ao longo do tempo**. Até72, há quatro atores por conversa; em72, S1-B/S2-B encerram para R1/R2; em75, S3-A encerra para R3. A condição de substituição exige encerramento real e lease aceito antes do spawn. A inspeção dos intervalos preserva o máximo de vinte e não encontrou sobreposição entre fatias de um mesmo ator. A reserva não substitui a observação do roster em GREADY. [Cronograma](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/schedule.json)

As correções dos três WPs cedidos passam respectivamente a S1, S2 e S3. Os antigos builders não reaparecem como capacidade oculta. Os demais autores continuam em suas fronteiras. Os reviewers são novos, não editam produto e têm leitura/revisão e recheck previstos. S0-A/B/C continuam autores e operadores de provas, sem serem contados também como revisores independentes. Os prompts das cinco conversas reproduzem essa regra.

### Handoffs de GNATIVE, documentos, skills e Atlas

A cadeia nativa é explícita: **13/14/15/16/18→20** para fonte+perfil, caso, Planner, runtime, composição e qualificação. São incrementos concretos de tasks longas. O gate exige caso/principal/versão/encarnação reais, skill distribuída e carregada, porta real e negativas de concessão/provider. Os oito packs têm contrato em20 e operação integral em75; o plano não confunde os dois estados.

Documentos têm capacidade própria de S2: resolver em20, extração em35, transferência a S2-C em53. Os imports não esperam esse trabalho. Nas skills, seis fontes ficam com S1, cinco com S3 e sete com S4-B. O primeiro digest pode ser lido em13 enquanto o lease de autoria da fonte permanece com S1 até29; ler/empacotar não concede escrita concorrente. `AI-CATALOG-PORT` em25 é interface; `AI-CATALOG` é alias do bundle `AI-FULL` em42.

S0-A entrega packaging Atlas em20, roundtrip em45 e serviço em55, consumindo resolver20, tradução20 e provider C08 em25. A divisão mantém WP14 sem persistência. S4 encerra seu lease WP14 em43; S0-C assume T03/T04 até68 e consumo até75. S0-A não pode ser contado como resgate nessa janela, pois permanece no Atlas. Os caminhos extras de scanner/dispatch também estão atribuídos em `ownership.technical_allocations`, complementando as fronteiras por ator. [Ownership](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/ownership.json) · [Handoffs](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/output-handoffs.json)

### Provas completas e fronteiras de CI

AM01 distribui exatamente as dezoito skills por cinco execuções agrupadas e exige carga/digest, saída persistida e consumidor. AM02 enumera os oito packs e as39 operações, com produtores tardios e paridade. AM03–AM06 exigem isolamento, aplicação autorizada/idempotente, módulos Atlas reais, reinício/scanner e Relay. E01–E18 permanecem cumulativos; não há substituição do restante do escopo por essas seis provas. [Provas residentes](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/resident-proof-plan.json) · [Evidências](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/evidence-plan.json)

As oito recipes são um mínimo da footprint. O alias `atlas-boundary` existe no registry e resolve a `modules/atlas/boundary`; `--timeout 30000` reproduz o timeout do script sem filtrar arquivos. `generate`, `check:generated` e `typecheck` são gates separados, coerentes com os scripts reais. A prova de Bun não é tratada como prova de frescor dos gerados. [Registry](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/script/module-registry.json) · [Package Atlas](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/atlas/boundary/package.json)

Os validators reais aceitam a configuração de produção e o namespace `e2e/sucafina`; exigem specs existentes e seleção não vazia. `playwrightArgs` impõe um worker e retries0. O config abre o frontend `apps/web`; montar o backend SF real, corpus e identidades no harness continua uma entrega explícita da frente WP10 e precisa aparecer no smoke, não uma capacidade presumida por esta revisão. [Validator](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/script/test-ci-request.ts) · [Config](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/packages/app-shell/e2e/playwright.production.config.ts)

A proveniência obriga candidato C, snapshot S com somente `.ci-run.json` alterado, branch `ci-run-linux-*`, evento push, SHA e branch reais, request normalizada, seleção, run, attempt, jobs e evidência. O mecanismo de push corresponde ao workflow. O conector expõe leitura GET de runs e subrecursos e o plano evita o wrapper restrito a runs de PR. Repetições não podem reetiquetar evidência antiga para um candidato novo. [Recipes](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/ci-recipes.json) · [Workflow](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/.github/workflows/test-ci.yml)

## 4. Prazo condicionado e incertezas residuais

Não há evidência de que o escopo terminará em120 minutos. Tampouco encontrei uma contradição de recursos que, por si só, torne falsa a condição expressa pelo plano. G2H exige trabalho residual, roster/leases, filas, setup, execução/coleta, modelo e revisão observados. Valores desconhecidos não viram zero; as reservas finais de20 e15 minutos são hipóteses, e o timeout45 minutos do job não é previsão. Se não couber, T+120 exige atraso, pendências e continuação integral. [Cronograma](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/schedule.json)

Permanecem relevantes:

- A existência real das cinco conversas, a liberação dos slots e a aceitação dos leases ainda serão observadas durante a campanha.
- Vários packs só recebem seu último produtor em T+72, deixando a janela72–75 para consumo tardio. Isso é um ponto de concentração a medir em G2H; não é possível converter uma grade nominal em garantia de throughput.
- A suíte do epic e da footprint final pode acrescentar requests às oito mínimas. A fila, a concorrência de runners e as latências de inferência/scanner são desconhecidas.
- Modelo/autoridade nativos e scanner real ainda precisam de preflight e provas. HOLD/BLOCKED não satisfazem AM01–AM06.
- O harness deve montar o produto real e revalidar UI, persistência e permissões. Sua existência futura não foi confundida com teste já executado.
- A baseline continua fixa. Uma adoção de `dev` mais novo ou um arquivo compartilhado com a frente cloud requer comparação/reconciliação por SHA e escritor único.
- E2-F01 tem disposição de correção em G0; o path divergente não está aceito como um contrato de import definitivo.

O inventário de caminhos e os15 recibos de fontes remotas, com seus blob SHAs, estão no JSON acompanhante. A conclusão não depende de um parecer de autor ou de outro revisor: os fechamentos se apoiam no candidato e nas fontes do workflow efetivamente examinadas.
