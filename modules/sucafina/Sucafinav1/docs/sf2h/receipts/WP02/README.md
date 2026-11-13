# WP02 — entrega Dashboard e recibo cirúrgico

**Estado: DRAFT / BLOCKED para aceite integral.** Implementação WP02 publicada; testes cirúrgicos aprovados; typecheck de package ainda reprovado fora do ownership WP02. Este recibo não declara DONE, GLOBAL_RELEASE ou execução nativa completa.

## Publicação e proveniência

- [PR #21 contra sf2-stack](https://github.com/gustavomhss/Orchestra-SF/pull/21), branch `astra-wp02`.
- Handoff: `4e4d873e7e93bba3dc82df45e243999e7c8e76b6`, `docs/sf2h/control/handoff/astra/WP02.md`.
- Plano: `dbf9547211d9b0fade619790de7c19c0869b7c7d`; campaign SHA-256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`.
- Seed efetivamente retomado: `855c17f66fd71964d88a63ca53fd90240159eb08`, tree `c6f8b7704278a743ef1bec99649b85cfecbdff90`.
- Base observada da PR: `6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0` (`sf2-stack`).
- Produto testado **W**: [`38d340a8857b96904f7246320091c14c051f1929`](https://github.com/gustavomhss/Orchestra-SF/commit/38d340a8857b96904f7246320091c14c051f1929); tree `86f34811d3d4fcbec8145c4fbbed499ad9cc1d9b`.
- Snapshot de testes **S**: `f238adf0cce5693a2583f719c72a9b402b291571`; tree `52ae4e8b0a4f0edc3706ffdfacba6266891ed495`.

W é pai direto de S. A [comparação W→S](https://github.com/gustavomhss/Orchestra-SF/compare/38d340a8857b96904f7246320091c14c051f1929...f238adf0cce5693a2583f719c72a9b402b291571) contém **somente `.ci-run.json`**. Todos os blobs de produto, testes, configuração e fixtures são idênticos nos dois commits. Os recibos finais são publicados depois de W somente dentro desta pasta; não alteram o código testado.

## Implementação

### T01 — leitura autorizada e semântica temporal

As 16 capacidades continuam usando os quatro motores canônicos. SD01–SD03 foram confrontadas com o código de referência: razão lógica sem clamp, curva mensal efetiva separada da referência anual/12 e backlog distinguido de variação líquida. As provas literais passaram: **100/120→120%**, **1200 com janeiro200→1300** e **20+10−15→15**, com fluxo líquido **−5**. [semantic-decisions.json](semantic-decisions.json) registra baseline, decisão e teste.

As fontes de ações, incidentes e campanhas de Security são observações atuais, com dia de observação e invalidação após troca de dia. KPIs datados continuam históricos. A UI declara essa distinção ao abrir um ano de KPI diferente do ano observado.

### T02 — manutenção, preview e importação

Security e Performance mantêm leitura visível e editores contextuais fechados. Mensagens 400/422 do motor chegam ao producer de preview/apply; conflitos devolvem apenas a projeção autorizada do registro armazenado. Recusas de acesso permanecem genéricas. O teste de importação JSON usa o producer WP06 real e compara preview/aplicação, CAS, remoção, estado privado, referências de arquivos e atores recusados. Os outros três formatos seguem os producers existentes.

O adapter HTTP de preview pertence ao WP10 e ainda precisa consumir o delta proposto para que esse feedback chegue ao app composto. Preservação visual de foco, rascunho e posição não é declarada comprovada por testes de renderer.

### T03 — revisão, destinos e agenda

Portfolio agora apresenta revisão da coleção canônica de projetos, mantendo filtros, marcos, watchlist e acesso ao cadastro All Projects. Destinos de projeto/risco/contrato/stakeholder/Performance exigem IDs não vazios e únicos.

Operations seleciona registros mensais físicos e recusa meses ambíguos. Executive preserva agregados na seleção padrão; subconjuntos explícitos incluem apenas os sinais escolhidos e declaram cobertura. Performance valida IDs reais e recusa a seleção quando o host não oferece lifecycle físico `itperf-item`. O patch desse lifecycle e a composição da agenda estão preparados para WP10; `ReviewHost.select` e o consumidor de rotina continuam pendentes.

### T04 — Hot Topics, histórico e C12

A ação operacional continua Hot Topic. Preparação/revisão C12 usam simulação e mutation reais, preservam conclusão da ação e exigem verificação privada do vínculo com o prepared record. O callback assíncrono é aguardado nas duas leituras sob `transactionAll`.

A reabertura histórica preserva fato, autor e data da captura; a leitura final do receipt protegido, igualdade de digest, autoridade atual e fence compartilham a transação. Negativas cobrem receipt substituído/removido, fonte recriada, revogação e alteração coerente de comando+preview mantendo digest antigo. Registros datados conservam competência ao atravessar o ano. Capturas de `dashboard-page` são recusadas até existir prova por fonte dos agregados preservados.

Os callbacks de Case/Choice/capture nos testes são fixtures explícitas. Persistência protegida real, concessão humana e recibo C12 no host dependem dos owners WP10/WP11.

## CI verificado

| Gate | Resultado | Evidência |
|---|---|---|
| Testes Bun: 34 arquivos explícitos | **169 PASS, 0 FAIL, 1389 assertions** | [Run 43516062361](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43516062361), job 132198194307, SHA S |
| Request canônico | Aceito; 34 arquivos executados na ordem pedida | Step Read request aprovado; blob `b87f31df5dca0c1125b7610b6df0fb76b53c9bb2` recuperado em S |
| Controle omni | **not applicable**, nonce único conferido | Nenhum teste declarante/spawn omni executou; não é prova nativa |
| `bun typecheck` em `modules/sucafina` | **FAIL: 131 diagnósticos em 46 arquivos externos; 0 nos paths WP02** | [Run 43516071214](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43516071214), job 132198225475, SHA W |
| `bun run check:guards --base origin/dev` | **PASS: 78 regras, 0 GATE, 11 WARN, 0 erros** | Mesmo job; base real `a1d37698a7bb097c1578f827eba6a19b9917ef07` |

[ci-evidence.json](ci-evidence.json) contém os dois attempts, jobs/log hashes, seleção exata, blobs dos 34 arquivos e 169 nomes de testes observados. [ci-request.json](ci-request.json) reproduz o request. O workflow Bun não publica o artefato reservado ao Playwright; lista de artefatos vazia foi conferida, e os logs não estão vazios. O setup padrão imprimiu `Saved lockfile`; o workflow não capturou digest do lock após instalação, portanto a prova de identidade é dos inputs versionados W/S.

A primeira tentativa teve 168 PASS/1 FAIL e 11 diagnósticos dentro de WP02, todos resolvidos antes de W final. O único teste vermelho esperava `command-rejected`, mas a recusa correta anterior à execução era `page-unavailable`. Foram corrigidos tipos/fixtures sem supressões. Nenhum teste, typecheck ou build de produto foi executado localmente.

## Matriz integral e bloqueios

A [matriz dos 78 critérios](criteria.md), também em [JSON completo](criteria.json), conserva os requisitos literais e o vínculo critério→código/consumidor→teste/run→estado:

- **40 SCOPED_VERIFIED**: prova aprovada somente no escopo de domínio/renderer declarado.
- **31 PARTIAL**: parte implementada/provada, com lacuna concreta preservada.
- **7 BLOCKED**: integração/prova obrigatória ausente.

O typecheck completo permanece bloqueante. [typecheck-blockers.json](typecheck-blockers.json) lista os 131 diagnósticos finais com owners, mensagens e contexto. Os pares arquivo/posição/código/mensagem coincidem com o subconjunto externo da primeira tentativa; uma execução separada do seed não foi realizada, portanto isso não é atribuição causal de regressão. Os 46 arquivos externos não fazem parte do delta desta PR.

| Encaminhamento | Próximo trabalho necessário |
|---|---|
| S0 e owners do relatório de typecheck | Corrigir os 131 diagnósticos externos e repetir o typecheck do package completo. Sete diagnósticos em `product/interface/**` carecem de alocação explícita no manifesto. |
| WP10 / WP01 | Compor feedback de preview/conflito e provar rascunho/foco/contexto no app. |
| WP10 / WP07 / WP09 | Integrar lifecycle Performance, agenda e consumidor real de revisão/rotina. |
| WP10 / WP11 | Ligar stores de draft/Case/Choice/prepared change, revisão humana, aplicação e recibo C12. |
| WP10 / WP07 / WP08 | Persistir/reabrir captura histórica protegida; para agregados, receipts e ACL por fonte componente. |
| WP10.T06 / WP12 e consumidores | Produzir SessionV2/SkillLoadReceipt reais para `sf_dashboard_read` e `sf_kpi_explain`, paridade UI/native/MCP e negativas de revogação/reload. |

O [patch WP10 consolidado](integration/wp10-integration-combined.patch) é baseado em `dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f`; `git apply --check --whitespace=error-all` passou em cópias exatas, com reconstrução byte a byte de 4/4 arquivos. É proposta **não aplicada ao owner e sem teste integrado**. O [manifesto](integration/wp10-integration-combined.json) registra hashes, e [historical-c12.md](integration/historical-c12.md) descreve os callbacks e ligações WP11. Usar o patch consolidado; os individuais permanecem apenas como proveniência.

Os 11 WARN de Guardrail são analisados em [guard-review.md](guard-review.md): dez dependências herdadas com consumidores identificados e um double cast pendente de WP11. Não houve alteração de regras, ignore ou label de aprovação. A PR permanece Draft; não houve merge, label epic ou deploy. C/G7, D/G8, AM01–AM06 e as oito seleções finais seguem reservados à qualificação integrada.
