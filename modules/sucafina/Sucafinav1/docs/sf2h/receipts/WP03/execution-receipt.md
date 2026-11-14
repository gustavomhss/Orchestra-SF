# WP03 — implementação e evidência de execução

## Estado da entrega

A implementação de domínio e suas provas cirúrgicas estão publicadas em `astra-wp03`, na [PR #22](https://github.com/gustavomhss/Orchestra-SF/pull/22) contra `sf2-stack`. A PR permanece **Draft**: há bloqueios concretos de composição, typecheck compartilhado, navegador e execução residente. Este recibo não declara aceite integrado.

O [handoff fixado](https://github.com/gustavomhss/Orchestra-SF/blob/4e4d873e7e93bba3dc82df45e243999e7c8e76b6/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/WP03.md) e seu pack foram aplicados aos **112 critérios literais**. A [matriz legível](criteria-matrix.md) e a [matriz estruturada](criteria-matrix.json) registram implementação, consumidor, testes nomeados, blob, run e prova restante por critério. `PRODUCER_VERIFIED` qualifica somente o escopo produtor descrito na linha.

| Estado | Critérios |
| --- | ---: |
| `PRODUCER_VERIFIED` | 79 |
| `NATIVE_UNPROVEN` | 8 |
| `PENDING_UI_PROOF` | 16 |
| `BLOCKED_EXTERNAL` | 9 |

## Produto qualificado e identidade do CI

- Produto W6: `6f004731e7848bf540434a3ee050cd0f28f342cb`; tree `12403d54bf5713096a30647d45791d4a4431c857`.
- Snapshot S6: `9a62d6c0ed2638960319f8ff3d68eba58d2e92e5`; tree `934b5bed1e4978d407bf8810f2ab0b368b3f92a7`.
- Request SHA-256: `5bd08501e76cb4d08d9506d967086dca1b4ecd227f68a718b5a64c2cf78a6e01`; [seleção explícita](ci-request.json).
- [Run Bun 43523654974](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43523654974), job `132223957537`: **142 pass, 0 fail, 28 arquivos, 1521 assertions**.
- O compare remoto W6…S6 confirma um único commit descendente e um único arquivo acrescentado, `.ci-run.json`, blob `1506c1f200ca4ac73ecd50e57372feed1243acc1`. Todos os blobs de produto, testes, configuração e fixtures são idênticos.
- Omni positive control: **not applicable**, conforme o log do workflow. A rodada não comprova spawn omni nem execução nativa residente.

A publicação final destes recibos pode acrescentar um commit exclusivamente documental. O manifesto de blobs materiais e a regra de equivalência estão em [execution-evidence.json](execution-evidence.json); a PR registra o SHA entregue, seu compare somente de receipts e os checks hospedados desse SHA. O green Bun acima pertence explicitamente a W6/S6.

## Alterações implementadas

O motor financeiro existente continua sendo a fonte dos cálculos. O adapter e as projeções reutilizam o domínio para gerar séries, componentes, diferenças e impactos, preservando ausência, zero observado, flags manuais, arredondamento, actual/forecast e o tratamento legado de FX.

- **OPEX/CAPEX:** grade de doze meses, impacto antes/depois e anual, spread/reset, revisão esperada, fechamento e permissões por campo. Filtros CAPEX por owner, classificação e busca corrigidos. Preview não grava; comandos inválidos ou conflitos não sobrescrevem a versão corrente.
- **Headcount:** custo/FTE por domínio e mês, seleção automática de rate, overrides e uplift; estados de inclusão, contratação, roster e rate ausente separados. Actual/forecast de HR permanece independente do budget calculado. A projeção autorizada preserva agregados e remove dados de Talent/remuneração não permitidos.
- **Catálogos e versões:** FX normalizado, identidade de preview sem colisões, CRUD e referências em uso. Hosts Overview/Versions com bases e rótulos explícitos, cópia, lock, official, ano fiscal e CAS. Suas contribuições estão exportadas; composição global externa é entregue como patch não aplicado.
- **Simulação, comparação e persistência:** schema fechado, fontes e cobertura atuais, operações verificadas pelo domínio, clonagem e proteção contra reentrada. A persistência de comparações executa replay antes/depois da gravação; essa dupla execução não é atribuída ao ramo de persistência de cenário. Critérios exigem binding real do WP11; falha tardia não retorna sucesso/outputRef e preserva um estado parcial auditável.
- **Consumidores exercitados:** import C04 com preview e persistência reais; apply com as três superfícies inicializadas e recibo atômico; persistência C08 com reabertura, stale, revogação e binding WP11 em testes próprios. O positivo de paridade de cenário/comparação usa `criteria: []`, handlers UI/MCP e C08 reais sob admissão controlada; não substitui a composição residente nem o consumidor externo com critérios não vazios.

## Decisões sobre o baseline

[baseline-decisions.json](baseline-decisions.json) registra a discrepância, o efeito, a decisão e o teste observado. O código fixado em `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf` foi lido via MCP; não se afirma execução local desse baseline.

1. **FX abaixo da precisão:** o comando manual valida positivo antes de arredondar e pode armazenar zero; o workbook valida depois do arredondamento e o recusa. Ambos os comportamentos originais foram preservados. A composição explicita `usd: null`, `legacyUsd: 0` e `missingRate: true`, sem apresentar ausência como custo zero conhecido.
2. **Official migrado sem lock:** o vínculo official agora impede mudança de ano independentemente de `locked`. Rename sem ano, cópia e mudança de ano em draft continuam permitidos. É correção da identidade/autoridade da versão, sem mudança de fórmula financeira.

## Histórico verificável

Cada snapshot foi criado via MCP sobre o produto já publicado. Os resultados vermelhos são mantidos no [registro estruturado](execution-evidence.json), incluindo seleção, hashes, falhas e limites.

| Rodada | Produto | Run | Pass / fail | Conclusão |
| --- | --- | --- | ---: | --- |
| W1 | `9fc1a2ae` | [43516266328](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43516266328) | 114 / 6 | failure |
| B0 | `73ee7fd8` | [43517559589](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43517559589) | 0 / 1 | failure |
| W2 | `f7cedab2` | [43518488586](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43518488586) | 129 / 0 | success |
| W3 | `8f91131a` | [43519036975](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43519036975) | 130 / 1 | failure |
| W4 | `84b5a08a` | [43520443453](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43520443453) | 133 / 2 | failure |
| W5 | `815921f4` | [43522317597](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43522317597) | 141 / 1 | failure |
| W6 | `6f004731` | [43523654974](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43523654974) | 142 / 0 | success |

W1 revelou cinco falhas próprias, corrigidas em W2, e uma falha externa de inicialização WP11 reproduzida no seed em B0. W3/W4 ampliaram a seleção e expuseram problemas de fixture corrigidos nas rodadas seguintes. W5 aprovou 141 testes e excedeu o timeout do teste de paridade durável; W6 mediu o caminho completo até terminar. O workflow inválido de W2 não executou jobs e não vale como prova de typecheck/guards.

### Tempo do cenário durável

A rodada W6 conserva os replays, as verificações de autoridade, os assertions e a concessão de admissão de 60 segundos. Apenas o limite diagnóstico do teste foi elevado de 20 para 60 segundos, com contadores de progresso. O caminho de comparação reabre cases/fontes e efetua repetidos forecasts completos; o reader de `createSfAtlasBusiness` também usa `compareForecast(self, self)`. A observação demonstra conclusão nesta composição de teste; não certifica latência ou capacidade da instalação residente.

| Etapa | Tempo acumulado (ms) | Leituras iniciadas / concluídas |
| --- | ---: | ---: |
| fixture:start | 0 | 0 / 0 |
| fixture:done | 14 | 0 / 0 |
| seed-scenarios:start | 29 | 0 / 0 |
| seed-scenarios:done | 181 | 0 / 0 |
| case-evidence:start | 188 | 0 / 0 |
| case-evidence:done | 255 | 2 / 2 |
| case-read:start | 255 | 2 / 2 |
| case-read:done | 385 | 6 / 6 |
| ui-simulate-base:start | 385 | 6 / 6 |
| ui-simulate-base:done | 682 | 10 / 10 |
| ui-simulate-alternative:start | 682 | 10 / 10 |
| ui-simulate-alternative:done | 1059 | 14 / 14 |
| mcp-simulate-base:start | 1089 | 14 / 14 |
| mcp-simulate-base:done | 1576 | 18 / 18 |
| ui-compare:start | 1609 | 18 / 18 |
| ui-compare:done | 14660 | 158 / 158 |
| mcp-compare:start | 14660 | 158 / 158 |
| mcp-compare:done | 28130 | 298 / 298 |
| assertions:done | 28240 | 298 / 298 |
| close:start | 28240 | 298 / 298 |
| close:done | 28243 | 298 / 298 |

## Checks e bloqueios de integração

**Typecheck e guards.** O [run de checks W6 43523298505](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43523298505) executa `bun typecheck` em `modules/sucafina` e `bun run check:guards --base origin/dev` na raiz, com a base disponível. O typecheck permanece vermelho: **132 diagnósticos, zero em arquivos próprios**, contra 141 no seed. A comparação por arquivo/linha/coluna/código tem zero novos locais e nove removidos; quatro mensagens mudam de texto nos mesmos locais/códigos. Guards: **78 regras, 606 paths, zero gates, 12 warnings, zero erros**. O inventário integral, os owners e a atribuição do artefato estão em [external-typecheck-handoff.md](external-typecheck-handoff.md) e [external-typecheck-errors.json](external-typecheck-errors.json). Nenhuma supressão ou label de aprovação foi adicionada.

**Navegador real.** O [run Playwright 43520849840](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43520849840) selecionou um spec Chromium contra o CLI real e falhou antes de navegar: `Method 'ACL' already declared for route '/sucafina'`. O arquivo de instalação e a versão de Effect são iguais aos do seed; essa é atribuição por código/dependência, não um seed browser run. O ZIP de evidência foi baixado via MCP e seu SHA-256 conferido: `0aee7806ff77e30f6587b5476711474acdbaff28baa6fe296c7997a9306eef87`. Não houve jornada UI executada, nem trace.zip. [Escopo observado](browser-scope-review.md) e [patch WP10](wp10-installation-router-handoff.md) documentam a correção necessária e o rerun.

**Composição por outros owners.** Os patches abaixo estão completos como propostas e **não foram aplicados** em arquivos externos. Aplicação estrutural não equivale a typecheck, browser ou aceite do consumidor.

| Owner | Entrega e finalidade |
| --- | --- |
| WP00 / WP01 | Contrato, rota e retry da edição mensal: `wp00-monthly-contract.patch`, `wp01-monthly-route.patch`, `wp01-monthly-retry.patch`. |
| WP00 / WP10 / WP01 | [Overview/Versions](wp01-overview-versions-handoff.md): contratos, grants, composição, transporte e interface; hashes/bases em [overview-versions-owner-patches.json](overview-versions-owner-patches.json). |
| WP10 | [Router da instalação](wp10-installation-router-handoff.md): remover registro duplicado da rota mantendo o wildcard real. |
| WP11 | [Inicialização do teste consumidor](wp11-planner-apply-source-initialization-handoff.md): inicializar as três superfícies antes de emitir identidades. |
| WP13 | [Persistência/consumo de comparações](wp13-comparison-persistence-handoff.md): fornecer bindings de critérios e replay reais. |

**Execução nativa.** Oito critérios permanecem `NATIVE_UNPROVEN`. Não havia ferramenta callable de sessão Orchestra/Planner residente neste ambiente. O teste UI/MCP usa admissão e SkillLoadReceipt sintéticos declarados, executa os handlers e C08 reais, e não é testemunho de `SessionV2.prompt`. O [handoff residente](native-runtime-handoff.md) especifica a sessão, skill carregada, grants, provider, persistência/reload e negativas necessários.

## Próximo passo do integrador

Revisar/aplicar os deltas dos respectivos owners, resolver os diagnósticos de tipos compartilhados, executar o spec já entregue após corrigir o boot do CLI e concluir a prova residente com instalação real. Em seguida, realizar os gates C/G7, D/G8, AM01–AM06 e seleções finais do bundle. A PR permanece Draft até esses requisitos; o green cirúrgico produtor não os substitui.
